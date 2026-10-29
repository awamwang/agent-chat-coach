# 四语可填空模板

> 字段先翻译为目标语言，再套语言专属句式。脚本 `scripts/generate_prompts.py` 自动完成；此处给人眼核对与手改用。

## 字段含义（统一）
| 字段 | 含义 |
|---|---|
| role 角色 | 你是谁 |
| context 上下文 | 背景现状 |
| objective 任务 | 要做什么（动词开头） |
| constraints 约束 | 字数/禁项/必含/语言 |
| style 风格 | 模仿谁/什么文体 |
| tone 语气 | 正式/轻松/口语 |
| audience 受众 | 写给谁 |
| response 输出格式 | 表格/列表/JSON/Markdown |

## 简体中文 (zh-CN)
```
你是一位{role}。
背景：{context}
任务：{objective}
约束：{constraints}
风格：{style}
语气：{tone}
受众：{audience}
输出格式：{response}
```

## 繁體中文 (zh-TW)
```
你是一位{role}。
背景：{context}
任務：{objective}
約束：{constraints}
風格：{style}
語氣：{tone}
受眾：{audience}
輸出格式：{response}
```

## English (en)
```
You are a {role}.
Context: {context}
Task: {objective}
Constraints: {constraints}
Style: {style}
Tone: {tone}
Audience: {audience}
Format: {response}
```

## 日本語 (ja)
```
あなたは{role}です。
背景：{context}
目的：{objective}
制約：{constraints}
スタイル：{style}
トーン：{tone}
対象読者：{audience}
出力形式：{response}
```

## 语言要点（专治机翻腔）
- **英文**：动词用原形祈使句（"Summarize…"）；角色用 "You are a …"；连接用逗号+空格。
- **日文**：句尾用丁寧語（です/ます）；"任务"译作"目的"更自然；"约束"用"制約"。
- **繁中**：整词替换（任务→任務、输出→輸出、约束→約束），不要混入简体字。
- **简中**：口语化、直接，不用"您"等过度敬语（除非目标受众确实需敬语）。

## 改进建议（每条变体附带）
脚本会基于缺失字段给出提示，例如：
- 缺 role → "补充角色可收敛风格与口径"
- 缺 constraints → "加字数/禁项约束可提升可控性"
- 缺 response → "指定输出格式可减少格式跑偏"
- 缺示例 → "补 1–2 个 few-shot 样例可显著提升稳定性"
