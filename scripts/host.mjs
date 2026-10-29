#!/usr/bin/env node
/**
 * agent-chat-coach · 无面板宿主（headless host）
 *
 * 场景：宿主不支持 MCP App 视图（拿不到 render_bridge_view），或不想让桥占面板。
 * 本脚本直接对 8913 的无状态 MCP 端点（POST /mcp）调用 await_question，
 * 等价于「桥视图」那一侧的订阅：注册宿主身份、保持心跳、长挂等新问题。
 *
 * 两种模式：
 *   --heartbeat   只打心跳（peek），让宿主在网页上一直是「在线」；常驻不退
 *   --wait        长挂订阅；收到问题就打印 + 落 inbox 后**退出**（退出事件用来唤醒
 *                 Agent：后台任务结束会通知它），超时则静默续订
 *
 * 用法：
 *   node scripts\host.mjs --heartbeat --id coach-local --label "教练 · 本机"
 *   node scripts\host.mjs --wait      --id coach-local --label "教练 · 本机"
 *
 * 回答用 scripts\reply.mjs。零第三方依赖，Node >= 18。
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BRIDGE_BASE || "http://127.0.0.1:8913";

/* ---------- 参数 ---------- */
function argOf(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const hostId = argOf("--id", "coach-local");
const label = argOf("--label", "教练 · 本机");
const waitMs = Math.min(Number(argOf("--wait-ms", "50000")) || 50000, 60000);
const heartbeatOnly = process.argv.includes("--heartbeat");
const verbose = process.argv.includes("--verbose");
const inboxPath = argOf("--inbox", join(SKILL_DIR, "workspace", "_bridge", "inbox.jsonl"));

let seq = 0;

/* ---------- MCP over HTTP（无状态，一下一请求） ---------- */
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
  // 服务端回 SSE（event: message / data: {...}），也兼容裸 JSON
  const line = text.split(/\r?\n/).find((l) => l.startsWith("data:"));
  const payload = JSON.parse(line ? line.slice(5).trim() : text);
  if (payload.error) throw new Error(payload.error.message || "MCP error");
  return payload.result || {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 心跳模式 ---------- */
async function heartbeatLoop() {
  console.log(`[host] 心跳模式：hostId=${hostId} label=${label} → ${BASE}`);
  let failures = 0;
  while (true) {
    try {
      const r = await mcpCall("await_question", { hostId, label, peek: true }, 8000);
      const sc = r.structuredContent || {};
      failures = 0;
      if (verbose) console.log(`  · 在线，待答 ${sc.hostPendingCount ?? "?"} 条`);
    } catch (e) {
      failures++;
      console.log(`  ! 心跳失败（第 ${failures} 次）：${e.message}`);
      if (failures === 1) {
        console.log("    服务没起？跑 node scripts\\bridge.mjs 起 8913，或让用户双击 start-keepalive.cmd");
      }
      if (failures > 60) process.exit(2);   // 长时间连不上就退出，别无声挂着
    }
    await sleep(8000);
  }
}

/* ---------- 订阅模式：有则退出（用来唤醒 Agent），超时静默续订 ---------- */
async function waitLoop() {
  console.log(`[host] 订阅模式：hostId=${hostId} label=${label}，waitMs=${waitMs}`);
  let sinceId;
  let rounds = 0;
  while (true) {
    let r;
    try {
      r = await mcpCall("await_question", { hostId, label, sinceId, waitMs }, waitMs + 20000);
    } catch (e) {
      console.log(`  ! 订阅失败：${e.message}（5 秒后重试）`);
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
      console.log("\n=== 收到一条待判问题 ===");
      console.log(`id      : ${q.id}`);
      console.log(`宿主    : ${sc.hostLabel || label}`);
      console.log(`本宿主待答: ${sc.hostPendingCount}　全局待答: ${sc.pendingCount}`);
      console.log("---- 消息原文 ----");
      console.log(q.message);
      console.log("---- 原文结束 ----");
      console.log(`\n回答：node scripts\\reply.mjs --id ${q.id} --file <回答文件>`);
      console.log("（本进程到此退出，后台任务结束会唤醒 Agent）");
      process.exit(0);
    }
    rounds++;
    if (verbose && rounds % 5 === 0) {
      console.log(`  · 仍无新问题（本轮 ${rounds}），待答 ${sc.hostPendingCount ?? 0} 条`);
    }
  }
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

(heartbeatOnly ? heartbeatLoop : waitLoop)().catch((e) => {
  console.error("[host] 致命错误：", e);
  process.exit(1);
});
