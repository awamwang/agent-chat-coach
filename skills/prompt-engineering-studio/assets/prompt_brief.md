# 提示词简报（Prompt Brief）

> 把下面能填的填上，交给 `prompt-engineering-studio`。填得越全，生成的 prompt 越对口。
> 然后跑：`python scripts/generate_prompts.py --brief brief.json --lang zh-CN --count 5 --out result.md`

```json
{
  "task": "要 AI 做什么（必填，动词开头，如：总结这篇长文的核心观点）",
  "role": "希望 AI 扮演的角色（可选，如：资深产品经理）",
  "context": "背景现状（可选，如：这是给投资人看的周报）",
  "constraints": "约束（可选，如：不超过 200 字、用中文、不要举例）",
  "style": "风格参照（可选，如：模仿财经专栏作家口吻）",
  "tone": "语气（可选，如：专业客观 / 轻松口语）",
  "audience": "受众（可选，如：零基础用户 / 技术同事）",
  "output_format": "输出格式（可选，如：Markdown 表格 / 编号列表 / JSON）",
  "examples": "少样本示例（可选，如：输入A→输出B）",
  "framework": "偏好框架（可选：CO-STAR / CRISPE / RISEN，不填则自动组合）",
  "language": "目标语言（可选：zh-CN / zh-TW / en / ja，默认 zh-CN）"
}
```

## 填写小贴士
- **task 必填**：没说清要干嘛，AI 只能瞎猜。
- **role 强烈建议**：一个角色能让输出口径立刻收敛。
- **constraints 最划算**：字数 + 禁项 + 格式，三行顶十行形容词。
- **examples 强效**：给 1–2 个样例，格式和风格几乎不再跑偏。
- 实在懒得填：只给 `task`，脚本会用合理默认值补齐其余要素。
