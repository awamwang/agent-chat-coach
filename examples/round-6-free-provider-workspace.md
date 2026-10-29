# round-6 · 自由 Provider + 工作空间验证环（v1.6 端到端实测）

> 本轮的使命：验证 v1.6 三件新东西——**第一方 free Provider**（agent 场景评判）、
> **封闭工作空间验证环**（缺的信息跑一下试试）、**范例生成器**（studio 转任）。
> 所有执行均为真实操作，证据在 `workspace/2026-10-24-r6/evidence/`。

## 输入

> 「看一下当前目录有哪些文件，把里面的 md 文档合并成一份摘要，300 字以内」

场景设定：用户在 agent 会话中发出这句话，其工作空间即本次演示工作空间
`workspace/2026-10-24-r6/`（内含 `input/` 三份 md：工作日志、会议纪要、阅读笔记——
**输入为验证构造**，已在证据中注明）。

## 第 2 步 · free Provider 评价（摘要）

- **五维**（从宽口径）：R 角色 1（未指定，但 agent 有默认执行身份，可省）·
  C₁ 场景 1（「当前目录」指代含糊但可经工作空间消解，标 context_resolvable）·
  T 任务 2（动作+对象+范围齐全）· F 格式 1（有长度、结构未定）· C₂ 约束 0；
- **红线**：`intent_ambiguous=false`（指代可消解，不拉响）、`constraint_conflict=false`；
- **agent_fit**：`uses_workspace=true`、`uses_tools=true`——这段话把 agent
  当执行器用而不是聊天窗，方向正确；可再明示「直接改完写回」省一轮；
- **验证建议**：`workspace_verifiable` = [当前目录指代, md 文件存在性,
  300 字约束可达性]；`suggested_verification` = [ls 当前目录, 读取各 md,
  生成摘要并数字数]。

```json
{
  "provider": "free",
  "provider_version": "1.0.0",
  "dimensions": {"role": 1, "context": 1, "task": 2, "format": 1, "constraint": 0},
  "total": 5,
  "intent_ambiguous": false,
  "constraint_conflict": false,
  "missing": ["constraint"],
  "key_issues": [
    "C-1 缺C₂红线约束：无禁止项，过程细节可能被塞进摘要",
    "C-2 F格式只定长度未定结构：分条还是段落随缘",
    "C-3 agent_fit：已会用工作空间，但未明示可执行/写回，多耗一轮"
  ],
  "agent_fit": {"uses_workspace": true, "uses_tools": true, "notes": "把agent当执行器而非聊天窗，方向正确"},
  "workspace_verifiable": ["当前目录指代", "md文件存在性", "300字约束可达性"],
  "suggested_verification": ["ls 当前目录", "读取各md内容", "生成摘要并数字数"]
}
```

## 第 3 步 · 工作空间验证环（真实执行）

环境：`workspace/2026-10-24-r6/`，cwd 限定其内，网络未用，无破坏性命令。

| # | 执行 | 结果 | 状态 |
|---|---|---|---|
| 1 | `ls -la input/` | 3 份 md 全部存在（meeting-notes.md 251B / reading.md 192B / weekly-log.md 246B） | `resolved`——「当前目录」指代消解 |
| 2 | 读取三份 md 并合并生成 `summary.md` | 产出成功 | `resolved`——任务可执行 |
| 3 | 数字数 | 非空白字符 **153** ≤ 300 | `resolved`——300 字约束可达 |

证据落盘：`evidence/01-ls.txt`、`evidence/02-count.txt`、`evidence/03-charcount.txt`、
产物 `summary.md`。

## 第 4 步 · 规则层并案

- R0-R3：R1/R2 不命中；R3 缺失 1 维（C₂ 约束）→ **基本有效**；
- 验证并案（workspace.md 重算语义）：context 的 `resolved` → 该维按 2 分计；
  红线记录不动；role / constraint 不因验证加分；
- 重算后五维：R 1 · C₁ 2 · T 2 · F 1 · C₂ 0 → 仍缺 1 维 → **维持「基本有效」**，
  但这一次是**带实证的**基本有效：prompt 的每个含糊点都试过了，确实能跑。

## 第 5 步 · 给用户的答复（客观风格）

```
══════════════════════════════
 反向输出师 · 沟通有效性判定（单轮）
 Provider：free 1.0.0 · 话术风格：objective
══════════════════════════════
【结论】能用，但有建议——已替你在工作空间试过，三个含糊点都消解了，
补一条红线约束会更稳。（判定：基本有效 · 经工作空间验证）

【判定依据】
命中规则：R3 维度覆盖不足（缺 1/5：C₂ 约束）
参考分（free 五维，仅参考不采信）：5/10
五维明细：R 角色 1 · C₁ 场景 2（验证后）· T 任务 2 · F 格式 1 · C₂ 约束 0

【证据】
  - R3：只缺 C₂ 约束——prompt 没说「什么不能做」，AI 可能把过程细节
    也塞进摘要；
  - F 格式只定了长度（300 字）没定结构，分条还是段落随缘；
  - agent_fit：你已经会把 agent 当执行器用（看文件、合并），比纯聊天
    窗的写法高一个段位；差一句「直接改完写回」。

【工作空间验证】
  - 验证环境：workspace/2026-10-24-r6/（输入为验证构造）
  - 执行记录：ls input/ → 3 份 md 存在；读取并合并 → summary.md；
    数字数 → 非空白 153 字符
  - 验证结论：当前目录指代 resolved；md 存在性 resolved；
    300 字约束可达性 resolved
  - 并案影响：context 由 1 分按 2 分计；结论维持「基本有效」

【纠正方向】
  - C₂：补一条红线，如「只保留结论性内容，过程细节不展开」；
  - F：定结构，如「分三条：成果 / 决策 / 风险」；
  - 顺带：明示「合并后写回 summary.md」，省一轮追问。

【Provider 输出记录】（free 1.0.0 · 原样存档）
  - 从宽口径五维：R1 · C₁1（context_resolvable）· T2 · F1 · C₂ 0
  - agent_fit：uses_workspace=true, uses_tools=true
  - JSON 原文见上文第 2 步

【下一步】按上面三条补一版，回来贴给我再判定。
══════════════════════════════
```

同素材的 brief 版（16 字）：`能用。缺红线，细节会超标。补条禁令。`

## 附带验证 · 范例生成器（优秀学生案例）

按 `generators.md` 组装 brief（料全部来自判定结果 + 工作空间事实），调用：

```
python skills/prompt-engineering-studio/scripts/generate_prompts.py \
  --brief evidence/brief.json --lang zh-CN --count 3 --out evidence/example.md
```

真实产出：3 个变体，评分 72 / 72 / 45（角色/任务/约束/结构/可复用性/格式六维）。
最高分变体（标准档 · CO-STAR）：

> 你是一位细致的团队助理，背景：用于部门周会汇报；素材是 workspace/input
> 下三份分散的 md 记录（工作日志、会议纪要、阅读笔记），任务：把本周的多份
> 工作记录合并成一份300字以内的摘要，约束：300字以内；只保留结论性内容，
> 不堆过程细节，输出格式：分条列点，先要点后风险。请先列出步骤，再逐步完成。

**对照讲解**（每个缺失维度怎么被补上的——没有这一步，范例就是代写）：

| 缺失/含糊维度 | 范例里的补法 | 料从哪来 |
|---|---|---|
| R 角色 1 | 「细致的团队助理」 | 标准补救方向，不冒充用户真实身份 |
| C₁ 场景 | 「素材是 input 下三份 md 记录」 | **工作空间验证所得的真实环境信息**（agent 场景独有） |
| F 格式 1 | 「分条列点，先要点后风险」 | 标准补救方向 |
| C₂ 约束 0 | 「300 字以内；只保留结论性内容」 | 标准补救方向 |

注意：范例里的「团队助理」「部门周会」是**方向与占位**，不是用户的事实——
用户要学的是「缺的维度该长什么样」，然后自己写。

## 本轮实证的设计意义

1. **free 的从宽不是放水**：context 含糊没判 R1 歧义，但也不是默默放过——
   标了 `context_resolvable` 并进验证环，用执行结果说话；
2. **验证环拿到了文本级评判永远拿不到的硬证据**：「当前目录」到底有什么、
   300 字到底能不能达标——猜变成试；
3. **studio 转任成立**：判定结果直接组装成 brief，生成器 3 变体 + 评分 +
   改进建议全部可用，且对照讲解防了「退化成代写」；
4. **并案语义按临时规则跑通**：resolved→2 分、falsified→0 分的重算在
   round-6 只触发了前者；正式并入 rules.md 仍是晚点讨论项。
