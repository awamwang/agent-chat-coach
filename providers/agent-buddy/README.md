# Agent-buddy

> prompt 陪练教练。**帮你把 prompt 从能用到干得漂亮**，不是替你干活。
>
> A prompt coaching skill. **Helps you go from "it works" to "it works beautifully"** — without doing the work for you.

**作者 / Author**: 简一 (JianYi)
**版本 / Version**: V1.0.5
**协议 / License**: [MIT](./LICENSE.md)

> 版本号以 SKILL.md 开头声明的 version 为准，发布时同步到 `.metadata.json`、本文件与 `CHANGELOG.md`。

---

## 🇨🇳 中文版

### 这是干什么的

不少人用 AI 的问题不是"AI 不行"，是"不知道怎么问"。把糟糕的 prompt 丢给 Agent-buddy，它给你：**诊断问题、打分、追问关键信息、三档改写（默认给一版完整版本，另外两版说明差别）、再用表格讲清每处为什么这么改**。用几次下来，你自己也就会写了。

### 谁需要它

- 写 prompt 靠感觉，想从"碰运气"变成"有方法"的
- 用了一阵子，但 AI 输出总不满意的
- 想把 AI 用起来做副业 / 提效，但每次都要试很多轮才对味的

不适合：已经能写五段式 prompt 的老手（那种直接对话就行；老手可只做微调或直接学进阶技巧）。

### 怎么触发

**只有点名才会触发**：在对话里说"教练""陪练""agent-buddy"，或加前缀 `/agent-buddy`——任何内容都会进入陪练模式。不会因为聊到别的词自动跳出来打扰你。

点名后如果说的是业务任务（如"帮我写份总结"），也不会直接代写，而是给你一个能写出这份总结的提示词。

拿不准就喊"教练"两个字，永远不会错。

### 快速上手

- **第一次用**：丢一句你最近碰壁的 prompt，看诊断和打分
- **AI 答不好时**：把原 prompt + AI 输出 + 期望效果丢回来，走迭代式教学（每次只改一段，带验收标准）
- **想快速拿模板**：直接说"给我个写XX的prompt"，秒拿 13 大场景模板之一
- **想练手**：点名后说"出题"，从反例库出题给你改，交卷帮你打分点评

### V1.0.5 更新要点

- **交付更轻**：默认只给一版完整版本，另外两版只说明差别，不再一次给三份
- **给 prompt 打分**：5 个方面各 2 分、满分 10 分。分数高就只做微调，分数低就重写
- **按水平教学**：新手、进阶、熟手、内行，教的内容和深度不一样，不啰嗦也不教错
- **可以实测**：您明确要求、且环境支持时，可以真的跑几遍看效果，再告诉您哪里要改
- **练习模式**：点名后说"出题"，陪练出题您来改，改完帮您点评打分
- **改完有验收**：每次修改后，都告诉您怎么检查这次改得对不对
- **模板更好用**：13 个常用场景模板，每个都标注了最容易踩的坑
- **更安全**：新增安全提醒，教您识别和防范带隐藏指令的内容
- **触发更精准**：只有点名"教练"才进入陪练，日常对话不会被误触
- **修复**：点名"陪练"后，即使说的是业务任务也会进入陪练，不再直接代做
- 详见 [CHANGELOG.md](./CHANGELOG.md)

### 文件结构

```
agent-buddy/
├── .metadata.json                        (平台元数据，版本与 SKILL.md 同步)
├── SKILL.md                              (核心路由，约 300 行)
├── references/
│   ├── teaching-core.md                  (五段式模板/自检/评估三问/调试清单)
│   ├── prompt-deep-dive.md               (RCTFC 深化 + 场景技法 + 实测协议)
│   ├── scenario-templates.md             (13 大场景模板 + 易错点)
│   ├── anti-patterns.md                  (8 个反例对照库，兼出题题库)
│   ├── advanced-techniques.md            (5 条进阶技巧)
│   ├── hallucination-training.md         (幻觉识别训练)
│   ├── context-management.md             (上下文管理)
│   ├── interaction-modes.md              (交互模式指导)
│   ├── injection-safety.md               (prompt 注入识别与隔离)
│   ├── fallback-table.md                 (13 条异常处理)
│   └── full-example.md                   (4 轮完整陪练示例)
├── tests/
│   └── self-test.md                      (20 条自测集，发版前回归)
├── README.md                              (本文件)
├── CHANGELOG.md                           (更新记录)
└── LICENSE.md                              (MIT 协议)
```

SKILL.md 只保留核心路由和决策逻辑，详细内容按需加载，不用全部常驻，占用更少、启动更快。

---

## 🇬🇧 English (short)

### What It Does

Most "AI problems" are actually "how-to-ask" problems. Agent-buddy coaches you through it: **diagnose + score + ask key questions + rewrite in three tiers (one full version by default; the other two as short diffs) + explain every change in a table**. A few rounds and you'll write solid prompts yourself.

### How to Trigger

- **Name it (the only way)**: say "coach" / "agent-buddy" or prefix with `/agent-buddy` — you enter coaching mode no matter what follows, even a business task (you'll get a prompt for it, not the task done for you)
- **No auto-trigger**: saying "help me fix my prompt" or "quiz me" alone won't activate the skill. Once inside coaching mode, just say what you want — rewrite / evaluate / practice.

### Quick Start

- **First time**: throw in a prompt you've been struggling with
- **Output is bad**: send prompt + AI output + expectation → iterative coaching (one fix at a time, with an acceptance check)
- **Quick template**: "give me a prompt for XX" → one of 13 scenario templates
- **Practice**: name the coach, then say "quiz me" → rewrite a bad prompt, get scored per dimension

### What's New in V1.0.5

- **Lighter delivery**: one full version by default, the other two as short diffs
- **Scoring**: 5 aspects, 2 points each, out of 10; high score → minor tweak, low score → rewrite
- **Level-based teaching**: beginner / intermediate / expert / domain-insider get different depth
- **Live testing (on request)**: with host tools, actually run it a few times and report what to fix
- **Quiz mode**, **acceptance check** after every fix, **pitfall notes** on all 13 templates, **injection-safety guidance**
- **Fix**: naming the coach now always enters coaching mode — even a business task becomes "here's the prompt for it", never done for you

Details in [CHANGELOG.md](./CHANGELOG.md).

---

## License

Released under the [MIT License](./LICENSE.md). Copyright (c) 2026 简一 (JianYi).
