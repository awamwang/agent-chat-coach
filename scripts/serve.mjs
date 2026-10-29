#!/usr/bin/env node
/**
 * agent-chat-coach · 常驻消费者（LLM-free 接单管道 + 判定任务包 + spawn 降级）
 *
 * 一个进程干三件事，全程**不依赖任何 LLM / 配额**：
 *   1) 心跳：每 8s peek 一次，让宿主在网页下拉里始终「在线」
 *      （只跑 --wait 时每 55s 有约 25s 显示离线，网页会静默回退到别的宿主）；
 *   2) 长轮询接单：命中就落 inbox；
 *   3) 建判定任务包：解析信封 → 写 body/task 单 → 用 prompts/judge-subsession.md
 *      渲染出**可直接下发的子会话 prompt**。
 *
 * 为什么要它：把「等单 / 接单 / 拼 prompt」这段纯管道从 LLM 子代理身上剥下来。
 * 子代理会因配额（429）中途死掉，一死管道全断、待判成孤儿；而管道根本不需要 LLM。
 *
 * 判定调度（三级降级链，见 docs/子会话宿主模式.md）：
 *   L1 短命判定子会话 —— --spawn-cmd 指定的外部 CLI agent（如 claude -p）跑完自动回推；
 *   L2 主会话接管     —— 本脚本以退出码 4 结束（SPAWN_FAILED / 产物不合格），
 *                        唤醒的主会话读 promptFile 自己下发子会话或亲自判定；
 *   L3 人工            —— 都不行就人看任务单手动处理。
 *
 * 自终止窗口：--window-ms 到点自己退（码 3），调用方不必再猜外层 shell timeout。
 * （host.mjs 内部 mcpCall 超时是 waitMs+20000=75s，外层 shell timeout 设 70s 会被
 *  SIGTERM 误杀——这是本脚本要绕开的坑。）
 *
 * 用法：
 *   # 推荐：接单 → 渲染任务包 → 起 claude 判定 → 自动回推
 *   # prompt 用 "<" 重定向送入（cmd 与 Bash 都认）；**别写 $(cat {promptFile})**——
 *   # spawn 在 Windows 走 cmd.exe，$() 不展开，会被当字面参数（已实测）。
 *   node scripts\serve.mjs --id coach-sub --window-ms 600000 --mode wake \
 *     --spawn-cmd "claude -p --permission-mode acceptEdits < \"{promptFile}\""
 *
 *   # 只建包不自启（主会话接管）：不传 --spawn-cmd 即可
 *   node scripts\serve.mjs --id coach-sub --mode loop --window-ms 1800000
 *
 * 退出码：0 = 接单（无 spawn / spawn 成功已回推）；3 = 窗口到期未接到；
 *         4 = 接单但 spawn 失败或产物不合格 → 交主会话降级；1 = 桥不在线/致命。
 * 零第三方依赖，Node >= 18。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildTask, renderPrompt } from "./lib/envelope.mjs";
import { checkAnswer } from "./lib/answer-quality.mjs";
import { appendEvent } from "./lib/ledger.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BRIDGE_BASE || "http://127.0.0.1:8913";

function argOf(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const hostId = argOf("--id", "coach-sub");
const label = argOf("--label", "教练 · 子会话");
const windowMs = Math.max(0, Number(argOf("--window-ms", "600000")) || 0); // 0 = 不限时
const mode = argOf("--mode", "wake"); // wake | loop
const waitMs = Math.min(Number(argOf("--wait-ms", "55000")) || 55000, 60000);
const outDir = argOf("--out-dir", join(SKILL_DIR, "workspace", "_bridge"));
const inboxPath = argOf("--inbox", join(outDir, "inbox.jsonl"));
const templatePath = argOf("--template", join(SKILL_DIR, "prompts", "judge-subsession.md"));
const spawnCmd = argOf("--spawn-cmd");
const spawnTimeoutMs = Number(argOf("--spawn-timeout-ms", "600000")) || 600000;
const noTask = process.argv.includes("--no-task"); // 退回旧行为：只打印
const noAutoReply = process.argv.includes("--no-auto-reply"); // spawn 成功也不自动回推
const verbose = process.argv.includes("--verbose");

let seq = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mcpCall(name, args, timeoutMs) {
  const body = { jsonrpc: "2.0", id: ++seq, method: "tools/call", params: { name, arguments: args } };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let text;
  try {
    const res = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  const line = text.split(/\r?\n/).find((l) => l.startsWith("data:"));
  const payload = JSON.parse(line ? line.slice(5).trim() : text);
  if (payload.error) throw new Error(payload.error.message || "MCP error");
  return payload.result || {};
}

async function bridgeUp() {
  try {
    const r = await fetch(`${BASE}/web/state`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

function printQuestion(q, sc) {
  console.log("\n=== 收到一条待判问题 ===");
  console.log(`id      : ${q.id}`);
  console.log(`宿主    : ${sc.hostLabel || label}`);
  console.log(`本宿主待答: ${sc.hostPendingCount}　全局待答: ${sc.pendingCount}`);
  console.log("---- 消息原文 ----");
  console.log(q.message);
  console.log("---- 原文结束 ----");
}

/** 用模板渲染子会话 prompt，返回 promptFile 路径（失败返回 ""） */
function writePrompt(task) {
  if (!existsSync(templatePath)) {
    console.log(`  ! 模板缺失：${templatePath}（跳过 prompt 渲染）`);
    return "";
  }
  try {
    const tpl = readFileSync(templatePath, "utf8");
    writeFileSync(task.promptFile, renderPrompt(tpl, task), "utf8");
    return task.promptFile;
  } catch (e) {
    console.log(`  ! 渲染 prompt 失败：${e.message}`);
    return "";
  }
}

/** 回推（复用 reply.mjs，含它的质量闸门与 duplicate 幂等） */
function replyWith(task) {
  const replyMjs = join(SKILL_DIR, "scripts", "reply.mjs");
  const r = spawnSync(process.execPath, [replyMjs, "--id", task.id, "--file", task.answerFile], {
    encoding: "utf8",
    timeout: 60000,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  if (out) console.log(out.split("\n").map((l) => `  [reply] ${l}`).join("\n"));
  return r.status === 0;
}

/**
 * 接单处理。返回 { code, degraded, reason }
 *   code 0 = 正常（无 spawn / spawn 成功且已回推）
 *   code 4 = 需降级（spawn 失败 / 产物不合格）
 */
function handleQuestion(q, sc) {
  // 1) 建任务包
  let task = null;
  if (!noTask) {
    try {
      task = buildTask({ id: q.id, hostId, label: sc.hostLabel || label, message: q.message, outDir, skillDir: SKILL_DIR });
      task.promptFile = writePrompt(task) || "";
    } catch (e) {
      console.log(`  ! 建任务包失败：${e.message}（退回只打印）`);
      task = null;
    }
  }

  // 2) 落 inbox（带解析结果，reply --inbox-latest 可自动带风格）
  try {
    mkdirSync(dirname(inboxPath), { recursive: true });
    appendFileSync(
      inboxPath,
      JSON.stringify({
        ...q,
        gotAt: new Date().toISOString(),
        style: task?.style,
        example: task?.example,
        answerFile: task?.answerFile,
        taskFile: task?.taskFile,
        promptFile: task?.promptFile,
      }) + "\n",
      "utf8"
    );
  } catch (e) {
    console.log(`  ! 写 inbox 失败：${e.message}`);
  }

  printQuestion(q, sc);

  if (task) {
    appendEvent(outDir, {
      type: "RECEIVED",
      id: task.id,
      hostId,
      style: task.style,
      example: task.example,
      bodyChars: task.bodyChars,
    });
  }

  if (!task) {
    console.log(`\n回答：node scripts\\reply.mjs --id ${q.id} --file <回答文件>   （或 --inbox-latest）`);
    return { code: 0 };
  }

  console.log(`风格    : ${task.style}（${task.styleLabel}）　范例: ${task.example ? "要" : "不要"}　正文 ${task.bodyChars} 字`);
  console.log(`TASK_READY id=${task.id} style=${task.style} example=${task.example ? 1 : 0}`);
  console.log(`  taskFile  = ${task.taskFile}`);
  console.log(`  promptFile= ${task.promptFile || "(未生成)"}`);
  console.log(`  answerFile= ${task.answerFile}`);

  // 3) 无 spawn：交给主会话（L2），本脚本正常退出
  if (!spawnCmd) {
    console.log("\n--- L2 主会话判定（默认路径）---");
    console.log(`① 读口径：${task.skillDir}/SKILL.md · providers/free/SKILL.md · rules.md · styles.md` +
      (task.example ? " · generators.md（范例=要）" : ""));
    console.log(`② 读正文：${task.bodyFile}（${task.bodyChars} 字，风格 ${task.style}）`);
    console.log(`③ 写稿到：${task.answerFile}`);
    console.log(`④ 自检  ：${task.checkCmd}`);
    console.log(`⑤ 回推  ：${task.replyCmd}`);
    console.log(`（另有单挂着 / 忘了 id → node "${join(SKILL_DIR, "scripts", "pending.mjs").replace(/\\/g, "/")}"）`);
    return { code: 0, task };
  }

  // 4) L1：自启外部判定 agent
  const cmd = spawnCmd
    .replace(/\{promptFile\}/g, task.promptFile)
    .replace(/\{taskFile\}/g, task.taskFile)
    .replace(/\{answerFile\}/g, task.answerFile)
    .replace(/\{id\}/g, task.id);
  console.log(`\n[spawn] ${cmd}`);
  const st = spawnSync(cmd, { shell: true, stdio: "inherit", timeout: spawnTimeoutMs });

  if (st.status !== 0) {
    const reason = st.signal ? `被信号 ${st.signal} 结束` : `退出码 ${st.status}`;
    console.log(`SPAWN_FAILED id=${task.id} reason=${reason}`);
    return { code: 4, degraded: true, reason, task };
  }

  // 5) 产物校验：CLI agent 可能 exit 0 却没干活，必须验文件
  let answer;
  try {
    answer = readFileSync(task.answerFile, "utf8");
  } catch {
    console.log(`SPAWN_FAILED id=${task.id} reason=未产出回答文件`);
    return { code: 4, degraded: true, reason: "未产出回答文件", task };
  }
  const qc = checkAnswer(answer, { style: task.style });
  for (const w of qc.warnings) console.log(`  ! 产物提示：${w}`);
  if (!qc.ok) {
    console.log(`SPAWN_FAILED id=${task.id} reason=产物不合格：${qc.errors.join("；")}`);
    return { code: 4, degraded: true, reason: `产物不合格：${qc.errors.join("；")}`, task };
  }
  console.log(`SPAWN_OK id=${task.id} chars=${qc.chars}`);

  // 6) 自动回推
  if (noAutoReply) {
    console.log(`  --no-auto-reply：不自动回推，手动跑 ${task.replyCmd}`);
    return { code: 0, task };
  }
  const ok = replyWith(task);
  console.log(ok ? `REPLIED id=${task.id}` : `REPLY_FAILED id=${task.id}`);
  return { code: ok ? 0 : 4, task };
}

/* 心跳：保在线显示，不消费问题 */
async function heartbeat() {
  let fails = 0;
  while (true) {
    try {
      await mcpCall("await_question", { hostId, label, peek: true }, 8000);
      fails = 0;
    } catch (e) {
      fails++;
      if (verbose) console.log(`  ! 心跳失败（${fails}）：${e.message}`);
    }
    await sleep(8000);
  }
}

/* 长轮询：接单 → 任务包 → 调度 */
async function waitLoop() {
  let sinceId;
  let rounds = 0;
  while (true) {
    let r;
    try {
      r = await mcpCall("await_question", { hostId, label, sinceId, waitMs }, waitMs + 20000);
    } catch (e) {
      if (verbose) console.log(`  ! 订阅失败：${e.message}（5s 重试）`);
      await sleep(5000);
      continue;
    }
    const sc = r.structuredContent || {};
    if (sc.changed && sc.question) {
      const q = sc.question;
      sinceId = q.id;
      const res = handleQuestion(q, sc);

      if (res.code === 4) {
        appendEvent(outDir, { type: "DEGRADE", id: q.id, reason: res.reason });
        console.log(`DEGRADE id=${q.id} reason=${res.reason}`);
        console.log("（退出码 4：唤醒主会话接手判定，勿重复提交）");
        process.exit(4);
      }
      if (mode === "wake") {
        console.log("（wake 模式：退出以唤醒 Agent）");
        process.exit(0);
      }
      console.log("（loop 模式：继续订阅下一单）");
    }
    rounds++;
    if (verbose && rounds % 5 === 0) console.log(`  · 仍无新问题（轮 ${rounds}）`);
  }
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

(async () => {
  if (!(await bridgeUp())) {
    console.error(`桥未在线：${BASE}/web/state。先跑 node scripts\\bridge.mjs 起 8913 再试。`);
    process.exit(1);
  }
  console.log(
    `[serve] hostId=${hostId} label=${label} mode=${mode} window=${windowMs || "∞"}ms waitMs=${waitMs}` +
      ` spawn=${spawnCmd ? "L1 自启" : "L2 主会话"} → ${BASE}`
  );
  if (windowMs > 0) {
    setTimeout(() => {
      console.log(`[serve] 窗口到期（${windowMs} ms），未接到问题`);
      process.exit(3);
    }, windowMs);
  }
  heartbeat(); // 后台常驻，不 await
  waitLoop().catch((e) => {
    console.error("[serve] 致命错误：", e);
    process.exit(1);
  });
})();
