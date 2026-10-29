/**
 * agent-chat-coach · 信封解析 + 判定任务包（LLM-free）
 *
 * 网页把「风格 + 范例 + 正文」包成一个信封发到桥，形如：
 *   风格：objective（客观）
 *   范例：不要
 *   —— 以下是我要判定的内容 ——
 *   <正文>
 *
 * 这里只做纯文本解析与文件物化，不涉及任何判定逻辑、不调用 LLM。
 * 目的：把「解析信封 / 建任务单 / 渲染子会话 prompt」从 LLM 手里拿走，
 * 让 serve.mjs 一接单就能产出可直接消费的任务包。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DELIMITER = /^[ \t]*——[ \t]*以下是我要判定的内容[ \t]*——[ \t]*$/m;

const STYLE_RULES = [
  ["brief", /brief|精简|简洁|简短/i],
  ["strict", /strict|严师|严格|严苛|挑刺/i],
  ["objective", /objective|客观|中性|默认/i],
];

export const STYLE_LABEL = { objective: "客观", strict: "严师", brief: "精简" };

function normStyle(raw) {
  if (!raw) return "objective";
  for (const [key, re] of STYLE_RULES) if (re.test(raw)) return key;
  return "objective";
}

/** 「要 / 不要」：只认肯定词，「不要」以「不」开头故自然为 false */
function normExample(raw) {
  if (!raw) return false;
  return /^(要|需要|yes|y|true|1|生成|附)/i.test(raw.trim());
}

/** 无分隔线时，剥掉头部连续元信息行（只剥头部，正文里同形行不动） */
function stripHeader(lines) {
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  while (i < lines.length && /^[ \t]*(风格|范例)[：:]/.test(lines[i])) i++;
  while (i < lines.length && !lines[i].trim()) i++;
  return lines.slice(i).join("\n").trim();
}

/**
 * 解析信封。
 * @returns {{style:string, styleRaw:string, styleLabel:string, example:boolean,
 *            exampleRaw:string, body:string, hasDelimiter:boolean}}
 */
export function parseEnvelope(message) {
  const raw = String(message ?? "");
  const lines = raw.split(/\r?\n/);

  let styleRaw = "";
  let exampleRaw = "";
  for (const line of lines.slice(0, 8)) {
    const ms = line.match(/^[ \t]*风格[：:][ \t]*(.+)$/);
    if (ms && !styleRaw) styleRaw = ms[1].trim();
    const me = line.match(/^[ \t]*范例[：:][ \t]*(.+)$/);
    if (me && !exampleRaw) exampleRaw = me[1].trim();
  }

  const m = raw.match(DELIMITER);
  const hasDelimiter = Boolean(m);
  const body = hasDelimiter ? raw.slice(m.index + m[0].length).trim() : stripHeader(lines);

  const style = normStyle(styleRaw);
  return {
    style,
    styleRaw,
    styleLabel: STYLE_LABEL[style],
    example: normExample(exampleRaw),
    exampleRaw,
    body,
    hasDelimiter,
  };
}

const posix = (p) => String(p).replace(/\\/g, "/");

/**
 * 物化任务包：写 body 文件 + task 单，返回 task 对象。
 * prompt 由 renderPrompt() 单独渲染（模板可能缺失，不在此处强依赖）。
 */
export function buildTask({ id, hostId, label, message, outDir, skillDir }) {
  const env = parseEnvelope(message);
  mkdirSync(outDir, { recursive: true });

  const bodyFile = join(outDir, `body-${id}.txt`);
  const answerFile = join(outDir, `sub-answer-${id}.md`);
  const taskFile = join(outDir, `task-${id}.json`);
  const promptFile = join(outDir, `prompt-${id}.md`);

  writeFileSync(bodyFile, env.body + "\n", "utf8");

  const replyMjs = join(skillDir, "scripts", "reply.mjs");
  const checkMjs = join(skillDir, "scripts", "answer-check.mjs");

  const task = {
    id,
    hostId,
    label,
    receivedAt: new Date().toISOString(),
    style: env.style,
    styleRaw: env.styleRaw,
    styleLabel: env.styleLabel,
    example: env.example,
    exampleRaw: env.exampleRaw,
    hasDelimiter: env.hasDelimiter,
    bodyChars: env.body.replace(/\s+/g, "").length,
    bodyFile: posix(bodyFile),
    answerFile: posix(answerFile),
    taskFile: posix(taskFile),
    promptFile: posix(promptFile),
    skillDir: posix(skillDir),
    replyCmd: `node "${posix(replyMjs)}" --id ${id} --file "${posix(answerFile)}"`,
    checkCmd: `node "${posix(checkMjs)}" --file "${posix(answerFile)}" --style ${env.style}`,
  };

  writeFileSync(taskFile, JSON.stringify(task, null, 2) + "\n", "utf8");
  return task;
}

/** 模板占位符替换；未定义的占位符原样保留（便于一眼看出漏配） */
export function renderPrompt(template, task) {
  const vars = {
    ID: task.id,
    HOST_ID: task.hostId,
    STYLE: task.style,
    STYLE_LABEL: task.styleLabel,
    EXAMPLE: task.example ? "要" : "不要",
    EXAMPLE_FLAG: task.example ? "1" : "0",
    BODY_CHARS: String(task.bodyChars),
    BODY_FILE: task.bodyFile,
    ANSWER_FILE: task.answerFile,
    TASK_FILE: task.taskFile,
    SKILL_DIR: task.skillDir,
    REPLY_CMD: task.replyCmd,
    CHECK_CMD: task.checkCmd,
  };
  return String(template).replace(/\{\{([A-Z_]+)\}\}/g, (m0, k) => (k in vars ? vars[k] : m0));
}
