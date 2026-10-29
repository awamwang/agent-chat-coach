#!/usr/bin/env node
/**
 * agent-chat-coach · 外接网页桥启动器
 *
 * 一条命令把「教练外部页」接到 8913 常驻桥：
 *   1. 同步页面   web/coach.html → <bridge>/web/coach.html（内容相同则跳过）
 *   2. 起服务     端口没起就 detached 拉起 server/index.js，等健康检查通过
 *   3. 报状态     服务 / 页面 / 宿主 / MCP 注册与信任
 *
 * 用法（绝对路径跑，别依赖 cwd）：
 *   node <skill-root>\scripts\bridge.mjs
 *   node ...\bridge.mjs --init      检查宿主桥通信的支持环境是否成立（只读）
 *   node ...\bridge.mjs --check     只体检，不动任何东西
 *   node ...\bridge.mjs --sync      只同步页面
 *   node ...\bridge.mjs --start     只起服务（已在跑就复用）
 *   node ...\bridge.mjs --open      起好后顺手打开浏览器
 *
 * 桥仓库路径默认取技能目录的兄弟位置（<skill-root>\..\..\workbuddy-bidge），
 * 换机器或换布局时用环境变量 BRIDGE_REPO 覆盖。
 * 零第三方依赖，Node >= 18。
 */

import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = process.env.BRIDGE_REPO || resolve(SKILL_DIR, "..", "..", "workbuddy-bidge");
const PORT = Number(process.env.BRIDGE_PORT || 8913);
const BASE = `http://127.0.0.1:${PORT}`;

const PAGE_SRC = join(SKILL_DIR, "web", "coach.html");
const PAGE_DST = join(REPO, "web", "coach.html");
const URL_COACH = `http://localhost:${PORT}/web/coach.html`;

const args = new Set(process.argv.slice(2));
const onlyInit = args.has("--init");
const onlyCheck = args.has("--check");
const onlySync = args.has("--sync");
const onlyStart = args.has("--start");
const wantOpen = args.has("--open");

const log = (...a) => console.log(...a);
const ok = (s) => log(`  \u2713 ${s}`);
const warn = (s) => log(`  ! ${s}`);
const bad = (s) => log(`  \u2717 ${s}`);

/* ---------- 1. 同步页面 ---------- */
function syncPage() {
  if (!existsSync(PAGE_SRC)) {
    bad(`技能里缺页面：${PAGE_SRC}`);
    return false;
  }
  if (!existsSync(join(REPO, "web"))) {
    bad(`桥仓库路径不对（找不到 ${join(REPO, "web")}）：${REPO}`);
    return false;
  }
  const src = readFileSync(PAGE_SRC, "utf8");
  const dst = existsSync(PAGE_DST) ? readFileSync(PAGE_DST, "utf8") : null;
  if (dst === src) {
    ok(`页面已是最新：web/coach.html（${(src.length / 1024).toFixed(1)} KB）`);
    return true;
  }
  writeFileSync(PAGE_DST, src, "utf8");
  ok(`页面已同步 → ${PAGE_DST}${dst === null ? "（新增）" : "（有改动）"}`);
  return true;
}

/* ---------- 2. 探活 ---------- */
async function probe() {
  try {
    const r = await fetch(`${BASE}/web/state`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return { up: false, reason: `HTTP ${r.status}` };
    const data = await r.json();
    return { up: true, data };
  } catch (e) {
    return { up: false, reason: e.name === "TimeoutError" ? "超时" : e.message };
  }
}

async function waitUp(timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const p = await probe();
    if (p.up) return p;
    await new Promise((r) => setTimeout(r, 400));
  }
  return { up: false, reason: "健康检查超时" };
}

/* ---------- 3. 起服务 ---------- */
async function startServer() {
  const p = await probe();
  if (p.up) {
    ok(`服务已在 ${PORT} 运行（复用，不重复起）`);
    return p;
  }
  if (!existsSync(join(REPO, "server", "index.js"))) {
    bad(`桥仓库不完整：${REPO}\\server\\index.js 不存在`);
    return p;
  }
  if (!existsSync(join(REPO, "node_modules"))) {
    warn("仓库缺 node_modules，先跑一次 npm install（或 awam-external-bridge 的 prepare-env 脚本）");
  }
  log(`  · 端口 ${PORT} 空闲（${p.reason}），拉起 server/index.js…`);

  // detached：不阻塞本进程，也不吃本进程的 stdio。注意会话结束后可能被环境回收，
  // 要跨会话常驻请让用户双击仓库里的 start-keepalive.cmd。
  const child = spawn(process.execPath, [join("server", "index.js")], {
    cwd: REPO,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, PORT: String(PORT) },
  });
  child.unref();

  const up = await waitUp();
  if (up.up) {
    ok(`服务已起（pid ${child.pid}），${BASE}/web/state 正常`);
    return up;
  }
  bad(`服务没起来：${up.reason}`);
  warn("手动排查：cd 到桥仓库跑 `npm start` 看报错；端口被占先确认是不是旧实例");
  return up;
}

/* ---------- 4. 体检：页面 / MCP 注册 / 信任 ---------- */
function reportPage() {
  const synced = existsSync(PAGE_DST) &&
    existsSync(PAGE_SRC) &&
    readFileSync(PAGE_DST, "utf8") === readFileSync(PAGE_SRC, "utf8");
  if (synced) ok(`外部页面就位：${URL_COACH}`);
  else bad("外部页面未同步或已过期，跑 --sync");
}

function reportRegistration() {
  const mcpPath = join(homedir(), ".workbuddy", "mcp.json");
  let mcpOk = false;
  try {
    const j = JSON.parse(readFileSync(mcpPath, "utf8"));
    const e = (j.mcpServers || {})["external-bridge"];
    mcpOk = !!(e && String(e.url || "").includes(String(PORT)));
  } catch { /* 文件不存在或有语法错 */ }
  if (mcpOk) ok(`MCP 已注册：external-bridge → ${BASE}/mcp`);
  else bad("mcp.json 里没有 external-bridge（跑 awam-external-bridge 的 prepare-env 脚本）");

  const apprPath = join(homedir(), ".workbuddy", "mcp-approvals.json");
  let trusted = false;
  try {
    const j = JSON.parse(readFileSync(apprPath, "utf8"));
    trusted = Object.keys(j).some((k) => k.endsWith("::external-bridge"));
  } catch { /* ignore */ }
  if (trusted) ok("连接器已信任（会话里有 render_bridge_view 就算齐）");
  else warn("未检测到信任记录：左下角「+」→ 连接器管理 → 自定义连接器 → external-bridge → 信任；信任后要新开会话");
}

function reportHosts(state) {
  const hosts = (state && state.hosts) || [];
  const alive = hosts.filter((h) => h.online === true && (h.aliveMs || 0) < 30000);
  if (alive.length) {
    ok(`${alive.length} 个宿主在线：${alive.map((h) => `${h.label}（待判 ${h.pendingCount || 0}）`).join("、")}`);
  } else {
    warn("当前没有在线宿主 —— 网页会报「链路不通」。在宿主会话里调用 render_bridge_view 挂出常驻桥");
  }
  if (state && typeof state.pendingCount === "number") {
    log(`  · 队列等待 ${state.pendingCount} 条`);
  }
}

/* ---------- init：宿主桥通信的支持环境检查（严格只读） ---------- */
function listenBind() {
  // 从 netstat 读端口实际绑定地址：判断是否只监听本机
  try {
    const out = execFileSync("netstat", ["-ano"], { encoding: "utf8", windowsHide: true });
    const row = out
      .split(/\r?\n/)
      .find((l) => /LISTEN/i.test(l) && new RegExp(`[:.]${PORT}\\s`).test(l));
    if (!row) return null;
    const cols = row.trim().split(/\s+/);
    const local = cols[1] || "";
    return { local, bind: local.replace(/:\d+$/, ""), pid: cols[cols.length - 1] || "" };
  } catch {
    return null;
  }
}

function mcpRegistered() {
  try {
    const j = JSON.parse(readFileSync(join(homedir(), ".workbuddy", "mcp.json"), "utf8"));
    const e = (j.mcpServers || {})["external-bridge"];
    return !!(e && String(e.url || "").includes(String(PORT)));
  } catch {
    return false;
  }
}

function connectorTrusted() {
  try {
    const j = JSON.parse(readFileSync(join(homedir(), ".workbuddy", "mcp-approvals.json"), "utf8"));
    return Object.keys(j).some((k) => k.endsWith("::external-bridge"));
  } catch {
    return false;
  }
}

async function initEnv() {
  const R = [];
  const add = (level, name, detail) => R.push({ level, name, detail });

  // 1 Node
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 18) add("ok", "Node 运行时", `v${process.versions.node}（要求 ≥ 18）`);
  else add("fatal", "Node 运行时", `v${process.versions.node}，需要 ≥ 18`);

  // 2 桥仓库
  const need = [["server/index.js", "服务入口"], ["package.json", "依赖清单"], ["web", "页面目录"]];
  const miss = need.filter(([f]) => !existsSync(join(REPO, f))).map(([f]) => f);
  if (!miss.length) add("ok", "桥仓库", REPO);
  else add("fatal", "桥仓库", `缺 ${miss.join("、")}；当前路径 ${REPO}`);

  // 3 依赖
  if (existsSync(join(REPO, "node_modules", "express"))) add("ok", "服务端依赖", "node_modules/express 就位");
  else add("fatal", "服务端依赖", `缺 node_modules，在 ${REPO} 跑 npm install`);

  // 4 教练页（技能侧）
  if (existsSync(PAGE_SRC)) {
    add("ok", "教练页面", `web/coach.html ${(readFileSync(PAGE_SRC, "utf8").length / 1024).toFixed(1)} KB`);
  } else add("fatal", "教练页面", `缺 ${PAGE_SRC}`);

  // 5 页面同步
  const synced =
    existsSync(PAGE_SRC) && existsSync(PAGE_DST) &&
    readFileSync(PAGE_SRC, "utf8") === readFileSync(PAGE_DST, "utf8");
  if (synced) add("ok", "页面同步", "桥仓库与技能侧一致");
  else add("warn", "页面同步", "桥仓库里的页面缺失或过期，跑 --sync 可修");

  // 6 服务在线
  const p = await probe();
  if (p.up) add("ok", "桥服务", `${BASE} 在线`);
  else add("warn", "桥服务", `未起（${p.reason}），跑一次不带参数的 bridge.mjs 即可拉起`);

  // 7 监听范围（安全）
  const li = listenBind();
  if (!li) {
    add("warn", "监听范围", "读不到 netstat（服务未起或权限不足），无法判断是否仅本机");
  } else if (/^(127\.0\.0\.1|::1|\[::1\])$/.test(li.bind)) {
    add("ok", "监听范围", `仅本机 ${li.local}`);
  } else {
    add("warn", "监听范围", `${li.local} 全网卡监听且页面无鉴权——同网段设备可直接提交；收敛需 listen(PORT,"127.0.0.1") 或防火墙`);
  }

  // 8 MCP 注册 / 9 信任
  if (mcpRegistered()) add("ok", "MCP 注册", `external-bridge → ${BASE}/mcp`);
  else add("warn", "MCP 注册", "mcp.json 里没有 external-bridge（面板挂桥要用；无面板宿主不需要）");
  if (connectorTrusted()) add("ok", "连接器信任", "已有信任记录");
  else add("warn", "连接器信任", "无信任记录；面板挂桥需在连接器管理里信任并新开会话（无面板宿主不需要）");

  // 10 宿主在线
  if (p.up) {
    const alive = ((p.data && p.data.hosts) || []).filter((h) => h.online === true && (h.aliveMs || 0) < 30000);
    if (alive.length) add("ok", "在线宿主", alive.map((h) => `${h.label}（待判 ${h.pendingCount || 0}）`).join("、"));
    else add("warn", "在线宿主", "无在线宿主——网页会报「链路不通」，需挂 host.mjs 心跳或 render_bridge_view");
  } else {
    add("warn", "在线宿主", "服务未起，无法检查");
  }

  // 11 辅助脚本
  const helpers = ["scripts/host.mjs", "scripts/reply.mjs", "open-coach.cmd"];
  const lack = helpers.filter((f) => !existsSync(join(SKILL_DIR, f)));
  if (!lack.length) add("ok", "辅助脚本", "host.mjs / reply.mjs / open-coach.cmd 齐");
  else add("fatal", "辅助脚本", `缺 ${lack.join("、")}（技能目录被裁剪？）`);

  // 12 跨会话常驻
  if (existsSync(join(REPO, "start-keepalive.cmd"))) add("ok", "跨会话常驻", "start-keepalive.cmd 在桥仓库");
  else add("warn", "跨会话常驻", "桥仓库缺 start-keepalive.cmd，服务活不过会话");

  log("\n[init · 宿主桥通信支持环境]");
  const mark = { ok: "\u2713", warn: "!", fatal: "\u2717" };
  // 中文占两列，padEnd 按字符数算会对不齐
  const dw = (s) =>
    [...s].reduce(
      (n, c) => n + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/.test(c) ? 2 : 1),
      0
    );
  const pad = (s, n) => s + " ".repeat(Math.max(1, n - dw(s)));
  for (const r of R) log(`  ${mark[r.level]} ${pad(r.name, 14)} ${r.detail}`);

  const fatal = R.filter((r) => r.level === "fatal").length;
  const warn = R.filter((r) => r.level === "warn").length;
  log("\n" + "-".repeat(46));
  if (fatal) log(`结论：支持环境**不成立**（${fatal} 项致命 / ${warn} 项待处理）——先修致命项，别硬开。`);
  else if (warn) log(`结论：支持环境**成立**（0 项致命 / ${warn} 项待处理，不影响启动）。`);
  else log("结论：支持环境**成立**，全部就绪。");
  log(`外部页面：${URL_COACH}\n`);
  return { fatal, warn, results: R };
}

/* ---------- main ---------- */
(async () => {
  log("\n反向输出师 · 外接网页桥\n" + "=".repeat(46));
  log(`技能目录：${SKILL_DIR}`);
  log(`桥仓库　：${REPO}`);

  if (onlyInit) {
    const r = await initEnv();
    process.exitCode = r.fatal > 0 ? 1 : 0;
    return;
  }

  if (onlyCheck) {
    log("\n[体检]");
    reportPage();
    const p = await probe();
    if (p.up) ok(`服务在线：${BASE}（${PORT}）`);
    else bad(`服务未起：${p.reason}`);
    reportRegistration();
    if (p.up) reportHosts(p.data);
    log(`\n外部页面：${URL_COACH}\n`);
    return;
  }

  if (onlySync) {
    log("\n[同步页面]");
    syncPage();
    log("");
    return;
  }

  log("\n[1/3 同步页面]");
  const pageOk = syncPage();

  log("\n[2/3 服务]");
  const p = onlyStart ? await startServer() : await startServer();

  log("\n[3/3 状态]");
  if (pageOk) reportPage();
  reportRegistration();
  if (p.up) reportHosts(p.data);

  log(`\n外部页面：${URL_COACH}`);
  if (!wantOpen) {
    log("下一步（Agent 侧）：在当前会话调用 render_bridge_view 挂出常驻桥，然后把上面链接发给用户。");
    log("要跨会话常驻：让用户双击 " + join(REPO, "start-keepalive.cmd") + "\n");
    return;
  }
  try {
    const { exec } = await import("node:child_process");
    exec(`start "" "${URL_COACH}"`, { shell: "cmd.exe" });
    log("已在默认浏览器打开。\n");
  } catch (e) {
    warn(`自动打开失败（${e.message}），手动访问上面的链接`);
  }
})();
