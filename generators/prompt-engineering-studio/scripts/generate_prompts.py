#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prompt-engineering-studio: 多语言 AI 提示词变体生成与评分器。

用法:
  python generate_prompts.py --brief brief.json --lang zh-CN --count 5 --out result.md

brief.json 字段（请用【目标语言】填写内容，脚本只本地化结构标签与连接词）:
  task / objective   任务（必填，动词开头，如：总结这篇长文的核心观点）
  role               角色（可选，如：资深产品经理）
  context            背景（可选）
  constraints        约束（可选，如：不超过 200 字、用中文）
  style              风格（可选）
  tone               语气（可选，如：专业客观）
  audience           受众（可选）
  output_format      输出格式（可选，如：Markdown 表格）
  examples           少样本示例（可选，如：输入A→输出B）
  framework          偏好框架（可选：CO-STAR / CRISPE / RISEN）
  language           目标语言（可选，覆盖 --lang）
"""

import argparse
import json
import sys

# ---------- 英文角色冠词处理（先判已有，避免 "An a ..."） ----------
def en_role(v):
    low = (v or "").strip().lower()
    if low.startswith(("a ", "an ", "the ")):
        return v
    return ("An " if low[:1] in "aeiou" else "A ") + v


# ---------- 分段渲染（key=字段, value=语言专属句式积木） ----------
# 每个 seg 返回"不含结尾标点"的片段，统一由 joiner/end 收尾。
LANG_CFG = {
    "zh-CN": {
        "join": "，", "end": "。",
        "seg": {
            "role": lambda v: f"你是一位{v}",
            "context": lambda v: f"背景：{v}",
            "objective": lambda v: f"任务：{v}",
            "constraints": lambda v: f"约束：{v}",
            "style": lambda v: f"风格：{v}",
            "tone": lambda v: f"语气：{v}",
            "audience": lambda v: f"受众：{v}",
            "response": lambda v: f"输出格式：{v}",
            "examples": lambda v: f"示例：{v}",
        },
    },
    "zh-TW": {
        "join": "，", "end": "。",
        "seg": {
            "role": lambda v: f"你是一位{v}",
            "context": lambda v: f"背景：{v}",
            "objective": lambda v: f"任務：{v}",
            "constraints": lambda v: f"約束：{v}",
            "style": lambda v: f"風格：{v}",
            "tone": lambda v: f"語氣：{v}",
            "audience": lambda v: f"受眾：{v}",
            "response": lambda v: f"輸出格式：{v}",
            "examples": lambda v: f"示例：{v}",
        },
    },
    "en": {
        "join": ", ", "end": ".",
        "seg": {
            "role": lambda v: f"You are {en_role(v)}",
            "context": lambda v: f"Context: {v}",
            "objective": lambda v: f"Task: {v}",
            "constraints": lambda v: f"Constraints: {v}",
            "style": lambda v: f"Style: {v}",
            "tone": lambda v: f"Tone: {v}",
            "audience": lambda v: f"Audience: {v}",
            "response": lambda v: f"Format: {v}",
            "examples": lambda v: f"Example: {v}",
        },
    },
    "ja": {
        "join": "、", "end": "。",
        "seg": {
            "role": lambda v: f"あなたは{v}として",
            "context": lambda v: f"背景：{v}",
            "objective": lambda v: f"目的：{v}",
            "constraints": lambda v: f"制約：{v}",
            "style": lambda v: f"スタイル：{v}",
            "tone": lambda v: f"トーン：{v}",
            "audience": lambda v: f"対象読者：{v}",
            "response": lambda v: f"出力形式：{v}",
            "examples": lambda v: f"例：{v}",
        },
    },
}

# 三档完整度（决定用哪些字段），同时映射框架名
TIERS = {
    "极简": (["objective", "constraints", "response"], "极简直接"),
    "标准": (["role", "context", "objective", "constraints", "style", "response"], "CO-STAR"),
    "专家": (["role", "context", "objective", "constraints", "style", "tone", "audience", "response"], "RISEN（含约束与示例）"),
}
TIER_ORDER = ["标准", "专家", "极简"]

# 评分权重（总和 100）
WEIGHT = {
    "role": 15, "context": 12, "objective": 20, "constraints": 15,
    "style": 10, "tone": 8, "audience": 10, "response": 10,
}

# 每条变体末尾追加的"增强指令"（prompt 内容，必须本地化），轮流用
BOOSTERS = {
    "zh-CN": [
        "请先列出步骤，再逐步完成。",
        "不确定之处请明确说明，不要编造。",
        "先给结论，再展开论证。",
        "严格按要求的格式输出，不要自由发挥。",
    ],
    "zh-TW": [
        "請先列出步驟，再逐步完成。",
        "不確定之處請明確說明，不要編造。",
        "先給結論，再展開論證。",
        "嚴格依要求的格式輸出，不要自由發揮。",
    ],
    "en": [
        "First outline the steps, then complete them one by one.",
        "If anything is uncertain, state it clearly instead of making things up.",
        "Give the conclusion first, then the reasoning.",
        "Strictly follow the requested format; do not improvise.",
    ],
    "ja": [
        "まず手順を列挙し、それから順に行ってください。",
        "不確かな点は明確に述べ、作り話をしないでください。",
        "結論を先に、その後に論証を。",
        "指定された形式を厳守し、勝手な展開はしないでください。",
    ],
}


def normalize(brief):
    return {
        "objective": brief.get("task") or brief.get("objective") or "",
        "role": brief.get("role") or "",
        "context": brief.get("context") or "",
        "constraints": brief.get("constraints") or "",
        "style": brief.get("style") or "",
        "tone": brief.get("tone") or "",
        "audience": brief.get("audience") or "",
        "response": brief.get("output_format") or brief.get("response") or "",
        "examples": brief.get("examples") or "",
        "framework": brief.get("framework") or "",
    }


def build_prompt(lang, fields, tier, booster):
    cfg = LANG_CFG[lang]
    seg = cfg["seg"]
    segs, _ = TIERS[tier]
    parts = []
    for f in segs:
        v = fields.get(f, "")
        if v:
            parts.append(seg[f](v))
    # 示例仅在标准/专家档追加
    if fields.get("examples") and tier in ("标准", "专家"):
        parts.append(seg["examples"](fields["examples"]))
    text = cfg["join"].join(parts) + cfg["end"]
    if booster:
        text = text + " " + booster
    return text


def score_prompt(fields, tier):
    segs, _ = TIERS[tier]
    s = 0
    for f in segs:
        if fields.get(f):
            s += WEIGHT.get(f, 0)
    # 示例额外加成（强效）
    if fields.get("examples") and tier in ("标准", "专家"):
        s += 5
    return min(s, 100)


def tips_for(fields):
    tips = []
    if not fields.get("role"):
        tips.append("补充角色（role）可收敛输出风格与口径")
    if not fields.get("constraints"):
        tips.append("加字数 / 禁项 / 语言约束可提升可控性")
    if not fields.get("response"):
        tips.append("指定输出格式（表格 / 列表 / JSON）可减少格式跑偏")
    if not fields.get("context"):
        tips.append("补充背景可让模型不瞎猜、更贴场景")
    if not fields.get("examples") and fields.get("objective"):
        tips.append("补 1–2 个 few-shot 示例可显著提升稳定性与格式一致性")
    return tips


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", required=True, help="简报 JSON 路径")
    ap.add_argument("--lang", default="zh-CN", choices=["zh-CN", "zh-TW", "en", "ja"])
    ap.add_argument("--count", type=int, default=5)
    ap.add_argument("--out", default="prompts_out.md")
    args = ap.parse_args()

    with open(args.brief, encoding="utf-8") as f:
        raw = json.load(f)
    fields = normalize(raw)

    lang = raw.get("language") or args.lang
    if lang not in LANG_CFG:
        lang = "zh-CN"

    if not fields["objective"]:
        print("❌ 简报缺少必填字段 task / objective，无法生成。")
        sys.exit(1)

    count = max(1, min(args.count, 9))
    results = []
    for i in range(count):
        tier = TIER_ORDER[i % len(TIER_ORDER)]
        # 框架偏好：若简报指定则覆盖档位名
        _, fw = TIERS[tier]
        if fields["framework"]:
            fw = fields["framework"]
        booster = BOOSTERS[lang][i % len(BOOSTERS[lang])] if tier != "极简" else ""
        prompt = build_prompt(lang, fields, tier, booster)
        sc = score_prompt(fields, tier)
        results.append((tier, fw, prompt, sc, tips_for(fields)))

    # 输出 markdown
    lines = []
    lines.append(f"# 提示词生成结果（{lang}）\n")
    lines.append("> 由 prompt-engineering-studio `generate_prompts.py` 生成。\n")
    lines.append("**简报摘要**：")
    lines.append(f"- 任务：{fields['objective'][:40]} ｜ 角色：{fields['role'] or '（未填）'} ｜ "
                 f"格式：{fields['response'] or '（未填）'} ｜ 语言：{lang}\n")
    for idx, (tier, fw, prompt, sc, tips) in enumerate(results, 1):
        rating = "优秀" if sc >= 85 else ("良好" if sc >= 60 else "基础")
        lines.append(f"## 变体 {idx}（{tier}档 · {fw} · {rating} {sc}分）\n")
        lines.append("**Prompt：**\n")
        lines.append(f"```\n{prompt}\n```\n")
        if tips:
            lines.append("**改进建议**：")
            lines.append("；".join(tips) + "。\n")
        lines.append("")

    lines.append("---\n")
    lines.append("## 使用提示\n")
    lines.append("- 英文 prompt 在多数大模型上更稳；中文在国产模型（文心 / 通义 / Kimi）上更直接。\n")
    lines.append("- 同一任务建议中英两版分别测试，挑稳的那版沉淀为模板。\n")
    lines.append("- **合规**：本工具只做提示词工程，不教越狱 / 绕过安全审核 / 生成违规内容。\n")

    out_text = "\n".join(lines)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(out_text)
    print(f"已生成 {count} 条提示词 -> {args.out}")
    for idx, (tier, fw, prompt, sc, tips) in enumerate(results, 1):
        print(f"  变体{idx}[{tier}/{fw}] {sc}分: {prompt[:50]}...")


if __name__ == "__main__":
    main()
