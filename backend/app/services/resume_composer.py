"""创建简历问答服务：问题步骤定义、答案校验、简历 Markdown 组装与 LLM 润色。

前端按 CREATE_STEPS 逐步向用户提问（每步一个问题 + 结构化表单），
finish 时把所有作答拼成结构化 Markdown（确定性组装，演示模式也能用），
配置了 LLM 时再润色一遍表述，随后交给 exporter 渲染为 PDF。
"""

from __future__ import annotations

import json
import logging

from ..config import MOCK
from ..prompts.create_polish import CREATE_POLISH_SYSTEM
from ..schemas import CreateAnswers
from .llm import LLMError, chat_json

logger = logging.getLogger("leapcv.create")


# ---------------------------------------------------------------------------
# 问题步骤定义（前端据此渲染向导；顺序即提问顺序）
# ---------------------------------------------------------------------------


def _field(name: str, label: str, *, type: str = "input", required: bool = False, placeholder: str = "") -> dict:
    return {"name": name, "label": label, "type": type, "required": required, "placeholder": placeholder}


_STEPS_RAW: list[dict] = [
    {
        "id": "basic",
        "title": "基本信息",
        "prompt": "先认识一下你吧：你叫什么名字？希望把什么联系方式放在简历上？这次求职的目标岗位是什么？",
        "tip": "HR 看简历的前三秒：清晰的求职意向 + 完整联系方式，是拿到面试邀约的第一步。",
        "allow_skip": False,
        "kind": "form",
        "fields": [
            _field("name", "姓名", required=True, placeholder="如：张三"),
            _field("phone", "电话", placeholder="如：13800000000"),
            _field("email", "邮箱", placeholder="如：you@example.com"),
            _field("city", "期望城市", placeholder="如：上海"),
            _field("intent", "求职意向", required=True, placeholder="如：后端开发工程师"),
            _field("links", "GitHub / 个人主页（可选）", placeholder="如：github.com/yourname"),
        ],
    },
    {
        "id": "education",
        "title": "教育背景",
        "prompt": "请告诉我你的教育背景。如果有多段学历（如本科 + 硕士），可以逐条添加。",
        "tip": "最高学历放第一条；GPA、核心课程、奖学金等亮点写进「补充描述」，每行一条。",
        "allow_skip": False,
        "kind": "list",
        "entry_label": "教育经历",
        "fields": [
            _field("school", "学校", required=True, placeholder="如：清华大学"),
            _field("major", "专业", placeholder="如：计算机科学与技术"),
            _field("degree", "学历", placeholder="如：本科 / 硕士"),
            _field("period", "时间段", placeholder="如：2020.09 - 2024.06"),
            _field("notes", "补充描述（可选）", type="textarea", placeholder="GPA、核心课程、荣誉等，每行一条"),
        ],
    },
    {
        "id": "work",
        "title": "工作经历",
        "prompt": "聊聊你的正式工作经历吧。每段经历请列出 2-4 条最能代表你能力的成果。",
        "tip": "描述建议动词开头（主导 / 设计 / 落地），尽量带量化结果；没有正式工作经验可以跳过。",
        "allow_skip": True,
        "kind": "list",
        "entry_label": "工作经历",
        "fields": [
            _field("company", "公司", required=True, placeholder="如：某科技有限公司"),
            _field("position", "职位", required=True, placeholder="如：后端开发工程师"),
            _field("period", "时间段", placeholder="如：2024.07 - 至今"),
            _field("highlights", "主要职责 / 成果", type="textarea", required=True, placeholder="每行一条，建议 2-4 条"),
        ],
    },
    {
        "id": "internship",
        "title": "实习经历",
        "prompt": "如果有实习经历，一定别漏掉——对应届生来说，实习是最有说服力的实战证明。",
        "tip": "没有实习经历可以跳过；每段实习同样建议 2-4 条成果描述。",
        "allow_skip": True,
        "kind": "list",
        "entry_label": "实习经历",
        "fields": [
            _field("company", "实习公司", required=True, placeholder="如：某互联网公司"),
            _field("position", "实习岗位", required=True, placeholder="如：研发实习生"),
            _field("period", "时间段", placeholder="如：2023.07 - 2023.09"),
            _field("highlights", "主要职责 / 成果", type="textarea", required=True, placeholder="每行一条，建议 2-4 条"),
        ],
    },
    {
        "id": "project",
        "title": "项目经历",
        "prompt": "有哪些项目最能体现你的能力？建议挑 1-2 个与目标岗位最相关的项目展开讲。",
        "tip": "课程项目、竞赛项目、开源项目、独立作品都算；写清楚你的角色和具体贡献。",
        "allow_skip": True,
        "kind": "list",
        "entry_label": "项目经历",
        "fields": [
            _field("name", "项目名称", required=True, placeholder="如：校园二手交易平台"),
            _field("role", "角色 / 技术栈", placeholder="如：后端负责人 / Python · FastAPI · MySQL"),
            _field("period", "时间段", placeholder="如：2023.03 - 2023.10"),
            _field("highlights", "主要职责 / 成果", type="textarea", required=True, placeholder="每行一条，建议 2-4 条"),
        ],
    },
    {
        "id": "skills",
        "title": "技能与亮点",
        "prompt": "最后一步：请列出你掌握的专业技能（每行一条）、获奖或证书情况，并用 2-3 句话写一段自我评价。后两项可留空。",
        "tip": "技能请对照目标岗位 JD 来列，这是简历被关键词检索命中的关键。",
        "allow_skip": False,
        "kind": "form",
        "fields": [
            _field("skills", "专业技能", type="textarea", required=True, placeholder="每行一条，如：熟练使用 Python / FastAPI，3 年后端开发经验"),
            _field("awards", "获奖 / 证书（可选）", type="textarea", placeholder="每行一条，如：\nCET-6（580 分）\n国家奖学金"),
            _field("self_evaluation", "自我评价（可选）", type="textarea", placeholder="2-3 句话概括核心优势，用事实说话，避免空泛套话"),
        ],
    },
]

# 补齐 index / total，前端直接渲染进度
CREATE_STEPS: list[dict] = [
    {**s, "index": i + 1, "total": len(_STEPS_RAW)}
    for i, s in enumerate(_STEPS_RAW)
]

# 步骤 id → 对应答案字段（list 型步骤是列表字段，form 型是标量字段集合）
_STEP_ANSWER_KEY = {
    "basic": None,  # basic 的答案直接展开到顶层标量字段
    "education": "education",
    "work": "work",
    "internship": "internships",
    "project": "projects",
    "skills": None,  # skills 步骤的答案同样展开到顶层标量字段
}


# ---------------------------------------------------------------------------
# 校验与清洗
# ---------------------------------------------------------------------------


def _clean(value: str) -> str:
    return (value or "").strip()


def validate_answers(a: CreateAnswers) -> None:
    """整体校验；不通过抛 ValueError（message 面向用户展示）。"""
    errors: list[str] = []
    if not _clean(a.name):
        errors.append("姓名不能为空")
    has_body = bool(a.education or a.work or a.internships or a.projects or _clean(a.skills))
    if not has_body:
        errors.append("请至少填写教育经历、工作/实习、项目经历或专业技能中的部分内容")
    if errors:
        raise ValueError("；".join(errors))


def _clean_answers(a: CreateAnswers) -> CreateAnswers:
    """递归去除首尾空白、丢弃整条全空的经历条目。"""
    a = a.model_copy(deep=True)
    a.name, a.phone, a.email, a.city, a.intent, a.links = (
        _clean(v) for v in (a.name, a.phone, a.email, a.city, a.intent, a.links)
    )
    a.skills, a.awards, a.self_evaluation = (
        _clean(v) for v in (a.skills, a.awards, a.self_evaluation)
    )
    a.education = [e for e in a.education if any(_clean(getattr(e, f)) for f in ("school", "major", "degree", "period", "notes"))]
    a.work = [w for w in a.work if any(_clean(getattr(w, f)) for f in ("company", "position", "period")) or any(_clean(h) for h in w.highlights)]
    a.internships = [w for w in a.internships if any(_clean(getattr(w, f)) for f in ("company", "position", "period")) or any(_clean(h) for h in w.highlights)]
    a.projects = [p for p in a.projects if any(_clean(getattr(p, f)) for f in ("name", "role", "period")) or any(_clean(h) for h in p.highlights)]
    for e in a.education:
        e.school, e.major, e.degree, e.period, e.notes = (_clean(v) for v in (e.school, e.major, e.degree, e.period, e.notes))
    for w in list(a.work) + list(a.internships):
        w.company, w.position, w.period = (_clean(v) for v in (w.company, w.position, w.period))
        w.highlights = [_clean(h) for h in w.highlights if _clean(h)]
    for p in a.projects:
        p.name, p.role, p.period = (_clean(v) for v in (p.name, p.role, p.period))
        p.highlights = [_clean(h) for h in p.highlights if _clean(h)]
    return a


def _split_lines(text: str, limit: int = 30) -> list[str]:
    """多行文本拆成条目列表：去掉行首的 - / • 等符号。"""
    out: list[str] = []
    for line in (text or "").replace("\r\n", "\n").split("\n"):
        line = line.strip().lstrip("-•·•").strip()
        if line and line not in out:
            out.append(line)
        if len(out) >= limit:
            break
    return out


def _entry_line(*parts: str) -> str:
    """条目标题：`### A ｜ B ｜ C`，自动省略空段，避免悬挂竖线。"""
    kept = [p for p in parts if p]
    return "### " + " ｜ ".join(kept) if kept else ""


# ---------------------------------------------------------------------------
# Markdown 组装（确定性，演示模式 / LLM 失败兜底都走这里）
# ---------------------------------------------------------------------------


def compose_resume_md(a: CreateAnswers) -> str:
    """把问答答案拼成导出服务可解析的简历 Markdown。"""
    a = _clean_answers(a)
    lines: list[str] = []

    lines.append(f"# {a.name}")
    head_bits: list[str] = []
    if a.intent:
        head_bits.append(f"求职意向：{a.intent}")
    if a.phone:
        head_bits.append(f"电话：{a.phone}")
    if a.email:
        head_bits.append(f"邮箱：{a.email}")
    if a.city:
        head_bits.append(f"城市：{a.city}")
    if a.links:
        head_bits.append(f"主页：{a.links}")
    if head_bits:
        lines.append(" ｜ ".join(head_bits))
    lines.append("")

    if a.education:
        lines.append("## 教育经历")
        for e in a.education:
            sub = " · ".join(x for x in (e.major, e.degree) if x)
            title = _entry_line(e.school, sub, e.period)
            if not title:
                continue
            lines.append(title)
            lines.extend(f"- {n}" for n in _split_lines(e.notes, 10))
            lines.append("")

    def _work_block(section_title: str, items: list) -> None:
        if not items:
            return
        lines.append(f"## {section_title}")
        for w in items:
            title = _entry_line(w.company, w.position, w.period)
            if not title:
                continue
            lines.append(title)
            lines.extend(f"- {h}" for h in w.highlights[:10])
            lines.append("")

    _work_block("工作经历", a.work)
    _work_block("实习经历", a.internships)

    if a.projects:
        lines.append("## 项目经历")
        for p in a.projects:
            title = _entry_line(p.name, p.role, p.period)
            if not title:
                continue
            lines.append(title)
            lines.extend(f"- {h}" for h in p.highlights[:10])
            lines.append("")

    skills = _split_lines(a.skills, 30)
    if skills:
        lines.append("## 专业技能")
        lines.extend(f"- {s}" for s in skills)
        lines.append("")

    awards = _split_lines(a.awards, 20)
    if awards:
        lines.append("## 获奖情况")
        lines.extend(f"- {s}" for s in awards)
        lines.append("")

    if a.self_evaluation:
        lines.append("## 自我评价")
        for para in a.self_evaluation.replace("\r\n", "\n").split("\n"):
            para = para.strip()
            if para:
                lines.append(para)
                lines.append("")

    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 结构化结果（写入 resumes.structured_json，"我的简历"页可直接展示）
# ---------------------------------------------------------------------------


def build_struct(a: CreateAnswers) -> dict:
    """映射为 ResumeStruct 形状（与 LLM 简历解析阶段输出一致）。"""
    a = _clean_answers(a)
    found: list[str] = []
    if a.name or a.phone or a.email:
        found.append("基本信息")
    if a.intent:
        found.append("求职意向")
    if a.education:
        found.append("教育经历")
    if a.work:
        found.append("工作经历")
    if a.internships:
        found.append("实习经历")
    if a.projects:
        found.append("项目经历")
    if _split_lines(a.skills):
        found.append("专业技能")
    if _split_lines(a.awards):
        found.append("获奖情况")
    if a.self_evaluation:
        found.append("自我评价")
    all_sections = [
        "基本信息",
        "求职意向",
        "教育经历",
        "工作经历",
        "实习经历",
        "项目经历",
        "专业技能",
        "获奖情况",
        "自我评价",
    ]
    return {
        "name": a.name,
        "phone": a.phone,
        "email": a.email,
        "current_position": a.intent,
        "years_of_experience": None,
        "education": [
            {"school": e.school, "major": e.major, "degree": e.degree, "period": e.period}
            for e in a.education
        ],
        "work": [
            {"company": w.company, "position": w.position, "period": w.period, "highlights": w.highlights}
            for w in a.work
        ],
        "internships": [
            {"company": w.company, "position": w.position, "period": w.period, "highlights": w.highlights}
            for w in a.internships
        ],
        "projects": [
            {"name": p.name, "role": p.role, "period": p.period, "highlights": p.highlights}
            for p in a.projects
        ],
        "skills": _split_lines(a.skills),
        "languages": [],
        "awards": _split_lines(a.awards),
        "self_evaluation": a.self_evaluation,
        "sections_found": found,
        "sections_missing": [s for s in all_sections if s not in found],
        "parse_source": "create",
    }


# ---------------------------------------------------------------------------
# LLM 润色（演示模式或失败时返回 None，前端/落库保持基线版）
# ---------------------------------------------------------------------------


def polish_resume(a: CreateAnswers, base_md: str) -> str | None:
    """调用 LLM 润色基线简历；返回 None 表示未润色（用基线版）。"""
    if MOCK:
        return None
    payload = json.dumps(build_struct(a), ensure_ascii=False)
    user = f"【问答作答（JSON）】\n{payload}\n\n【基线简历（Markdown）】\n{base_md}\n\n请润色后输出最终简历。"
    try:
        out = chat_json(CREATE_POLISH_SYSTEM, user, temperature=0.4)
    except LLMError as e:
        logger.warning("简历润色失败，回退基线版：%s", e)
        return None
    md = str(out.get("resume_md") or "").strip()
    if len(md) < 50 or not md.startswith("#"):
        logger.warning("LLM 润色输出异常，回退基线版（len=%d）", len(md))
        return None
    return md
