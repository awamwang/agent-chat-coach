#!/usr/bin/env node
/**
 * agent-chat-coach · 常驻消费者（LLM-free 接单管道）
 *
 * 一个进程同时干两件事，且**不依赖任何 LLM / 配额**：
 *   1) 心跳：每 8s peek 一次，让宿主在网页下拉里始终「在线」（避免只跑 --wait 时
 *      30s~55s 的离线窗口被网页自动回退到别的宿主）；
 *   2) 长轮询：接单，命中就落 inbox + 打印，然后按 --mode 决定退出或继续。
 *
 * 为什么要它：把「等单/接单」这段纯管道从 LLM 子代理身上剥下来。子代理会因配额
 * （429）中途死掉，一死管道全断、待判成孤儿；而管道本身根本不需要 LLM，只需要一个
 * Node 进程。判定仍由收到唤醒的 Agent 负责（要隔离就用一个短命判定子会话）。
 *
 * 自终止窗口：--window-ms 到点自己退（码 3），调用方不必再猜外层 shell timeout。
 * （host.mjs 内部的 mcpCall 超时是 waitMs+20000=75s，外层 shell timeout 若设 70s 会被
 *  SIGTERM 误杀——这是本脚本要绕开的坑。）
 *
 * 用法：
 *   node scripts\serve.mjs --id coach-sub --label "教练 · 子会话"
 *   node scripts\serve.mjs --id coach-sub --window-ms 600000 --mode wake
 *   node scripts\serve.mjs --id coach-sub --mode loop --window-ms 1800000   # 连挂多单
 *
 * 退出码：0 = 接到单（wake 模式）或被信号结束；3 = 窗口到期未接到；1 = 桥不在线/致命。
 * 零第三方依赖，Node >= 18。
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
const inboxPath = argOf("--inbox", join(SKILL_DIR, "workspace", "_bridge", "inbox.jsonl"));
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
  console.log(`\n回答：node scripts\\reply.mjs --id ${q.id} --file <回答文件>   （或 --inbox-latest）`);
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

/* 长轮询：接单并落 inbox */
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
      try {
        mkdirSync(dirname(inboxPath), { recursive: true });
        appendFileSync(inboxPath, JSON.stringify({ ...q, gotAt: new Date().toISOString() }) + "\n", "utf8");
      } catch (e) {
        console.log(`  ! 写 inbox 失败：${e.message}`);
      }
      printQuestion(q, sc);
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
    `[serve] hostId=${hostId} label=${label} mode=${mode} window=${windowMs || "∞"}ms waitMs=${waitMs} → ${BASE}`
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
