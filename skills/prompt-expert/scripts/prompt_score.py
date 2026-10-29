#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""prompt_score.py — 提示词专家 100 分制评分门禁脚本

用法:
    python prompt_score.py <prompt.txt|prompt.md> [--json]   # 评分一个提示词文件
    python prompt_score.py --self-test                       # 内置样例自检

评分维度与满分（详见 references/score-rubric.md）:
    角色身份 15 | 任务目标 15 | 约束规则 15 | 上下文输入 10 | 输出格式 10
    结构完整性 10 | 可执行性 15 | 防幻觉与安全 10   总计 100

交付阈值: >=95 交付; 90-94 迭代一次; <90 回炉。
零依赖: 仅 Python 标准库 (Python 3.8+)。
"""
import sys
import re
import json
import os

# ---------- 工具 ----------

def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _has(text: str, pattern: str) -> bool:
    return re.search(pattern, text) is not None


def _count(text: str, pattern: str, flags: int = 0) -> int:
    return len(re.findall(pattern, text, flags))

# ---------- 八维评分 ----------

def score_role(t: str):
    """维度1 角色身份 (15): 具体(领域/深度词) + 边界(拒答/仅限)"""
    identity = _has(t, r"(你是|您是|你将扮演|You are|角色身份|身份定义|##\s*角色|扮演)")
    if not identity:
        return 0, ["无角色身份定义（L1 缺失）"]
    concrete = _has(t, r"(\d+\s*年|[资资]深|资深|高级|专家级|首席|专精|专注于|深耕|从业)"
                    ) or _has(t, r"(工程师|分析师|架构师|教师|讲师|操盘|经理|顾问|策划|编辑|设计师|医生|律师|研究员|教练|文案|译员|审计|运营|产品经理)")
    boundary = _has(t, r"(仅(处理|回答|负责|围绕|限)|只(处理|回答|负责|围绕)|超出.{0,12}(范围|范围外)|不得回答|拒答|不要回答|领域外|边界|与.{0,8}无关)")
    if concrete and boundary:
        return 15, []
    if concrete:
        return 10, ["角色具体但缺行为边界/拒答范围（+5）"]
    return 5, ["身份泛化（如「你是一个助手」），需具体到领域+深度+边界（+10）"]


def score_task(t: str):
    """维度2 任务目标 (15): 动作动词 + 交付物 + 数量/标准"""
    verb = _has(t, r"(生成|输出|撰写|写一|编写|分析|改写|重写|检查|审查|总结|摘要|翻译|优化|计算|评估|创作|设计|对比|归类|提取|produce|write|analyze|generate|review|output)")
    deliver = _has(t, r"(报告|清单|文案|代码|文章|表格|列表|方案|脚本|邮件|标题|摘要|计划|建议|文档|稿件|大纲|回答|答案|JSON|Markdown|日报|周报|课件|答案|笔记)")
    quant = _has(t, r"(\d+\s*(条|个|篇|字|段|版|行|项|份|句|题)|不超过|至少|以内|不少于|字数|完成标准|验收标准|质量线|格式为)")
    got = sum([verb, deliver, quant])
    tips = []
    if not verb:
        tips.append("缺动作动词（+5）")
    if not deliver:
        tips.append("缺交付物形态描述（+3）")
    if not quant:
        tips.append("缺数量/质量标准（+2）")
    s = {3: 15, 2: 10, 1: 5, 0: 0}[got]
    return s, ([] if s == 15 else tips)


def score_constraint(t: str):
    """维度3 约束规则 (15): 禁止类 + 兜底类 + 风格/禁忌类"""
    forbid = _has(t, r"(禁止|不得|不要|严禁|避免|不允许|切勿|杜绝)")
    fallback = _has(t, r"(不知道|无法解答|无法确认|未提供|暂无|不存在.{0,10}(回复|告知|说明)|缺失时|一律回复|统一回复|无法为你|说明无法)")
    style = _has(t, r"(语气|风格|受众|口语|正式|通俗|禁用|不得使用|字数控制|不要使用|避免使用)")
    got = sum([forbid, fallback, style])
    tips = []
    if not forbid:
        tips.append("缺禁止类约束（禁编造/禁套话）（+5）")
    if not fallback:
        tips.append("缺兜底话术（不知道/素材缺失时怎么办）（+5）")
    if not style:
        tips.append("缺风格/禁忌约束（+5）")
    s = {3: 15, 2: 10, 1: 5, 0: 0}[got]
    return s, ([] if s == 15 else tips)


def score_context(t: str):
    """维度4 上下文输入 (10): 占位符体系 + 素材引用 + 变量表"""
    placeholder = _count(t, r"(\{[^\{\}\n]{1,24}\}|\$\{[A-Za-z_][A-Za-z0-9_]*\}|【[^】\n]{1,20}】|\{\{[^}]{1,24}\}\})")
    has_vartable = _has(t, r"(变量表|变量说明|占位符说明|变量定义|使用时替换|替换为)")
    material = _has(t, r"(参考素材|素材|背景资料|参考以下|如下资料|输入数据|给定数据|附上|参考资料)")
    if placeholder >= 2 and (has_vartable or material):
        return 10, []
    if placeholder >= 2:
        return 8, ["有多个占位符但缺变量表/素材说明（+2）"]
    if placeholder == 1 or material:
        return 6, ["上下文单薄：建议建立 {变量} 占位体系并附变量表（+4）"]
    if _has(t, r"(背景|情况是|我们|公司|项目)"):
        return 3, ["仅一句背景，缺素材锚点与占位符（+7）"]
    return 0, ["无上下文输入层（L4 缺失）（+10）"]


def score_format(t: str):
    """维度5 输出格式 (10): 结构类型 + 长度/分段/标注细节"""
    struct = _has(t, r"(Markdown|markdown|JSON|json|表格|列表|分点|标题|Schema|schema|字段|分级|结构化)")
    detail = _has(t, r"(字数|字以内|长度|段落|分段|每段|加粗|重点|顺序|层级|行数|不超过\s*\d+\s*字)")
    vague = _has(t, r"(格式清晰|格式规范|排版美观|简洁明了)")
    if struct and detail:
        return 10, []
    if struct:
        return 6, ["指定了输出结构但缺长度/分段/重点标注细则（+4）"]
    if vague:
        return 3, ["输出格式仅空话（如「格式清晰」），需写死结构（+7）"]
    return 0, ["未指定输出格式（L5 缺失）（+10）"]


def score_structure(t: str):
    """维度6 结构完整性 (10): 五层可指认 + 分段数"""
    layer_keys = {
        "L1身份": r"(角色身份|身份定义|##\s*角色|你是|You are)",
        "L2任务": r"(核心任务|任务目标|##\s*任务|你的任务|需要你|请完成)",
        "L3约束": r"(强制约束|约束规则|##\s*约束|禁止|不得|要求)",
        "L4上下文": r"(参考素材|上下文|##\s*素材|背景|\{[^\n]{1,20}\}|\$\{)",
        "L5格式": r"(输出格式|##\s*格式|返回格式|按.{0,8}格式|Markdown|JSON)",
    }
    hit = [k for k, p in layer_keys.items() if _has(t, p)]
    sections = _count(t, r"(^#{1,6}\s+\S|^一、|^二、|^三、|^四、|^五、|^\d+\.\s*[^\n]{2,}|^第[一二三四五六]层)", re.M)
    tips = []
    if len(hit) < 5:
        missing = [k for k in layer_keys if k not in hit]
        tips.append("五层未全部可指认，缺: " + "、".join(missing))
    s_map = {5: 10, 4: 7, 3: 4, 2: 4, 1: 4, 0: 0}
    return s_map[len(hit)], tips


def score_imperative(t: str):
    """维度7 可执行性 (15): 祈使句密度 - 客套惩罚"""
    verbs = _count(t, r"(生成|输出|撰写|写一|编写|分析|改写|重写|检查|审查|总结|摘要|翻译|优化|计算|评估|创作|设计|对比|提取|给出|列出|返回|读取|运行|交付|produce|write|output|return)")
    polite = _count(t, r"(希望你能|希望你|麻烦你|麻烦|你可以考虑|最好能够|能否请你|尽量|如果可以的话|可以吗|好不好)")
    base = 15 if verbs >= 3 else (10 if verbs >= 1 else 5)
    tips = []
    if polite:
        tips.append(f"发现 {polite} 处客套词（每处 -2），全部删除改为祈使句")
    return max(0, base - 2 * polite), tips


DANGEROUS_PATTERNS = [
    (r"sk-[A-Za-z0-9]{16,}", "疑似真实 API 密钥（sk- 开头长串）"),
    (r"(api[_-]?key|secret|token|password)\s*[=:]\s*['\"]?[A-Za-z0-9+/]{12,}", "疑似硬编码密钥/口令（应改 ${VAR} 占位）"),
    (r"1[3-9]\d{9}", "疑似真实手机号"),
]


def score_safety(t: str):
    """维度8 防幻觉与安全 (10): 防编造 + 兜底 + ${VAR} 卫生"""
    no_fabricate = _has(t, r"(不得编造|禁止编造|严禁编造|不要编造|不可编造|严禁虚构|不得虚构|仅基于|只基于|基于.{0,8}(素材|给定|资料)|仅使用.{0,8}(素材|给定))")
    fallback = _has(t, r"(不知道就说|无法解答|无法确认|注明|声明|标注|待确认|一律回复|统一回复)")
    danger = [msg for pat, msg in DANGEROUS_PATTERNS if _has(t, pat)]
    if danger:
        return 0, ["【一票警示】" + "；".join(danger) + " —— 必须修复后才可交付"]
    if no_fabricate and fallback:
        return 10, []
    if no_fabricate:
        return 6, ["有防编造声明但缺不确定时的兜底行为（+4）"]
    if _has(t, r"(准确|可靠|真实)"):
        return 3, ["仅笼统「要准确」，需显式防编造声明（+7）"]
    return 0, ["无任何防幻觉设计（+10）"]


# ---------- 总分 ----------

SHORT_LIMIT = 80  # 成品少于此字数视为过短


def evaluate(text: str):
    dims = [
        ("角色身份", 15, score_role(text)),
        ("任务目标", 15, score_task(text)),
        ("约束规则", 15, score_constraint(text)),
        ("上下文输入", 10, score_context(text)),
        ("输出格式", 10, score_format(text)),
        ("结构完整性", 10, score_structure(text)),
        ("可执行性", 15, score_imperative(text)),
        ("防幻觉与安全", 10, score_safety(text)),
    ]
    result = []
    total = 0
    for name, full, (s, tips) in dims:
        s = max(0, min(int(s), full))
        total += s
        result.append({"dim": name, "score": s, "full": full, "tips": tips})
    short = len(text.strip()) < SHORT_LIMIT
    capped = False
    if short:
        # 过短惩罚: 结构记 0 并压总分上限 60
        for item in result:
            if item["dim"] == "结构完整性":
                item["tips"] = ["全文不足 80 字，结构完整性记 0 分"] + item["tips"]
                total -= item["score"]
                item["score"] = 0
        total = min(total, 60)
        capped = True
    danger_hit = any("一票警示" in tip for item in result for tip in item["tips"])
    verdict = ("PASS 可交付" if total >= 95 else
               "ITERATE 定向迭代后重审" if total >= 90 else
               "REWORK 回炉重铸")
    return {"total": total, "verdict": verdict, "short_capped": capped,
            "danger": danger_hit, "dims": result}


# ---------- 自检 ----------

GOOD_SAMPLE = """## 角色身份
你是【电商行业】的资深增长分析师，有 10 年 B2B SaaS 数据经验，专注于 ARR 增长归因，仅回答增长与销售分析相关问题；超出范围的提问，一律回复：该问题超出我的服务范围。

## 核心任务
基于下方参考素材，输出一份区域销售同比分析报告，包含 TOP3 增长驱动因素与 3 条可执行建议，完成标准：每个结论均可由素材数据复算。

## 强制约束
1. 仅基于给定素材，不知道就说不知道，严禁编造任何数据与结论；
2. 语言通俗不生硬，面向非技术管理层，每个术语首次出现须用一句话解释；
3. 禁用「颠覆」「革命性」「赋能」等营销套话，感叹号全文不超过 1 个。

## 参考素材
{区域} = 华东 / 华南；{时间范围} = 2026Q2；{数据附件} = 【粘贴 CSV 数据】

变量表：{区域}=分析对象地区；{时间范围}=统计时间窗；{数据附件}=原始销售数据。

## 输出格式
Markdown 输出：结论摘要（3 条以内，加粗关键数字）→ 明细表（区域/同比/驱动因素）→ 方法说明与局限；全文 800 字以内，先给结论再给明细。
"""

BAD_SAMPLE = "帮我写个东西"

MID_SAMPLE = "你是一个写作助手。请帮我写一篇关于人工智能的文章，希望你能写得专业一些。"


def self_test():
    ok = True
    g = evaluate(GOOD_SAMPLE)
    b = evaluate(BAD_SAMPLE)
    m = evaluate(MID_SAMPLE)
    print(f"[self-test] 高分样例 total={g['total']} (期望 >=95) ... {'PASS' if g['total'] >= 95 else 'FAIL'}")
    ok &= g["total"] >= 95
    print(f"[self-test] 低分样例 total={b['total']} (期望 <=70) ... {'PASS' if b['total'] <= 70 else 'FAIL'}")
    ok &= b["total"] <= 70
    print(f"[self-test] 中档样例 total={m['total']} (期望 <90) ... {'PASS' if m['total'] < 90 else 'FAIL'}")
    ok &= m["total"] < 90
    print("[self-test] 结果:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


# ---------- 入口 ----------

def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    args = sys.argv[1:]
    if "--self-test" in args:
        sys.exit(self_test())
    if not args or args[0].startswith("-"):
        print(__doc__)
        sys.exit(2)
    path = args[0]
    if not os.path.isfile(path):
        print(f"文件不存在: {path}")
        sys.exit(2)
    text = _read_text(path)
    report = evaluate(text)
    if "--json" in args:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        line = " | ".join(f"{d['dim']} {d['score']}/{d['full']}" for d in report["dims"])
        print(f"总分 {report['total']}/100 | {line}")
        print(f"判定: {report['verdict']}")
        if report["short_capped"]:
            print("⚠ 过短惩罚: 成品不足 80 字，总分上限 60")
        if report["danger"]:
            print("⚠ 一票警示: 存在疑似真实密钥/隐私，必须 ${VAR} 化后重评")
        tips = [(d["dim"], tip) for d in report["dims"] for tip in d["tips"]]
        if tips:
            print("扣分明项（对照 references/score-rubric.md 修复）:")
            for dim, tip in tips:
                print(f"  - [{dim}] {tip}")
    sys.exit(0 if report["total"] >= 95 else 1)


if __name__ == "__main__":
    main()
