# 提示词专家（prompt-expert）— WorkBuddy 技能包

工程级提示词铸造、诊断、改写一站式引擎：一句话需求 → 五层黄金架构成品 → 100 分制评分门禁（≥95 才交付）→ Markdown 落盘。

> 本文档可随时导出为 PDF / Word / HTML 等主流格式。

---

## 一、包结构

```text
prompt-expert/
├── SKILL.md                          # ★ 唯一必需：frontmatter + 铸造/诊断流水线正文
├── references/
│   ├── prompt-architecture.md        # 五层黄金架构 + 十大铸造模式 + 翻车速查
│   ├── score-rubric.md               # 100 分制八维评分细则（评分脚本判分依据）
│   ├── domain-recipes.md             # 六大赛道配方（写作/代码/营销/教育/分析/系统提示词）
│   └── evolution-log.md              # 月度进化日志（首次 --bump 后自动生成）
├── scripts/
│   ├── prompt_score.py               # 评分门禁脚本（零依赖，含 --self-test 自检）
│   └── monthly_evolution.py          # 月度进化脚本（--check / --bump，零依赖）
└── README.md                         # 本文件
```

frontmatter 必填字段齐备：`name` / `display_name` / `display_name_en` / `description` / `description_zh` / `description_en` / `version` / `author`。

## 二、核心能力

| 模式 | 触发说法 | 产出 |
|---|---|---|
| A 铸造 | 「帮我写一个 xx 的提示词」「我要让 AI 做 xx」 | 五层架构成品 + 变量表 + 使用示例 + 评分表 + 假设清单（.md 文件） |
| B 诊断 | 「优化这段提示词」「为什么 AI 输出总跑偏」 | 原版分 vs 重铸分对比表 + 逐层诊断 + 新成品（.md 文件） |
| C 批量 | 多条需求清单 | 合并 .md（分节）+ 汇总评分表 |

质量保证：每条成品必须通过 `scripts/prompt_score.py` 评分 ≥95 分才交付；评分维度与阈值公开可复跑，不靠自我感觉。

## 三、本地安装（本机立即可用，免审核）

1. 将 `prompt-expert/` 整个目录复制到：
   - 用户级（推荐）：`C:\Users\Administrator\.workbuddy\skills\prompt-expert\`
2. 重启 WorkBuddy 客户端或执行 `/reload-skills` 生效。
3. 验证：`python scripts/prompt_score.py --self-test` 应输出 `PASS`。

## 四、上传开放平台发布（全网可见，约 7 个工作日审核）

1. 打开 open.workbuddy.cn 并登录 → 「技能」→ 上传技能包；
2. 上传本技能包 `prompt-expert.zip`（顶层即单一项目目录 `prompt-expert/`，解压即用）；
3. 表单单独上传技能图标：**512×512 像素，建议 ≤500KB**（图标是表单独立上传项，平台不从 zip 内读取，需自备）；
4. 平台解析确认 → 提交审核 → 审核通过后发布。
5. 解析失败自查：目录名必须与 SKILL.md 的 `name` 字段一致（`prompt-expert`）；仍失败邮件 openworkbuddy@tencent.com。

## 五、使用示例

- 示例 1（铸造）：「我要一个让 AI 写小红书爆文的提示词」→ 得到含受众/卖点/禁用词变量的五层成品，评分 98/100。
- 示例 2（诊断）：「这段提示词为什么 AI 老编数据？<原文>」→ 诊断出 L3 缺信息边界与防编造声明，重铸后 61 → 97 分。
- 示例 3（月度进化）：每月 1 日运行 `python scripts/monthly_evolution.py --check`，按清单更新知识库。

## 六、版本

- v1.0.0（2026-09-05）：首发。五层黄金架构铸造 + 八维评分门禁 + B 诊断模式 + C 批量模式 + 三波次联网增强协议 + 月度进化脚本。
