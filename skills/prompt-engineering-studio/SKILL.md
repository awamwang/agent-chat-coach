---
name: prompt-engineering-studio
display_name: "提示词工程工坊"
display_name_en: "Prompt Engineering Studio"
description: "提示词工程工坊——把模糊的想法或任务，结构化、可复用地转成高质量 AI 提示词（prompt）。覆盖角色设定、任务拆解、上下文、约束、输出格式、少样本示例与迭代优化，内置 CO-STAR、CRISPE、RISEN 等主流框架，输出简体中文/繁体中文/英文/日文四语提示词与多版本变体并打分排序。触发词：写提示词、prompt 怎么写、优化 prompt、提示词模板、AI 指令、系统提示词、角色设定、few-shot、结构化提示词、提示词工程、prompt engineering、system prompt。工作流：收集简报（任务/角色/背景/约束/格式/语言）→ 选框架 → 套多语言模板 → 出多版本 → 评分排序 → 迭代优化建议。"
description_zh: "提示词工程工坊是一款零门槛的 AI 提示词（prompt）设计与优化工具，帮助用户把含糊的需求转化为专业、结构化、可直接投喂给任意大模型（ChatGPT、Claude、Gemini、文心、通义、Kimi 等）的高质量指令。它内置 CO-STAR、CRISPE、RISEN 等业界主流框架与可填空模板，自动补齐角色、任务、上下文、约束、输出格式、少样本示例等要素，并支持简体中文、繁体中文、英文、日文四语输出与多版本变体评分。适用于写系统提示词、客服/写作/分析类指令、自动化工作流提示、教学示例、API 调用模板等场景，让不会写 prompt 的人也能稳定拿到好结果。搭配 提示词工程、prompt engineering、写提示词、优化 prompt、AI 指令、system prompt、角色设定 等关键词可被发现。"
description_en: "Prompt Engineering Studio turns vague requests into professional, structured, reusable prompts for any LLM (ChatGPT, Claude, Gemini, Ernie, Qwen, Kimi and more). It ships mainstream frameworks (CO-STAR, CRISPE, RISEN), fill-in-the-blank templates, and auto-completes the role, task, context, constraints, output format and few-shot examples. It outputs in Simplified Chinese, Traditional Chinese, English and Japanese, and generates multiple scored variants. Perfect for system prompts, customer-service or writing instructions, automation workflows and teaching examples. Keywords: prompt engineering, write a prompt, optimize prompt, AI instruction, system prompt, role setting, few-shot, structured prompt."
category: productivity
version: 1.0.0
author: 汪老师
---

# 提示词工程工坊 (prompt-engineering-studio)

把"帮我写段话让 AI 帮我做 X"变成"可以直接复制粘贴的专家级 prompt"。本 skill 是**提示词工程方法论 + 多语言模板 + 变体生成器**，不依赖任何特定大模型 API——你在 ChatGPT、Claude、Gemini、文心一言、通义千问、Kimi、WorkBuddy 等任意平台都能用；若运行环境自带对话/生成工具，也可直接调用生成。

## 何时用（触发场景）
- 想用 AI 做事但"不知道指令怎么写 / 写得效果不好"
- 要写系统提示词（system prompt）、角色设定、自动化工作流提示
- 需要**跨语言** prompt（英文在多数模型上更稳定，中文在国产模型上更直接）
- 要批量产出同一任务的不同结构 / 不同框架变体并择优
- 想给团队沉淀"可复用提示词模板"

## 六步工作流
1. **收集简报**（intake）——用 `assets/prompt_brief.md` 引导用户填：任务、角色、背景、约束、输出格式、受众、示例、目标语言、偏好框架。
2. **选框架**——参考 `references/frameworks.md`：CO-STAR（上下文/任务/风格/语气/受众/格式）、CRISPE（能力/角色/步骤/个性/实验）、RISEN（角色/指令/补充/敏感度/例子/规范）。
3. **套多语言模板**——参考 `references/templates-multilang.md`，按目标语言（简中/繁中/英/日）生成。
4. **出多版本变体**——跑 `scripts/generate_prompts.py`，一次产出 3–5 条不同结构 / 框架的 prompt 并打分排序。
5. **给迭代优化建议**——参考 `references/iterative-optimization.md`，指出每条变体的可改进点（加约束、补示例、限格式、降歧义）。
6. **合规过筛**——参考 `references/compliance.md`：只做"提示词工程"，不指导越狱、绕过安全审核、生成违规内容。

## 核心交付
- 1 份结构化主 prompt（可直接粘贴）
- 3–5 条变体（不同框架 / 结构 / 侧重）
- 目标语言版本（简中/繁中/英/日）
- 每条变体的评分（角色/任务/约束/结构/可复用性/格式）与改进建议

## 文件索引
- `references/frameworks.md`——CO-STAR / CRISPE / RISEN 框架详解与选用指南
- `references/prompt-anatomy.md`——提示词七大要素拆解（角色/任务/上下文/约束/格式/示例/语气）
- `references/templates-multilang.md`——四语可填空模板
- `references/iterative-optimization.md`——迭代优化方法与常见失败模式
- `references/examples-multi-industry.md`——多行业 before/after 案例
- `references/compliance.md`——安全与合规边界（不教越狱/违规）
- `scripts/generate_prompts.py`——变体生成 + 评分 + 改进建议（纯标准库）
- `assets/prompt_brief.md`——intake 简报清单

## 合规底线（必读）
本 skill 只做"提示词工程"，不替代模型、不规避平台安全规则：
- 不指导生成用于越狱（jailbreak）、绕过安全审核、规避内容政策的提示词；
- 不协助生成欺诈、侵权、违法、侵犯隐私、仇恨、成人或虚假信息类内容；
- 商用或接入业务前，提醒用户确认数据合规与平台条款。
