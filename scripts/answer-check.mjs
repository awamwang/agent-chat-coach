#!/usr/bin/env node
/**
 * agent-chat-coach · 判定稿自检（回推前的质量闸门）
 *
 * 用法：
 *   node scripts\answer-check.mjs --file <回答.md> [--style objective|strict|brief] [--json]
 *
 * 退出码：0 = 通过（可能有 warnings）；2 = 不通过（有 errors）；1 = 文件读不到。
 * 判定规则见 scripts/lib/answer-quality.mjs（与 reply.mjs 共用同一份，避免两套口径）。
 */

import { readFileSync } from "node:fs";
import { checkAnswer } from "./lib/answer-quality.mjs";

function argOf(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
}

const file = argOf("--file");
const style = argOf("--style", "objective");
const asJson = process.argv.includes("--json");

if (!file) {
  console.error("用法：node scripts\\answer-check.mjs --file <回答.md> [--style objective|strict|brief] [--json]");
  process.exit(2);
}

let answer;
try {
  answer = readFileSync(file, "utf8");
} catch (e) {
  console.error(`读不到回答文件：${file}（${e.message}）`);
  process.exit(1);
}

const r = checkAnswer(answer, { style });

if (asJson) {
  console.log(JSON.stringify({ file, ...r }, null, 2));
} else {
  console.log(`[check] ${file}`);
  console.log(`  风格=${r.style}${r.isBrief ? "（按短稿宽松口径）" : ""} 字数=${r.chars}`);
  if (r.ok) console.log("  结果：通过");
  else console.log(`  结果：不通过（${r.errors.length} 项硬伤）`);
  for (const e of r.errors) console.log(`  ✗ ${e}`);
  for (const w of r.warnings) console.log(`  ! ${w}`);
  if (!r.ok) console.log("  → 改稿后重跑本命令，通过再回推。");
}

process.exit(r.ok ? 0 : 2);
