#!/usr/bin/env node
/**
 * agent-chat-coach · 把判定稿提交回外部网页（submit_answer 的 CLI 壳）
 *
 * 用法：
 *   node scripts\reply.mjs --id <问题id> --file <回答文件.md>
 *   node scripts\reply.mjs --id <问题id> --text "一句话判定"
 *   Get-Content answer.md -Raw | node scripts\reply.mjs --id <id> --stdin
 *   node scripts\reply.mjs --inbox-latest --file <回答文件.md>   # id 取 inbox 最后一条
 *
 * 幂等：同一条重复提交返回 duplicate=true，不会把回答推两遍。
 * 零第三方依赖，Node >= 18。
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BRIDGE_BASE || "http://127.0.0.1:8913";

function argOf(flag) {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : undefined;
}

let answer;
if (process.argv.includes("--stdin")) {
  answer = readFileSync(0, "utf8");
} else if (argOf("--file")) {
  answer = readFileSync(argOf("--file"), "utf8");
} else {
  answer = argOf("--text");
}

let id = argOf("--id");
if (!id && process.argv.includes("--inbox-latest")) {
  const inboxPath = argOf("--inbox") || join(SKILL_DIR, "workspace", "_bridge", "inbox.jsonl");
  try {
    const lines = readFileSync(inboxPath, "utf8").split(/\r?\n/).filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    if (last && last.id) {
      id = last.id;
      console.log(`[reply] --inbox-latest → 使用最后一条问题 id=${id}`);
    }
  } catch (e) {
    console.error(`--inbox-latest 读取 inbox 失败：${e.message}（改用 --id 显式指定）`);
  }
}
if (!answer || !answer.trim()) {
  console.error("缺回答正文：--file <路径> / --text <文本> / --stdin");
  process.exit(2);
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
