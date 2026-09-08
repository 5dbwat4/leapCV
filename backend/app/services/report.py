"""Match Report（匹配报告）：基于规则检查项的可解释报告。

与 LLM 评估互补——报告中的检查项全部可由规则确定性复现，
逐条给出 ✓/✗ 及改进提示，按五个维度归类。
"""

import re

from .matcher import keyword_hit, _normalize

PHONE_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
TIMELINE_RE = re.compile(r"(19|20)\d{2}\s*[年.\-/]")
QUANT_RE = re.compile(r"\d+(\.\d+)?\s*[%％万kK+]|\d+\s*(人|个|次|单|篇|台|款|万)")

SECTION_CHECKS = [
    ("求职意向", r"求职意向|应聘岗位|目标岗位|期望(职位|岗位)|求职目标",
     "明确了求职意向，HR 能快速判断你与岗位的匹配方向",
     "在简历顶部添加一行求职意向（目标岗位），帮助 HR 快速定位"),
    ("教育经历", r"教育(经历|背景|信息)|教育",
     "包含教育经历板块，学历背景一目了然",
     "补充教育经历板块（学校、专业、学历、时间段）"),
    ("工作经历", r"(工作|从业|职业|实习)(经历|经验)|工作经历",
     "包含工作/实习经历板块",
     "补充工作经历板块（公司、职位、时间段、主要成果）"),
    ("项目经历", r"项目(经历|经验|背景)",
     "包含项目经历板块，能立体展示实战能力",
     "补充 1-2 个与目标岗位最相关的项目经历"),
    ("专业技能", r"专业技能|技能特长|核心技能|技能清单|IT技能|掌握的技术|熟悉|熟练",
     "包含专业技能清单，便于关键词检索命中",
     "增加专业技能板块，按熟练程度分组列出与岗位相关的技能"),
]

# 内容质量维度覆盖的问题类型
CONTENT_ISSUE_TYPES = {"缺乏量化", "描述空泛", "口语化表述", "语病", "错别字", "真实性风险", "信息缺失"}
# 格式规范维度覆盖的问题类型
FORMAT_ISSUE_TYPES = {"格式问题", "结构问题"}

CATEGORY_INTROS = {
    "searchability": (
        "可检索性决定你的简历能否被招聘系统（ATS）与 HR 的关键词搜索命中。"
        "补充完整的基础信息、使用标准板块标题，能显著提高简历被检索和正确解析的概率。"
    ),
    "hard_skills": (
        "逐项对照岗位 JD 的硬技能要求，检查简历中是否有对应体现。"
        "缺失关键硬技能是简历在机器筛选与 HR 初审阶段被淘汰的最主要原因。"
    ),
    "soft_skills": (
        "软技能是 JD 中隐性的团队契合度信号。"
        "在经历描述中用事实自然体现这些能力（而非堆砌形容词），会明显加分。"
    ),
    "formatting": (
        "规范的版式与结构能让 HR 在 10 秒内抓住重点，也便于招聘系统正确解析简历内容。"
    ),
    "content": (
        "内容质量对筛选结果影响最大：量化成果、少写空话套话、杜绝错别字，"
        "是 HR 判断候选人专业度的核心依据。"
    ),
}


def _check(passed: bool, ok_text: str, fail_text: str, tip: str | None = None) -> dict:
    if passed:
        return {"passed": True, "text": ok_text}
    item = {"passed": False, "text": fail_text}
    if tip:
        item["tip"] = tip
    return item


def _category(key: str, name: str, checks: list[dict]) -> dict:
    total = len(checks)
    failed = sum(1 for c in checks if not c["passed"])
    score = round((total - failed) / total * 100) if total else 100
    return {
        "key": key,
        "name": name,
        "score": score,
        "issues": failed,
        "intro": CATEGORY_INTROS[key],
        "checks": checks,
    }


def _searchability_checks(resume_text: str) -> list[dict]:
    checks = [
        _check(
            bool(PHONE_RE.search(resume_text)),
            "提供了联系电话，招聘方可以直接联系你",
            "未找到有效的手机号码",
            "在简历顶部补充 11 位手机号码，这是招聘方联系你的首选方式",
        ),
        _check(
            bool(EMAIL_RE.search(resume_text)),
            "提供了电子邮箱，便于接收面试邀约",
            "未找到电子邮箱地址",
            "在简历顶部补充常用邮箱，避免使用过于随意的邮箱名",
        ),
    ]
    for name, pattern, ok_text, fail_tip in SECTION_CHECKS:
        checks.append(
            _check(
                bool(re.search(pattern, resume_text)),
                ok_text,
                f"未检测到「{name}」板块",
                fail_tip,
            )
        )
    return checks


def _hard_skill_checks(resume_text: str, jd_struct: dict) -> list[dict]:
    resume_norm = _normalize(resume_text)
    checks: list[dict] = []
    for kw in jd_struct.get("hard_skills", []):
        name = str(kw.get("name", "")).strip()
        if not name:
            continue
        required = kw.get("required") is not False
        if keyword_hit(resume_norm, name, kw.get("aliases")):
            checks.append(_check(True, f"已体现岗位要求的「{name}」", ""))
        else:
            tag = "核心必备项" if required else "加分项"
            checks.append(
                _check(
                    False,
                    "",
                    f"简历未体现岗位要求的「{name}」（{tag}）",
                    f"若具备相关经验，在技能清单或经历中补充「{name}」的真实使用场景；若尚未掌握且为必备项，建议优先补强",
                )
            )
    return checks


def _soft_skill_checks(resume_text: str, jd_struct: dict) -> list[dict]:
    resume_norm = _normalize(resume_text)
    checks: list[dict] = []
    for skill in jd_struct.get("soft_skills", []):
        name = str(skill).strip()
        if not name:
            continue
        checks.append(
            _check(
                _normalize(name) in resume_norm,
                f"简历中体现了「{name}」",
                f"简历未体现 JD 要求的「{name}」",
                f"在经历描述中用具体事例体现「{name}」，如跨团队协作、推动对齐等场景，避免只写形容词",
            )
        )
    return checks


def _formatting_checks(resume_text: str, issues: list[dict]) -> list[dict]:
    checks = [
        _check(
            bool(TIMELINE_RE.search(resume_text)),
            "包含清晰的时间线（教育/工作时间段）",
            "未检测到明确的时间信息",
            "为教育和工作经历补充起止时间（如 2021.09 - 2025.06），时间线是可信度的基础",
        ),
        _check(
            bool(QUANT_RE.search(resume_text)),
            "简历中包含量化数据（数字/百分比），表达更可信",
            "全篇缺少数字化的成果描述",
            "把成果改写为可量化的表达，如「效率提升 30%」「支撑日均 5 万单」「管理 10 人团队」",
        ),
    ]
    for issue in issues:
        if issue.get("type") in FORMAT_ISSUE_TYPES:
            original = str(issue.get("original") or "").strip()
            prefix = f"「{original}」" if original else ""
            checks.append(
                _check(
                    False,
                    "",
                    f"{issue.get('type')}：{prefix}{issue.get('problem', '')}".strip(),
                    issue.get("suggestion"),
                )
            )
    if not any(not c["passed"] for c in checks[2:]):
        checks.append(_check(True, "版式结构清晰，未发现明显的格式或结构问题", ""))
    return checks


def _content_checks(issues: list[dict]) -> list[dict]:
    checks: list[dict] = []
    content_issues = [i for i in issues if i.get("type") in CONTENT_ISSUE_TYPES]
    for issue in content_issues:
        original = str(issue.get("original") or "").strip()
        prefix = f"「{original}」" if original else ""
        checks.append(
            _check(
                False,
                "",
                f"{issue.get('type')}：{prefix}{issue.get('problem', '')}".strip(),
                issue.get("suggestion"),
            )
        )
    if not content_issues:
        checks.append(_check(True, "未发现明显的表达与内容风险", ""))
    return checks


def build_report(resume_text: str, jd_struct: dict, issues: list[dict]) -> dict:
    """生成匹配报告。jd_struct 为空（旧记录/JD 抽取失败）时跳过技能维度。"""
    categories = [_category("searchability", "可检索性", _searchability_checks(resume_text))]

    hard_checks = _hard_skill_checks(resume_text, jd_struct or {})
    if hard_checks:
        categories.append(_category("hard_skills", "硬技能", hard_checks))

    soft_checks = _soft_skill_checks(resume_text, jd_struct or {})
    if soft_checks:
        categories.append(_category("soft_skills", "软技能", soft_checks))

    categories.append(_category("formatting", "格式规范", _formatting_checks(resume_text, issues)))
    categories.append(_category("content", "内容质量", _content_checks(issues)))

    return {
        "categories": categories,
        "total_passed": sum(len(c["checks"]) - c["issues"] for c in categories),
        "total_failed": sum(c["issues"] for c in categories),
    }
