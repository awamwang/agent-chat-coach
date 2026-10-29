#!/usr/bin/env node
/**
 * agent-chat-coach · 待回推清单（L2 断点恢复）
 *
 * 用途：「被唤醒过 / 判过 / 但不确定推没推」「上下文压缩后忘了 id」「怀疑有单挂着」
 * ——一条命令列出**磁盘上接了单但账本里没有 REPLIED**的所有任务，并给出可直接复制的
 * 自检命令与回推命令。
 *
 * 用法：
 *   node scripts\pending.mjs            # 人看：表格 + 逐单命令
 *   node scripts\pending.mjs --json     # 机读
 *   node scripts\pending.mjs --drop <id># 标记放弃（该单不再出现在清单里）
 *
 * 退出码：0 = 无待回推；5 = 有待回推；1 = 桥不在线（仅提示，不影响清单输出）。
 * 零第三方依赖，Node >= 18。
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { awaitingTasks, appendEvent } from "./lib/ledger.mjs";
import { checkAnswer } from "./lib/answer-quality.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BRIDGE_BASE || "http://127.0.0.1:8913";

function argOf(flag) {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : undefined;
}

const outDir = argOf("--out-dir") || join(SKILL_DIR, "workspace", "_bridge");
const asJson = process.argv.includes("--json");
const dropId = argOf("--drop");

if (dropId) {
  appendEvent(outDir, { type: "DROPPED", id: dropId, reason: "manual --drop" });
  if (!asJson) console.log(`[pending] 已标记放弃：${dropId}（不再计入待回推）`);
}

const tasks = awaitingTasks(outDir);

/* 附上每单的当前稿况（让"到底推没推"一眼可判） */
const rows = tasks.map((t) => {
  let draft = "缺";
  let gate = "-";
  let chars = 0;
  if (t.answerFile && existsSync(t.answerFile)) {
    const text = readFileSync(t.answerFile, "utf8");
    const qc = checkAnswer(text, { style: t.style });
    chars = qc.chars;
    draft = qc.chars ? "已写" : "空";
    gate = qc.ok ? "PASS" : `拒:${qc.errors[0]}`;
  }
  return {
    id: t.id,
    receivedAt: t.receivedAt,
    style: t.style,
    styleLabel: t.styleLabel,
    example: Boolean(t.example),
    bodyChars: t.bodyChars,
    bodyFile: t.bodyFile,
    answerFile: t.answerFile,
    draft,
    chars,
    gate,
    replyCmd: t.replyCmd,
    checkCmd: t.checkCmd,
  };
});

let bridgePending = null;
try {
  const r = await fetch(`${BASE}/web/state`, { signal: AbortSignal.timeout(2500) });
  const st = await r.json();
  bridgePending = st.pendingCount;
} catch {
  /* 桥不在线：清单仍可用 */
}

if (asJson) {
  console.log(JSON.stringify({ awaiting: rows, bridgePending, count: rows.length }, null, 2));
} else if (!rows.length) {
  console.log("[pending] 无待回推任务。");
  if (bridgePending) console.log(`  · 注意：桥报告全局待答 ${bridgePending} 条 —— 可能有单没被本机接走（检查宿主是否在线、网页选对了宿主）。`);
} else {
  console.log(`=== 待回推 ${rows.length} 条（按收单时间正序）===`);
  if (bridgePending !== null) console.log(`桥全局待答：${bridgePending} 条`);
  rows.forEach((r, i) => {
    console.log(`\n[${i + 1}] id=${r.id}`);
    console.log(`    收单 : ${r.receivedAt}`);
    console.log(`    风格 : ${r.style}（${r.styleLabel}）　范例: ${r.example ? "要" : "不要"}　正文 ${r.bodyChars} 字`);
    console.log(`    原文 : ${r.bodyFile}`);
    console.log(`    稿件 : ${r.answerFile} → ${r.draft}${r.chars ? ` ${r.chars} 字` : ""}　闸门 ${r.gate}`);
    console.log(`    ① 自检: ${r.checkCmd}`);
    console.log(`    ② 回推: ${r.replyCmd}`);
  });
  console.log(`\n（改稿后重跑 ②；确实要放弃某单：node scripts\\pending.mjs --drop <id>）`);
}

process.exit(rows.length ? 5 : 0);
