# Provider 层 · 评价能力提供者

## 概念

**Provider = 后端对提示词具体评价的工具技能。**

它回答的是「这个 prompt 怎么样」——做诊断、给分、列问题、给参考改法。
本技能（反向输出师）流程中第 2 步的评价执行由 Provider 承担。

**判定权不在 Provider。** Provider 的输出只是素材，经 `rules.md` 规则层
（R0-R4）独立判定后才成为给用户的结论。Provider 打分再高，命中红线照样判无效
（实证见 `examples/round-2-conflicting-constraints.md`）。

## 与「多裁判」的关系

v1.6 起默认 Provider 为第一方 **free（自由 Provider）**，agent-buddy 转备用。
ROADMAP 中的 v4「多裁判」= **多 Provider
并行 + 规则层交叉判定**——本文件定义的统一契约就是 v4 的接入面：任何 Provider
只要能按契约交回「评价文本 + JSON 摘要」，就能进裁判席。

## 统一接口契约

**输入**：用户提示词原文（可附场景说明）。

**输出**（两部分，缺一不可）：

1. **评价文本**：按 Provider 自身技能的诊断流程产出（诊断 / 打分 / 问题清单）。
   本流程固定指示其走「只评价、不代写」的路径；
2. **JSON 摘要块**：字段口径见 `SKILL.md` 第 2 步调用方契约。

**失败语义**：Provider 未按契约交回合规 JSON → 规则层 **R0「无法判定」**。
规则层拒绝基于自由文本猜分，也禁止用第二个 Provider 的自由文本去补第一个的 JSON。

**扩展字段**：核心字段（judgeable / dimensions / total / intent_ambiguous /
constraint_conflict / missing / key_issues）必填，口径与 null 语义见
`SKILL.md` 第 2 步。`judgeable = false`（输入不构成任务型请求，见 `rules.md` R4）
时 `dimensions` / `total` 必为 null，`judgeable_reason` 必填；该字段缺失视为
`true`，因此老 Provider（agent-buddy / prompt-expert / expert）不受影响。Provider 可定义**扩展字段**，须在本文件或其指令中
文档化；规则层判定只用核心字段，扩展字段用于报告展示与验证环触发。
当前已定义的扩展字段（free Provider）：

| 扩展字段 | 用途 |
|---|---|
| `agent_fit` | agent 场景加成评估（是否利用工作空间 / 工具），教学点，不扣分 |
| `workspace_verifiable` | 可经工作空间补足 / 验证的缺口清单 → 触发验证环 |
| `suggested_verification` | 建议的验证动作 → 驱动验证环执行 |

## Provider 清单

| Provider | 版本 | 状态 | 评价能力 | 契约覆盖 | 适配要点 |
|---|---|---|---|---|---|
| free | 1.0.0 | **默认（已接入）** | agent 场景五维 + 双红线 + agent_fit 加成评估 | 全字段 + 扩展（agent_fit / workspace_verifiable / suggested_verification） | 第一方，`providers/free/` |
| agent-buddy | v1.0.5 | **已接入（备用）** | RCTFC 五维诊断 + 第 0 步歧义/矛盾检查 | 全字段 | 文本级粗档；`providers/agent-buddy/`；free 不可用时回退 |
| prompt-expert | v1.0.0 | **可接入（未接）** | B 诊断模式：八维百分制 + 带条款号的扣分项 | dimensions / total / missing / key_issues；**红线 null** | `providers/prompt-expert/`；锁 B 诊断禁铸造；档位→0-2 换算表；红线 null |
| prompt-engineering-expert | v1.0.1 | **可接入（未接）** | Criteria ledger + 歧义/冲突枚举（Ambiguity & authorization） | constraint_conflict / missing / key_issues；**维度 null** | `providers/prompt-engineering-expert/`；锁 gate 第 1-2 步禁改写；underspecified→R1 |
| prompt-engineering-studio | v1.0.0 | **不作为 Provider · 转任范例生成器** | 仅生成（变体铸造），无评价路径 | — | 落点 `generators/prompt-engineering-studio/`；见 `generators.md` |

「可接入」= 有能力、契约能映射，但适配规则未写、回归未跑——**写完适配规则 +
examples/ 回归样例后才升级为「已接入」并允许调度**。「不接入」= 能力定位冲突，
不做适配。

## 适配评估（2026-10-24，逐字读原文 + 参考文件后）

### 契约字段覆盖矩阵

| 契约字段 | agent-buddy | prompt-expert | studio | expert |
|---|---|---|---|---|
| dimensions 五维 | ✅ 原生 0-2 | ✅ 百分制换算 | ❌ | ❌ null |
| total | ✅ 原生 /10 | ✅ 换算 /10 | ❌ | ❌ null |
| intent_ambiguous | ✅ 第 0 步 | ❌ null | ❌ | ◐ 需判读规则 |
| constraint_conflict | ✅ 第 0 步 | ❌ null | ❌ | ✅ conflicting 项 |
| missing | ✅ | ✅ 缺哪层 | ❌ | ✅ underspecified 项 |
| key_issues | ✅ | ✅ 扣分项+条款号 | ◐ 对产物的自评 | ✅ C 编号清单 |

### 互补性（v4 多裁判的需求侧证据）

三个可用 Provider 的能力覆盖**错位互补**，这不是巧合堆料，是补盲区：

- agent-buddy：全字段，但五维只到 0-2 粗档；
- prompt-expert：五维最细（八维百分制 + 每维档位描述 + `prompt_score.py`
  脚本可复跑），但**红线全盲**——没有歧义/矛盾检测机制；
- expert：红线有独立机制（conflicting 枚举），但**无评分制**——维度分全盲。

推论：红线判定不能只靠 agent-buddy 单点——expert 接入后，同一对矛盾约束
（如「200 字 + 详细全面」）有两套独立机制互证，单点漏判风险下降。

### 第一方 Provider：free（自由 Provider，v1.6 起默认）

完整指令在 `providers/free/SKILL.md`，设计要点：

- **三家优点的合流**：agent-buddy 的五维 + 双红线结构、prompt-expert 的
  显式档位与条款化 key_issues（`C-1` 编号）、expert 的缺失枚举——
  但结构是我们的，不是任何一家的复印件；
- **评判场景是 agent**：缺信息先问工作空间 / 上下文能不能补（`resolvable`），
  指代能消解不算歧义，矛盾分硬 / 软两级——从宽，但每一分的让都在 JSON
  里留理由；
- **agent_fit 加成评估**：评这段话把 agent 当什么用（工作空间 / 工具），
  是教学点不扣分；
- **验证环驱动**：`workspace_verifiable` / `suggested_verification` 两个
  扩展字段把「可实证的缺口」交给第 3 步工作空间（见 `workspace.md`）；
- **不严格 ≠ 不判**：只有缺失 ≥4 维或硬红线才导向无效；判定权仍在规则层。

### prompt-expert 接入的显式适配规则（草案，接入时定稿）

1. **模式锁定**：显式指令走 B 诊断模式（读原提示词 → 八维评分 → 逐层诊断
   → 列扣分项），禁止 A 铸造、禁止 Stage 5 落盘交付、禁止重写成品；
2. **档位 → 0-2 换算表**（确定性，可复现）：
   - 该维满分档 → 2；
   - 该维中间档 → 1；
   - 该维 0 分档 → 0；
   - 维度 6/7/8（结构完整性/可执行性/防幻觉安全）无五维对应 → 不入
     dimensions，其扣分项进 key_issues；其中「出现疑似真实密钥/隐私」的
     一票警示必须进 key_issues；
3. **total** = 五维换算后合计 /10；prompt-expert 原始百分制原文留存在
   Provider 输出记录中，不混入契约 total；
4. **红线字段填 null**（未检测），并在输出记录标注「本 Provider 不检测
   歧义/矛盾」；
5. 评分走 `scripts/prompt_score.py`（已 vendored，可执行）；脚本不可用时
   按其自身降级路径人工评分并标注。

### expert 接入的显式适配规则（草案，接入时定稿）

1. **流程锁定**：只做 Mandatory Gate 第 1-2 步（criteria ledger +
   ambiguity/authorization 分析），禁止进入改写、禁止交付模板；
2. `constraint_conflict`：ambiguity 表出现 conflicting 项 → true，否则
   false（它有明确检测机制，不填 null）；
3. `intent_ambiguous`：underspecified 项中表现为「同一输入可多重解读」
   → true；仅为参数缺失（时间窗/阈值未定义）→ false 并进 missing；
4. `dimensions` / `total` → null（无评分制）；
5. `missing` / `key_issues`：取自 C 编号清单与 underspecified 项。

### studio 为何不接入（记录在案，避免反复评估）

- 无评价路径：六步工作流（intake→选框架→模板→变体→评分→合规）全部是
  生成导向，用户输入的一段 prompt 会被当「需求」重新铸造，而不是被评价；
- 自证悖论：它的评分维度（角色/任务/约束/结构/可复用性/格式）作用于
  自己生成的变体——被审查对象给自己打分，不成立为独立判定；
- 定位冲突：它的价值在「替你把话说出来」（生成），与本品「只审判不代写」
  的边界根本冲突。
- **v1.6 起的新角色**：不作为 Provider，但转任**范例生成器**——「优秀学生
  案例」需要的正是「判定之后示范好的长什么样」，生成能力由此兑现。接口
  与流程见 `generators.md`。vendored 副本保留，不做 Provider 适配。

### 接入前置条件（rules.md 缺口，先补规则再接 Provider）

**红线 null 语义**：prompt-expert 的红线两字段为 null 时，现有汇总逻辑
（命中 R1/R2 → 无效；否则看维度）会**漏判矛盾约束**。接入前 rules.md 必须补：

> 红线字段为 null（Provider 不检测）时：结论不得给「有效」（最高「基本有效」），
> 且证据中必须标注「未经红线检查，结论仅基于维度覆盖」。

该条落地前，prompt-expert 与 expert 均不得单独作为唯一 Provider 使用
（expert 无维度分，同样受此条约束）。

## 切换与新增

**切换**（仅限已接入 Provider）：

> 用户：「换个 provider 评价」「用 prompt-expert 试试」

→ 本轮改用指定 Provider；该 Provider 未接入时，明确告知并回退默认 Provider，
不静默 fallback。

**新增接入**（「可接入」→「已接入」）：

1. vendored 技能已就位于 `providers/<name>/`（来源登记见 `providers/VENDORED.md`）；
2. 按「适配评估」节的草案定稿显式适配规则：原生输出 → JSON 摘要的字段映射，
   逐条写明，禁止隐式转换；
3. 本文件清单中该 Provider 状态改为「已接入」，适配规则位置写入清单行；
4. 跑一轮回归：`examples/` 新增该 Provider 的端到端样例；
5. **前置条件检查**：若该 Provider 红线字段为 null 或维度分为 null，
   确认 rules.md 的「红线 null / 维度 null 保守策略」已落地，否则不得
   单独作为唯一 Provider 调度。

## 输出存档纪律（承接 v1）

- Provider 的评价文本与 JSON 摘要**原样记录**进报告的「被调用技能输出记录」块，
  供追溯；
- Provider 第 0 步止损未做诊断时，JSON 分数一律 `null`（未评估），**禁止估填**
  （null 语义见 `SKILL.md` 第 2 步）；
- 报告中须标注实际执行的 Provider 名称与版本——换 Provider 不换标注等于造假。
