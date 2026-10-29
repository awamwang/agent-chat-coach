/**
 * agent-chat-coach · 回答质量闸门（LLM-free）
 *
 * 判定稿在回推网页前过一道结构检查，堵住实测踩过的坑：
 *   - 空稿 / 只有一句「测试」被当回答推上去
 *   - 模板占位符 {{...}} 没替换就推上去
 *   - <details> 只开不闭，网页折叠块渲染错乱
 *   - brief 风格被按 objective 口径误判（用长度 + --style 双向放宽）
 *
 * 分级：errors 阻断（拒绝回推）；warnings 仅提示。
 */

const CONCLUSION = /(无法判定|基本有效|无效|有效)/;
const PLACEHOLDER = /\{\{[A-Z_]+\}\}/;
const TODO = /(TODO|待补充|待填|请补写|\bxxx\b|占位待填)/i;
const ACTION = /(纠正方向|下一步|改法|建议改)/;

/**
 * @param {string} answer 判定稿全文
 * @param {{style?:string}} [opts] style: objective | strict | brief
 */
export function checkAnswer(answer, opts = {}) {
  const text = String(answer ?? "");
  const plain = text.replace(/\s+/g, "");
  const chars = plain.length;
  const style = opts.style || "objective";
  const errors = [];
  const warnings = [];

  // 空稿单独早退，避免叠出「缺结论词 / 缺折叠块」等一串噪音
  if (!chars) {
    return { ok: false, errors: ["回答为空"], warnings: [], style, isBrief: style === "brief", chars: 0 };
  }

  // 短稿走宽松口径：显式 brief，或确实只有一两句话（<80 字）。
  // 但**只要出现 <details>，就必须按完整口径验闭合**——否则折叠块写坏了也被放行
  // （这是实测踩到的坑：稿子短 + 只开不闭 → 网页折叠区整块渲染错乱）。
  const hasDetails = /<details/i.test(text);
  const isBrief = style === "brief" || (!hasDetails && chars < 80);
  const minChars = isBrief ? 8 : 20;

  if (chars < minChars) {
    errors.push(`回答过短（${chars} 字，低于 ${minChars} 字下限）`);
  }
  if (PLACEHOLDER.test(text)) errors.push("含未替换的模板占位符 {{...}}");
  if (TODO.test(text)) errors.push("含未完成占位（TODO / 待补充 / 请补写）");

  if (!isBrief) {
    if (!CONCLUSION.test(text)) {
      errors.push("缺结论词（无法判定 / 有效 / 基本有效 / 无效）");
    }
    const open = (text.match(/<details>/g) || []).length;
    const close = (text.match(/<\/details>/g) || []).length;
    if (open !== close) errors.push(`<details> 未闭合（开 ${open} / 闭 ${close}）`);
    else if (open === 0) warnings.push("缺存档折叠块 <details>（判定依据无处收纳）");
    if (!ACTION.test(text)) warnings.push("缺行动区（纠正方向 / 下一步）");
  }

  return { ok: errors.length === 0, errors, warnings, style, isBrief, chars };
}
