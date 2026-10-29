#!/usr/bin/env node
/**
 * agent-chat-coach · 把判定稿提交回外部网页（submit_answer 的 CLI 壳）
 *
 * 用法：
 *   node scripts\reply.mjs --id <问题id> --file <回答文件.md>
 *   node scripts\reply.mjs --id <问题id> --text "一句话判定"
 *   Get-Content answer.md -Raw | node scripts\reply.mjs --id <id> --stdin
 *   node scripts\reply.mjs --inbox-latest --file <回答文件.md>   # id 取 inbox 最后一条
 *   node scripts\reply.mjs --inbox-latest                        # id + 风格 + 答案文件全自动
 *
 * 回推前过质量闸门（scripts/lib/answer-quality.mjs）：空稿 / 占位符残留 / 待补 /
 * <details> 未闭合会被拒绝，避免把坏稿推到网页。-e 或 --force 可强制推送。
 *
 * 幂等：同一条重复提交返回 duplicate=true，不会把回答推两遍。
 * 零第三方依赖，Node >= 18。
 */

import { existsSync, readFileSync } from "node:fs";
import { checkAnswer } from "./lib/answer-quality.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BRIDGE_BASE || "http://127.0.0.1:8913";

function argOf(flag) {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : undefined;
}

/* ---- 1) 先读 inbox（--inbox-latest）：取 id / 风格 / 答案文件 ---- */
let inboxLast = null;
if (process.argv.includes("--inbox-latest")) {
  const inboxPath = argOf("--inbox") || join(SKILL_DIR, "workspace", "_bridge", "inbox.jsonl");
  try {
    const lines = readFileSync(inboxPath, "utf8").split(/\r?\n/).filter(Boolean);
    inboxLast = JSON.parse(lines[lines.length - 1]);
    if (inboxLast?.id) console.log(`[reply] --inbox-latest → 最后一条 id=${inboxLast.id}`);
  } catch (e) {
    console.error(`--inbox-latest 读取 inbox 失败：${e.message}（改用 --id 显式指定）`);
  }
}

/* ---- 2) 取回答正文（--inbox-latest 且任务包有 answerFile 时可全省） ---- */
let answer;
let answerFrom = "";
if (process.argv.includes("--stdin")) {
  answer = readFileSync(0, "utf8");
  answerFrom = "stdin";
} else if (argOf("--file")) {
  answer = readFileSync(argOf("--file"), "utf8");
  answerFrom = argOf("--file");
} else if (argOf("--text")) {
  answer = argOf("--text");
  answerFrom = "--text";
} else if (inboxLast?.answerFile && existsSync(inboxLast.answerFile)) {
  answer = readFileSync(inboxLast.answerFile, "utf8");
  answerFrom = inboxLast.answerFile;
}
if (!answer || !answer.trim()) {
  console.error("缺回答正文：--file <路径> / --text <文本> / --stdin（--inbox-latest 时可直接读任务包 answerFile）");
  process.exit(2);
}
console.log(`[reply] 回答来源：${answerFrom}`);

/* ---- 3) id 与风格（风格决定闸门口径） ---- */
const id = argOf("--id") || inboxLast?.id;
const style = argOf("--style") || inboxLast?.style || "objective";

/* ---- 4) 质量闸门 ---- */
const qc = checkAnswer(answer, { style });
for (const w of qc.warnings) console.log(`[reply] ! ${w}`);
if (!qc.ok) {
  console.error(`[reply] 回答未通过质量闸门（风格 ${style}，${qc.chars} 字）：`);
  for (const e of qc.errors) console.error(`  ✗ ${e}`);
  if (process.argv.includes("--force") || process.argv.includes("-e")) {
    console.error("[reply] --force 生效：忽略上述问题继续推送。");
  } else {
    console.error("[reply] 已拒绝推送。改稿重试，或加 --force 强制推送。");
    process.exit(2);
  }
}

const body = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "submit_answer", arguments: id ? { id, answer } : { answer } },
};

const res = await fetch(`${BASE}/mcp`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify(body),
});
const text = await res.text();
const line = text.split(/\r?\n/).find((l) => l.startsWith("data:"));
const payload = JSON.parse(line ? line.slice(5).trim() : text);
if (payload.error) {
  console.error("提交失败：" + (payload.error.message || JSON.stringify(payload.error)));
  process.exit(1);
}
const sc = payload.result?.structuredContent || {};
if (sc.duplicate) {
  console.log(`已忽略重复提交：id=${sc.id}（此前答过，未重复推送）`);
} else {
  console.log(`已推送到网页：id=${sc.id} · 宿主 ${sc.hostLabel} 的第 ${sc.count} 条回答`);
}
