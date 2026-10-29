# 第三方被调用技能清单（Vendored Skills）

本目录存放从 **WorkBuddy 内置技能市场** 下载的第三方技能。它们在本项目中作为**被调用者（callee）**：由我们的流程以「其 SKILL.md 作为系统提示词 + 用户输入作为用户消息」的方式驱动 LLM 执行，**不修改技能原文**。

## 来源与下载方式（4 个技能统一）

| 项 | 值 |
|---|---|
| 来源 | WorkBuddy 内置技能市场（**不是** skills.sh / `npx skills` / skills-manager-cli 生态） |
| 下载方式 | 技能市场检索安装工具 `search_and_install_skills`（`action=install`，`skill_names` 传下方 name）；或在 WorkBuddy 应用内技能市场页安装 |
| 更新方式 | 市场**无独立 update 命令**，重新执行安装即覆盖更新；更新前先对比本表 version 与各技能 `_skillhub_meta.json` 的 version，有变化再重新安装并同步本目录副本 |
| 安装落点（用户级） | `%USERPROFILE%\.workbuddy\skills\<name>\` |
| 本目录性质 | vendored 副本（2026-10-24 复制），保留 `_skillhub_meta.json` 作为来源凭据 |

## 技能清单

| name | 显示名 | 版本 | skillId | 能力 | 在本项目中的角色 |
|---|---|---|---|---|---|
| agent-buddy | Agent Buddy · Prompt 陪练教练 | 1.0.5 | skill_2095548767091728384 | 五维（RCTFC）诊断 + 0-10 打分 + 三档改写 + 原理讲解 | **主被调用者**：用户提示词先喂给它 |
| prompt-expert | 提示词专家 | 1.0.0 | skill_2096325585720541184 | 五层黄金架构铸造 prompt，100 分制评分门禁（≥95 交付） | 备用裁判（后续轮次接入） |
| prompt-engineering-studio | 提示词工程工坊 | 1.0.0 | skill_2107275620390916096 | CO-STAR / CRISPE / RISEN 框架模板化生成 | 备用参考 |
| prompt-engineering-expert | 提示词工程专家 | 1.0.1 | skill_2053083323789344768 | 提示词编写 / 分析 / 优化 | 备用参考 |

## 注意事项

- 副本用于项目自洽与版本冻结；市场更新后需**人工同步**（重新安装 → 对比版本 → 重新复制）。
- 各技能 LICENSE 随副本保留（agent-buddy 为 MIT，作者：简一）。
- 调用契约（JSON 摘要附加约定）见项目根 `README.md` 的「被调用者契约」一节；契约由调用方在系统提示词末尾追加，不写进技能原文。
