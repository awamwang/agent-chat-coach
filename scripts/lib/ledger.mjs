/**
 * agent-chat-coach · 本地接单账本（LLM-free，append-only）
 *
 * 为什么需要它：L2（主会话判定）的真实故障不是"判不出来"，而是**醒来后丢了 id**
 * ——上下文被压缩、后台任务通知被别的消息挤走、或者干脆忘了回推。桥没有"列出待答"
 * 的接口（只有 pendingCount 计数），所以必须在本地留一份可追溯的接单记录。
 *
 * 账本位置：<outDir>/ledger.jsonl，一行一个事件：
 *   { ts, type: "RECEIVED" | "DEGRADE" | "SPAWN_FAILED" | "REPLIED" | "DROPPED", id, ... }
 *
 * "待回推"的定义（pending.mjs 用）：磁盘上有 task-<id>.json，且账本里**没有**该 id 的
 * REPLIED / DROPPED 事件。故意用"任务单"而不是 inbox——inbox 是流水，会追加新单，
 * 按最后一条取 id 在混单场景下会取错（这是之前踩过的坑）。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function ledgerPath(outDir) {
  return join(outDir, "ledger.jsonl");
}

/** 追加一条事件（永不抛：账本坏了也不能让接单链路挂掉） */
export function appendEvent(outDir, ev) {
  try {
    mkdirSync(outDir, { recursive: true });
    appendFileSync(ledgerPath(outDir), JSON.stringify({ ts: new Date().toISOString(), ...ev }) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

/** 读全部事件（坏行跳过） */
export function readEvents(outDir) {
  const p = ledgerPath(outDir);
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* 坏行跳过，不让账本阻塞流程 */
    }
  }
  return out;
}

/** 某 id 的最终态：replied / dropped / null */
export function finalStateOf(events, id) {
  let state = null;
  for (const e of events) {
    if (e.id !== id) continue;
    if (e.type === "REPLIED") state = "replied";
    else if (e.type === "DROPPED") state = "dropped";
  }
  return state;
}

/**
 * 列出"已接单未回推"的任务（按收单时间正序，最老的排前面）。
 * @returns {Array<object>} task 对象（task-<id>.json 的内容）+ `state`
 */
export function awaitingTasks(outDir) {
  if (!existsSync(outDir)) return [];
  const events = readEvents(outDir);
  const tasks = [];
  for (const name of readdirSync(outDir)) {
    if (!name.startsWith("task-") || !name.endsWith(".json")) continue;
    try {
      const t = JSON.parse(readFileSync(join(outDir, name), "utf8"));
      if (!t || !t.id) continue;
      if (finalStateOf(events, t.id)) continue;
      tasks.push(t);
    } catch {
      /* 半写的任务单跳过 */
    }
  }
  tasks.sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)));
  return tasks;
}
