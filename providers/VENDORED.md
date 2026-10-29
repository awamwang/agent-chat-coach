# 第三方被调用技能清单（Vendored Skills）

从 **WorkBuddy 内置技能市场** 下载的第三方技能，在本项目中作为**被调用者（callee）**：以「其 SKILL.md 作为系统提示词 + 用户输入作为用户消息」驱动 LLM 执行，**不修改技能原文**。

落点按角色分流：

| 角色 | 目录 | 说明 |
|---|---|---|
| Provider | `providers/<name>/` | 评价能力；与第一方 `providers/free/` 并列 |
| 范例生成器 | `generators/<name>/` | 不参与判定；见 `generators.md` |

## 来源与下载方式

| 项 | 值 |
|---|---|
| 来源 | WorkBuddy 内置技能市场（**不是** skills.sh / `npx skills` / skills-manager-cli 生态） |
| 下载方式 | 技能市场检索安装工具 `search_and_install_skills`（`action=install`，`skill_names` 传下方 name）；或在 WorkBuddy 应用内技能市场页安装 |
| 更新方式 | 市场**无独立 update 命令**，重新执行安装即覆盖更新；更新前先对比本表 version 与各技能 `_skillhub_meta.json` 的 version，有变化再重新安装并同步副本 |
| 安装落点（用户级） | `%USERPROFILE%\.workbuddy\skills\<name>\` |
| 本仓副本性质 | vendored（2026-10-24 复制；目录整理后仍保留 `_skillhub_meta.json` 作为来源凭据） |

## 技能清单

| name | 显示名 | 版本 | skillId | 能力 | 落点 | 在本项目中的角色 |
|---|---|---|---|---|---|---|
| agent-buddy | Agent Buddy · Prompt 陪练教练 | 1.0.5 | skill_2095548767091728384 | 五维（RCTFC）诊断 + 0-10 打分 + 三档改写 + 原理讲解 | `providers/agent-buddy/` | **备用 Provider**（free 不可用时回退） |
| prompt-expert | 提示词专家 | 1.0.0 | skill_2096325585720541184 | 五层黄金架构铸造 prompt，100 分制评分门禁（≥95 交付） | `providers/prompt-expert/` | 可接入 Provider（未接） |
| prompt-engineering-expert | 提示词工程专家 | 1.0.1 | skill_2053083323789344768 | 提示词编写 / 分析 / 优化 | `providers/prompt-engineering-expert/` | 可接入 Provider（未接） |
| prompt-engineering-studio | 提示词工程工坊 | 1.0.0 | skill_2107275620390916096 | CO-STAR / CRISPE / RISEN 框架模板化生成 | `generators/prompt-engineering-studio/` | **范例生成器**（不作为 Provider） |

契约与调度口径见根目录 `providers.md` / `generators.md`；第一方 free Provider 不在本表（非市场 vendored）。

## 注意事项

- 副本用于项目自洽与版本冻结；市场更新后需**人工同步**（重新安装 → 对比版本 → 重新复制到上表落点）。
- 各技能 LICENSE 随副本保留（agent-buddy 为 MIT，作者：简一）。
- 调用契约（JSON 摘要附加约定）由调用方在系统提示词末尾追加，不写进技能原文。
