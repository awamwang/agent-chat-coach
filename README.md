# 反向输出师（agent-chat-coach）

> **实验性项目**：本仓库用于探索与验证「AI 沟通有效性判定」的思路与流程，**不具有生产实用性**，请勿用于正式业务或生产环境。

AI 沟通有效性教练：用户把「自己发给 AI 的提示词 / 一段聊天」喂进来，教练判定这段
沟通是否有效、给出纠正方向。**只判定 + 纠正，不代写、不执行。**

## 两个入口

```
                      ┌── 会话内：直接贴提示词 ──────────┐
用户 ─────────────────┤                                  ├──► 同一套五步流程 ──► 判定报告
                      └── 外部网页 coach.html ──8913 桥──┘        （判定口径一致）
```

| 入口 | 形态 | 适合 |
|---|---|---|
| 会话内 | 对话里贴提示词 | 随手判、追问、切风格、要范例 |
| 外部网页 | 浏览器 `http://localhost:8913/web/coach.html` | 长文本粘贴、判定与原文并排看、留档复盘 |

外部网页**不自带判定**：它经常驻桥把内容投递给宿主会话，教练在这里判完，结果经
SSE 回推网页。接入契约（消息信封 / 唤醒应答 / 页面部署 / 故障排查）见
**[bridge.md](bridge.md)**。

## 架构（v1.6）

```
用户输入（提示词 / 聊天记录）
   │
   ▼
┌──────────────────────────────────────────────┐
│ 第 2 步 · Provider 评判（providers.md）        │
│ 默认 free 自由 Provider（providers/free/）      │
│ LLM = 当前 Agent 本身（无第三方 API）           │
│ agent 场景评判：缺的信息先问工作空间能不能补     │
│ → 评价文本 + JSON 摘要（含验证建议字段）        │
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 第 3 步 · 工作空间验证环（workspace.md）        │
│ 条件触发：JSON 含可验证缺口                     │
│ 封闭 workspace 内真实执行（只进不出）           │
│ → 证据 + resolved / falsified / inconclusive  │
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 第 4 步 · 规则层判定（rules.md，R0-R4）         │
│ 验证并案：resolved→按2分、falsified→按0分重算   │
│ 独立结论：有效 / 基本有效 / 无效 / 无法判定       │
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 第 5 步 · 风格层渲染（styles.md）              │
│ 客观（默认）/ 严师 / 精简——只改话术，不改判定    │
│ 要范例 → generators.md（studio 优秀学生案例）   │
└──────────────────────────────────────────────┘
   │
   ▼
判定报告（固定骨架）+ 下一步指引
```

关键设计：

- **LLM 就是当前 Agent**：不调用第三方 API、不需要 API key。「喂给 Provider」
  = Agent 读取其指令文件并照此处理输入（in-context 执行）。
- **Provider 可插拔**：Provider = 后端对提示词具体评价的工具技能；默认
  **free 自由 Provider**（第一方，agent 场景、从宽口径），备用 agent-buddy；
  候选 prompt-expert 等按统一契约接入后切换（`providers.md`）。
- **验证环：文本级只能猜，agent 级可以试**：prompt 缺的信息若工作空间能给，
  进封闭工作空间跑一遍，用执行结果说话（`workspace.md`）。
- **判定权在规则层**：Provider 的打分只作参考，结论由 `rules.md` 独立给出。
- **风格是渲染层**：客观 / 严师 / 精简三风格只改话术不改判定（`styles.md`）；
  brief 为骨架例外（30 字以内一句话，追问可展开）。

## 目录结构

```
├── SKILL.md           # 技能入口：五步流程协议 + 调用方契约 + 两个入口
├── rules.md           # 规则层：R0-R4 + 验证环并案 + 答复定性 + 报告格式
├── providers.md       # Provider 层：评价能力提供者（概念/契约/清单/接入）
├── providers/         # Provider 落点（第一方 + vendored）
│   ├── free/SKILL.md  #   第一方默认：自由 Provider（agent 场景）
│   ├── agent-buddy/   #   备用 Provider v1.0.5（vendored）
│   ├── prompt-expert/ #   可接入（未接）
│   ├── prompt-engineering-expert/  # 可接入（未接）
│   └── VENDORED.md    #   第三方来源与落点登记
├── generators.md      # 范例生成器：studio 转任「优秀学生案例」
├── generators/        # 范例生成器落点（非 Provider）
│   └── prompt-engineering-studio/
├── workspace.md       # 封闭工作空间 + 验证环规范（安全纪律/重算语义）
├── styles.md          # 风格层：客观（默认）/ 严师 / 精简三风格定义
├── bridge.md          # 外接网页桥：协议 / 消息信封 / 唤醒应答 / 部署 / 排查
├── ROADMAP.md         # 后续设计：v2 对话循环 / v3 教学周期 / v4 多裁判
├── web/coach.html     # 教练专用外部页（源码在此，运行时同步进桥仓库 web/）
├── scripts/bridge.mjs # init 体检 / 同步页面 / 起 8913 服务 / 报状态（--init/--check/--sync）
├── open-coach.cmd    # 独立窗口启动器（Edge/Chrome 应用模式，无地址栏，独立 profile）
├── scripts/host.mjs   # 无面板宿主：--heartbeat 保在线 / 默认长挂等问题（收到即退出唤醒 Agent）
├── scripts/reply.mjs  # 把判定稿提交回网页（submit_answer 的 CLI 壳，幂等）
├── examples/          # 七轮实测答复（端到端样例，兼测试夹具）
│   ├── round-1-weak-prompt.md              # 「帮我写个周报」→ R3 无效
│   ├── round-2-conflicting-constraints.md  # 矛盾约束 → R2 无效（null 口径实证）
│   ├── round-3-borderline.md               # 4/5 维齐只缺约束 → 基本有效
│   ├── round-4-style-comparison.md         # 同输入双风格对照（风格不改判定实证）
│   ├── round-5-brief.md                    # 精简风格四档实例（≤30 字，含字数实证）
│   ├── round-6-free-provider-workspace.md  # free + 验证环 + 范例生成端到端实测
│   └── round-7-output-format.md            # 三区结构化输出格式测试（结论突出/存档折叠）
├── workspace/         # 封闭工作空间（验证实证产物与证据，可弃置重建）
├── docs/              # 调研等附属文档
│   └── AI沟通教练-同类工具调研对比.md
├── README.md
└── LICENSE
```

## 使用方式

v1 由 Agent 现场执行（任何加载了本技能的 Agent）：

> 用户：「反向输出师，帮我判定一下这个 prompt：帮我写个周报」
> Agent：按 `SKILL.md` 第 2 步执行 Provider 评价 →（有可验证缺口时）第 3 步
> 工作空间实测 → 按 `rules.md` 判定 → 按 `styles.md` 客观风格渲染报告

风格、Provider 与范例可在请求中一并指定：

> 用户：「用严师风格判定：帮我写个周报」
> 用户：「简单点，30 字以内：帮我写个周报」→ brief 精简回答
> 用户：「换个 provider，用 prompt-expert 试试」（仅限已接入者）
> 用户：「判定完给我个优秀例子」→ 走 `generators.md` 产出范例 + 对照讲解

外部网页模式（浏览器里用）：

> 用户：「打开教练网页」（或技能刚加载时主动做——这是默认动作）
> Agent ①`bridge.mjs --init` 体检 → ②`bridge.mjs` 同步页面 + 起服 → ③挂宿主
> → ④问要哪个入口：**外部网页**（`open-coach.cmd` 独立窗口 / 浏览器地址）还是
> **内部应用**（对话内直接判）→ ⑤告知「可以开始提交了」
>
> 用户在网页粘贴提示词、选风格 → 桥唤醒宿主会话 → 教练判定 →
> `submit_answer` 回推 → 网页按三区结构渲染（结论加粗、存档块可折叠）

本技能已落地在 `<个人技能仓库>\agent-chat-coach`（`awam-` 前缀约定按你的
要求改成了语义化的 `agent-chat-`），由 WorkBuddy 技能机制加载，流程不变。

> **占位符约定**：`<skill-root>` = 本技能根目录；`<bridge-repo>` = 外接桥仓库，默认与本技能
> 同级（`<skill-root>\..\..\workbuddy-bidge`），可用环境变量 `BRIDGE_REPO` 覆盖；
> `<个人技能仓库>` = 你的技能仓库根目录。写成占位符是为了让本仓能直接公开——
> 本机实跑时把它们替换成真实路径即可。

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| v1.6 | 自由 Provider（默认）+ 工作空间验证环 + 范例生成器 | 本轮交付 |
| v2 | 对话循环：多轮聊天记录的整体判定（跑偏 / 上下文丢失 / 越纠越乱） | 未开始 |
| v3 | 教学周期：跨会话毛病档案（借鉴本地 tutor 技能的概念级追踪机制） | 未开始 |
| v4 | 多裁判：prompt-expert 等按同一契约接入，规则层做交叉判定 | 未开始 |

各阶段的动机、判定对象、机制草案与验收标准见 **[ROADMAP.md](ROADMAP.md)**。
