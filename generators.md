# 范例生成器 · 优秀学生案例

## 概念

与 Provider 并列的第二个被调用角色：

| 角色 | 回答的问题 | 在流程中的位置 |
|---|---|---|
| Provider | 「这个 prompt 怎么样」 | 第 2 步评判 |
| **范例生成器** | 「好的 prompt 长什么样」 | 第 5 步之后，用户要示范时 |

**Provider 审判，生成器示范。** 判定告诉你错在哪，范例告诉你对的长什么样
——后者就是「优秀学生案例」：把标准答案贴在墙上，让用户照着学自己写。

## 为何是 prompt-engineering-studio

它**不作为 Provider**（理由记录在 `providers.md`：纯生成器、无评价路径、
自证悖论），落点在 `generators/prompt-engineering-studio/`（与
`providers/` 并列，不进 Provider 目录）。生成能力正是范例环节所需，且已
vendored 验证过：

- **intake 简报** → 可由判定结果直接组装（缺什么补什么的料都在）；
- **`scripts/generate_prompts.py`** → 纯标准库，一次产出主 prompt +
  3-5 变体 + 逐条评分 + 改进建议，CLI 接口干净可编程调用：

```
python generate_prompts.py --brief brief.json --lang zh-CN --count 5 --out result.md
```

生成器同样守本技能的边界：**范例是教学材料，不是代写交付。**

## 接口契约

**输入**：`brief.json`（脚本原生格式），由判定结果组装——

| brief 字段 | 组装来源 |
|---|---|
| `task`（必填） | 用户原 prompt 的任务部分；原 prompt 没写清时用纠正方向中的任务表述 |
| `role` | 原 prompt 有则用；无则从标准补救取通用方向（「××领域的××角色」），**不编造用户真实身份** |
| `context` | 原 prompt 有则用；无则从工作空间验证所得的真实环境信息补（agent 场景独有优势） |
| `constraints` | 标准补救表中的约束方向（红线：什么不能做） |
| `output_format` | 标准补救表中的格式方向 |
| `framework` / `language` | 默认 CO-STAR + zh-CN，用户指定除外 |

**调用**：

```
python <skill-root>/generators/prompt-engineering-studio/scripts/generate_prompts.py \
  --brief <brief.json> --lang zh-CN --count 5 \
  --out <skill-root>/workspace/<session-id>/evidence/example.md
```

**输出**：主 prompt + 3-5 变体 + 每条六维评分（角色 / 任务 / 约束 / 结构 /
可复用性 / 格式）+ 改进建议。

## 优秀学生案例流程

1. 判定完成（第 4 步），用户说「给我个优秀例子」「看看好的长什么样」，
   或判定为无效且用户要求示范；
2. 组装 brief.json——料全部来自判定结果与工作空间事实（见上表）；
3. 调脚本生成范例，落盘 workspace 证据目录；
4. **对照讲解**：逐条回答「每个缺失维度在这份范例里是怎么被补上的」。
   没有这一步，范例就退化成代写，用户什么都没学到；
5. 范例入报告【范例】块（客观风格原样呈现，不带人格），标注
   「范例由 prompt-engineering-studio v1.0.0 生成，仅供参考」。

## 边界

- 用户说「别判定，直接帮我改」→ 仍守边界：可以给范例，但判定照做；
- 范例中的角色 / 背景**不得冒充用户真实信息**——补的是方向与占位，
  不是事实；
- 生成器同样不碰工作空间外路径，产物落 workspace。
