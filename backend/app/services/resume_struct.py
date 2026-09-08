"""启发式简历结构化：不依赖 LLM 的规则解析，用于演示模式与降级场景。

尽力而为的抽取，输出与 LLM 简历解析阶段（resume_extract prompt）相同的结构。
"""

import re

from .report import EMAIL_RE, PHONE_RE, TIMELINE_RE

# 板块标题 → 标准板块名（顺序即匹配优先级，实习经历须先于工作经历判断）
_HEADING_PATTERNS: list[tuple[str, str]] = [
    ("实习经历", r"实习(经历|经验|情况)?"),
    ("工作经历", r"(工作|从业|职业)(经历|经验)"),
    ("教育经历", r"教育(经历|背景|信息)?"),
    ("项目经历", r"项目(经历|经验|背景)"),
    ("专业技能", r"(专业技能|技能特长|核心技能|技能清单|IT技能|专业技能|技能)"),
    ("语言能力", r"(语言|外语)能力|语言水平|语言技能"),
    ("获奖情况", r"(获奖|荣誉|奖项)(情况|经历)?|荣誉奖项"),
    ("自我评价", r"(自我评价|个人评价|个人优势|关于我)"),
    ("求职意向", r"求职意向|应聘岗位|目标岗位"),
]

_DEGREE_RE = re.compile(r"本科|硕士|研究生|大专|专科|博士|MBA|大专")
_NAME_LINE_RE = re.compile(r"^[\u4e00-\u9fa5a-zA-Z·]{2,8}$")
_SPLIT_RE = re.compile(r"[\s｜|,，、;；]+")


def _split_sections(text: str) -> dict[str, list[str]]:
    """按短行标题把简历切成板块；返回 {标准板块名: [内容行]}。"""
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        is_heading = False
        if len(line) <= 15 and not any(ch.isdigit() for ch in line):
            for std_name, pattern in _HEADING_PATTERNS:
                if re.fullmatch(pattern, line) or line.startswith(std_name[:2]):
                    current = std_name
                    sections.setdefault(current, [])
                    is_heading = True
                    break
        if not is_heading:
            if current:
                sections[current].append(line)
            else:
                sections.setdefault("头部", []).append(line)
    return sections


def _find_period(line: str) -> str:
    m = TIMELINE_RE.search(line)
    if not m:
        return ""
    start = m.start()
    tail = line[start : start + 24]
    mm = re.match(r"((?:19|20)\d{2}\s*[年.\-/]\s*(?:\d{1,2}\s*月?)?\s*[-—至~]?\s*(?:(?:19|20)\d{2})?\s*[年.\-/]?\s*(?:\d{1,2}\s*月?)?(?:\s*[至今 Present.]*)?)", tail)
    return (mm.group(1) if mm else tail).strip()


def _parse_education(lines: list[str]) -> list[dict]:
    items: list[dict] = []
    for line in lines:
        period = _find_period(line)
        degree_m = _DEGREE_RE.search(line)
        parts = [p for p in _SPLIT_RE.split(line) if p]
        school = parts[0] if parts else line
        major = ""
        for p in parts[1:3]:
            if p not in (period,) and not _DEGREE_RE.fullmatch(p):
                major = p
                break
        items.append(
            {
                "school": school,
                "major": major,
                "degree": degree_m.group(0) if degree_m else "",
                "period": period,
            }
        )
    return items


def _looks_like_org(line: str) -> bool:
    return bool(re.search(r"公司|科技|有限|集团|银行|研究院|事务所|工作室|工厂|学院|大学", line))


def _parse_work(lines: list[str]) -> list[dict]:
    items: list[dict] = []
    for line in lines:
        period = _find_period(line)
        is_entry = bool(TIMELINE_RE.search(line)) or _looks_like_org(line)
        if not items:
            items.append({"company": "", "position": "", "period": "", "highlights": []})
        if is_entry:
            parts = [p for p in _SPLIT_RE.split(line) if p]
            items.append(
                {
                    "company": parts[0] if parts else line,
                    "position": parts[1] if len(parts) > 1 and not re.fullmatch(TIMELINE_RE, parts[1]) else "",
                    "period": period,
                    "highlights": [],
                }
            )
        else:
            items[-1]["highlights"].append(line)
    return [it for it in items if it["company"] or it["highlights"]]


def _parse_projects(lines: list[str]) -> list[dict]:
    items: list[dict] = []
    for line in lines:
        period = _find_period(line)
        has_break = bool(TIMELINE_RE.search(line)) or line.startswith(("项目", "【"))
        if has_break or not items:
            parts = [p for p in _SPLIT_RE.split(line) if p]
            items.append(
                {
                    "name": parts[0] if parts else line,
                    "role": parts[1] if len(parts) > 1 else "",
                    "period": period,
                    "highlights": [],
                }
            )
        else:
            items[-1]["highlights"].append(line)
    return items


_LANGUAGE_TOKEN_RE = re.compile(
    r"(英语|日语|韩语|法语|德语|俄语|西班牙语|普通话|汉语|粤语)[^\n，,。；;]{0,18}"
)


def _parse_languages(lines: list[str], full_text: str) -> list[str]:
    """语言能力：优先取板块内容；没有板块时从全文扫常见语言关键词。"""
    segments: list[str] = []
    for line in lines:
        pieces = _SPLIT_RE.split(re.sub(r"^((语言|外语)能力|语言水平|语言技能)[：:]?", "", line))
        segments.extend(p for p in pieces if p.strip())
    if not segments:
        for m in _LANGUAGE_TOKEN_RE.finditer(full_text):
            segments.append(m.group(0).strip())
    out: list[str] = []
    for seg in segments:
        seg = seg.strip(" 。.;；")
        if 1 < len(seg) <= 30 and seg not in out:
            out.append(seg)
    return out[:10]


def _parse_awards(lines: list[str]) -> list[str]:
    """获奖情况：每行一条；行内用顿号/分号分隔的多项自动拆开。"""
    out: list[str] = []
    for line in lines:
        line = re.sub(r"^((获奖|荣誉|奖项)(情况|经历)?|荣誉奖项)[：:]?", "", line).strip()
        if not line:
            continue
        # 行较长且含分隔符时视为多项并列
        pieces = _SPLIT_RE.split(line) if len(line) > 12 else [line]
        for piece in pieces:
            piece = piece.strip(" 。.;；")
            if 2 <= len(piece) <= 40 and piece not in out:
                out.append(piece)
    return out[:20]


def heuristic_resume_struct(text: str) -> dict:
    sections = _split_sections(text)
    head = " ".join(sections.get("头部", []))
    full_head = text.splitlines()[0].strip() if text.splitlines() else ""

    name = ""
    for line in (full_head, head):
        name_m = re.search(r"姓名[：:]\s*([\u4e00-\u9fa5a-zA-Z·]{2,8})", line)
        if name_m:
            name = name_m.group(1)
            break
        if not name and _NAME_LINE_RE.fullmatch(line.split()[0] if line.split() else ""):
            name = line.split()[0]
            break

    email_m = EMAIL_RE.search(text)
    phone_m = PHONE_RE.search(text)

    intent = ""
    intent_lines = sections.get("求职意向", [])
    if intent_lines:
        intent = intent_lines[0]
    else:
        intent_m = re.search(r"求职意向[：:]?\s*(\S{2,25})", text)
        intent = intent_m.group(1) if intent_m else ""
    years_m = re.search(r"(\d{1,2})\s*年.{0,6}(工作|从业|开发)?经验", text)
    years = int(years_m.group(1)) if years_m else None

    skills: list[str] = []
    for line in sections.get("专业技能", []):
        for piece in _SPLIT_RE.split(re.sub(r"^(专业技能|技能特长|核心技能)[：:]?", "", line)):
            piece = piece.strip()
            if 1 < len(piece) <= 20 and piece not in skills:
                skills.append(piece)
        if len(skills) >= 20:
            break

    languages = _parse_languages(sections.get("语言能力", []), text)
    awards = _parse_awards(sections.get("获奖情况", []))
    self_evaluation = "\n".join(sections.get("自我评价", [])).strip()

    work = _parse_work(sections.get("工作经历", []))
    internships = _parse_work(sections.get("实习经历", []))
    education = _parse_education(sections.get("教育经历", []))
    projects = _parse_projects(sections.get("项目经历", []))

    found = [
        std
        for std, keys in [
            ("基本信息", bool(name or phone_m or email_m)),
            ("求职意向", bool(intent)),
            ("教育经历", bool(education)),
            ("工作经历", bool(work)),
            ("实习经历", bool(internships)),
            ("项目经历", bool(projects)),
            ("专业技能", bool(skills)),
            ("语言能力", bool(languages)),
            ("获奖情况", bool(awards)),
            ("自我评价", bool(self_evaluation)),
        ]
        if keys
    ]
    all_sections = [
        "基本信息",
        "求职意向",
        "教育经历",
        "工作经历",
        "实习经历",
        "项目经历",
        "专业技能",
        "语言能力",
        "获奖情况",
        "自我评价",
    ]
    missing = [s for s in all_sections if s not in found]

    return {
        "name": name,
        "phone": phone_m.group(0) if phone_m else "",
        "email": email_m.group(0) if email_m else "",
        "current_position": intent,
        "years_of_experience": years,
        "education": education,
        "work": work,
        "internships": internships,
        "projects": projects,
        "skills": skills,
        "languages": languages,
        "awards": awards,
        "self_evaluation": self_evaluation,
        "sections_found": found,
        "sections_missing": missing,
        "parse_source": "heuristic",
    }
