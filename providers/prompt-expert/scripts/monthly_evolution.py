#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""monthly_evolution.py — 提示词专家 月度进化自检脚本

用途（对应 SKILL.md「月度自动进化」节，建议每月 1 日 0-1 点执行）:
    python monthly_evolution.py --check            # 检查 references 知识截止是否滞后
    python monthly_evolution.py --bump [--to YYYY-MM]  # 更新知识截止标记并写进化日志

零依赖: 仅 Python 标准库 (Python 3.8+)。
"""
import sys
import re
import os
import datetime

MARK_RE = re.compile(r"知识截止[：:]\s*(\d{4})-(\d{2})")


def refs_dir() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "references"))


def scan():
    """返回 [(文件名, (年, 月)), ...]"""
    out = []
    d = refs_dir()
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".md"):
            continue
        p = os.path.join(d, fn)
        try:
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                head = f.read(4000)
        except OSError:
            continue
        m = MARK_RE.search(head)
        if m:
            out.append((fn, (int(m.group(1)), int(m.group(2)))))
    return out


def cmd_check() -> int:
    now = datetime.date.today()
    cur = (now.year, now.month)
    files = scan()
    if not files:
        print("未在 references/ 找到任何「知识截止：YYYY-MM」标记，请检查资源文件完整性。")
        return 2
    stale = []
    for fn, (y, mth) in files:
        status = "OK" if (y, mth) >= cur else "STALE"
        print(f"  [{status}] {fn}: 知识截止 {y}-{mth:02d}（当前 {cur[0]}-{cur[1]:02d}）")
        if status == "STALE":
            stale.append(fn)
    if stale:
        print()
        print("存在滞后文件，进化任务清单（每月 1 日 0-1 点执行）:")
        for fn in stale:
            print(f"  1. 联网检索 {fn} 对应领域 2026 年最新实践/规范/竞品动态")
            print(f"  2. 以「只增不改」方式追加新结论条目（注明日期与来源）")
            print(f"  3. 更新该文件头部「知识截止」标记（或运行 --bump 统一更新）")
        print()
        print("完成上述步骤后运行: python monthly_evolution.py --bump && python monthly_evolution.py --check")
        return 2
    print()
    print("时效已同步：全部 references 知识截止不早于当前月份。")
    return 0


def cmd_bump(to: str) -> int:
    y, mth = (int(x) for x in to.split("-"))
    d = refs_dir()
    changed = []
    for fn, _ in scan():
        p = os.path.join(d, fn)
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        new = MARK_RE.sub(f"知识截止：{y}-{mth:02d}", content, count=1)
        if new != content:
            with open(p, "w", encoding="utf-8", newline="") as f:
                f.write(new)
            changed.append(fn)
    log = os.path.join(d, "evolution-log.md")
    today = datetime.date.today().isoformat()
    with open(log, "a", encoding="utf-8") as f:
        if not os.path.isfile(log) or os.path.getsize(log) == 0:
            f.write("# 月度进化日志（只增不改）\n\n")
        f.write(f"## {today} 进化记录\n")
        f.write(f"- 知识截止标记更新至 {y}-{mth:02d}，涉及文件: {', '.join(changed) if changed else '无'}\n")
        f.write("- 本轮新增结论: （待人工填充——按 --check 清单联网检索后逐条追加，注明日期与来源）\n\n")
    print(f"已更新 {len(changed)} 个文件的知识截止标记至 {y}-{mth:02d}: {', '.join(changed) if changed else '无'}")
    print(f"进化日志已写入: {log}")
    print("⚠ 标记更新 ≠ 内容更新：请先按 --check 任务清单联网补充最新知识，再重跑 --check 确认。")
    return 0


def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    args = sys.argv[1:]
    if "--check" in args:
        sys.exit(cmd_check())
    if "--bump" in args:
        to = None
        if "--to" in args:
            i = args.index("--to")
            if i + 1 < len(args):
                to = args[i + 1]
        if not to:
            now = datetime.date.today()
            to = f"{now.year}-{now.month:02d}"
        if not re.fullmatch(r"\d{4}-\d{2}", to):
            print("格式错误: --to 需要 YYYY-MM")
            sys.exit(2)
        sys.exit(cmd_bump(to))
    print(__doc__)
    sys.exit(2)


if __name__ == "__main__":
    main()
