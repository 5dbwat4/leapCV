"""AI 分析管线：简历解析 → JD 抽取 → 匹配分析 → 风险诊断 → 内容重构。"""

import json
import logging
import re
import time
from typing import Callable

from ..config import MOCK
from ..prompts import diagnose as diagnose_prompt
from ..prompts import jd_extract as jd_extract_prompt
from ..prompts import match_assess as match_prompt
from ..prompts import resume_extract as resume_prompt
from ..prompts import rewrite as rewrite_prompt
from .llm import chat_json
from .matcher import compute_skill_match
from .mock_data import (
    ISSUE_INTERVAL,
    REWRITE_INTERVAL,
    SKILL_INTERVAL,
    run_mock_pipeline,
)
from .report import build_report

logger = logging.getLogger("leapcv.pipeline")

# 事件回调：emit(事件名, payload dict)。除 progress 外还包括 resume_struct / jd_struct /
# score / skill / issue / rewrite 等细粒度事件，由 SSE 层原样转发，供前端驱动实时动画。
EmitCallback = Callable[[str, dict], None]

STAGES = [
    ("parse_resume", "正在解析简历结构…", 8),
    ("parse_resume", "简历解析完成", 22),
    ("parse_jd", "正在解析岗位 JD 要求…", 30),
    ("parse_jd", "JD 解析完成", 45),
    ("match", "正在计算岗位匹配度…", 52),
    ("match", "匹配度计算完成", 64),
    ("diagnose", "正在诊断简历风险…", 70),
    ("diagnose", "风险诊断完成", 80),
    ("rewrite", "正在重构简历内容、挖掘亮点…", 86),
    ("rewrite", "内容重构完成", 98),
]

# 本地兜底规则：口语化/弱化表述扫描（与 LLM 诊断结果互补去重）
WEAK_PATTERNS = [
    (r"帮忙(做|开发了?|写了?)?", "口语化表述", "「帮忙」弱化了你的主导性，建议改为「负责/承担/主导 + 具体范围」。"),
    (r"(参与|做了?|写)了一些", "口语化表述", "「一些」模糊了工作量，建议量化：如「完成 8 个核心接口的设计与开发」。"),
    (r"负责了[^。，]{0,10}的?(开发|维护)(工作)?", "口语化表述", "「负责了…工作」平铺直叙，建议改为动词开头 + 量化成果。"),
    (r"(吃苦耐劳|认真负责|积极向上|踏实肯干){2,}", "描述空泛", "连续堆砌性格形容词没有信息量，建议替换为有事实支撑的差异化亮点。"),
    (r"(性能|效率|体验)(有所|得到)?(提升|改善|优化)", "缺乏量化", "「有所提升」说服力弱，建议给出前后对比数据，如「P95 耗时从 480ms 降至 120ms」。"),
]

MAX_RULE_ISSUES = 4


class PipelineError(Exception):
    """管线执行失败，message 面向用户展示。"""


def _rule_scan(resume_text: str) -> list[dict]:
    issues: list[dict] = []
    for pattern, issue_type, suggestion in WEAK_PATTERNS:
        for match in re.finditer(pattern, resume_text):
            if len(issues) >= MAX_RULE_ISSUES:
                return issues
            original = match.group(0)
            if any(i.get("original") == original for i in issues):
                continue
            issues.append(
                {
                    "type": issue_type,
                    "severity": "中",
                    "location": "整体",
                    "original": original,
                    "problem": f"检测到常见弱表述「{original}」，容易被 HR 认为职责不清、成果不足。",
                    "suggestion": suggestion,
                }
            )
    return issues


def _dedupe_issues(llm_issues: list[dict], rule_issues: list[dict]) -> list[dict]:
    seen: set[str] = set()
    merged: list[dict] = []
    for issue in llm_issues + rule_issues:
        original = str(issue.get("original", "")).strip()
        key = f"{issue.get('type')}|{original}"
        if original and key in seen:
            continue
        seen.add(key)
        merged.append(issue)
    severity_order = {"高": 0, "中": 1, "低": 2}
    merged.sort(key=lambda i: severity_order.get(str(i.get("severity")), 1))
    return merged


def _json_text(label: str, data: dict) -> str:
    return f"【{label}】\n{json.dumps(data, ensure_ascii=False)}"


def _emit_staggered(emit: EmitCallback, event: str, items: list[dict], interval: float) -> None:
    """逐条推送 item 事件，条目之间插入固定间隔，给前端动画留出渲染时间。"""
    for idx, item in enumerate(items):
        if idx:
            time.sleep(interval)
        emit(event, item)


def _skill_events(match_result: dict) -> list[dict]:
    """把匹配结果展开为逐条 skill 事件：先已命中（detail=原文证据），后缺失（detail=补强建议）。"""
    events: list[dict] = []
    for hit, key, detail_key in ((True, "matched_skills", "evidence"), (False, "missing_skills", "advice")):
        for s in match_result.get(key, []):
            if isinstance(s, dict):
                events.append(
                    {"name": str(s.get("name", "")), "hit": hit, "detail": str(s.get(detail_key, ""))}
                )
            else:
                events.append({"name": str(s), "hit": hit, "detail": ""})
    return events


def run_pipeline(
    resume_text: str,
    jd_text: str,
    target_position: str,
    emit: EmitCallback,
) -> dict:
    """执行完整分析管线，边执行边通过 emit 推送细粒度实时事件，返回与前端约定 schema 一致的结果字典。"""
    if MOCK:
        return run_mock_pipeline(resume_text, jd_text, target_position, emit)

    stage_events = iter(STAGES)

    def step() -> None:
        stage, message, progress = next(stage_events)
        emit("progress", {"stage": stage, "message": message, "progress": progress})

    # ---- 阶段一：简历结构化解析 ----
    step()
    try:
        resume_struct = chat_json(resume_prompt.RESUME_EXTRACT_SYSTEM, resume_text)
    except Exception as e:
        raise PipelineError(f"简历解析失败：{e}") from e
    step()
    emit("resume_struct", resume_struct)

    # ---- 阶段二：JD 要求抽取 ----
    step()
    position_hint = f"目标岗位名称：{target_position}\n\n" if target_position else ""
    try:
        jd_struct = chat_json(jd_extract_prompt.JD_EXTRACT_SYSTEM, position_hint + jd_text)
    except Exception as e:
        raise PipelineError(f"JD 解析失败：{e}") from e
    step()
    emit("jd_struct", jd_struct)

    # ---- 阶段三：匹配分析（算法打分 + LLM 定性） ----
    step()
    skill_score, algo_matched, algo_missing = compute_skill_match(
        jd_struct.get("hard_skills", []), resume_text
    )
    match_user = (
        _json_text("简历结构", resume_struct)
        + "\n\n"
        + _json_text("岗位要求", jd_struct)
        + "\n\n"
        + f"【算法参考】简历原文关键词覆盖：已命中 {algo_matched}，未命中 {algo_missing}，技能覆盖率 {skill_score}%。"
    )
    try:
        assess = chat_json(match_prompt.MATCH_ASSESS_SYSTEM, match_user)
    except Exception as e:
        raise PipelineError(f"匹配分析失败：{e}") from e

    exp_score = int(assess.get("experience_score") or 0)
    edu_score = int(assess.get("education_score") or 0)
    total = round(skill_score * 0.5 + exp_score * 0.3 + edu_score * 0.2)
    match_result = {
        "total": max(0, min(100, total)),
        "dimensions": [
            {"name": "技能匹配", "score": skill_score, "detail": f"JD 硬技能加权覆盖率 {skill_score}%"},
            {"name": "经验匹配", "score": exp_score, "detail": "工作与项目经历和岗位的相关度评估"},
            {"name": "教育背景", "score": edu_score, "detail": "学历、专业与岗位要求的符合度"},
        ],
        "matched_skills": assess.get("matched_skills", []),
        "missing_skills": assess.get("missing_skills", []),
        "strengths": assess.get("strengths", []),
        "gaps_summary": assess.get("gaps_summary", ""),
        "advice": assess.get("advice", "建议投递"),
        "advice_reason": assess.get("advice_reason", ""),
    }
    step()
    # 匹配总分 + 逐条技能命中情况：在进入诊断阶段前推送完毕
    emit(
        "score",
        {
            "total": match_result["total"],
            "dimensions": match_result["dimensions"],
            "advice": match_result["advice"],
            "advice_reason": match_result["advice_reason"],
        },
    )
    _emit_staggered(emit, "skill", _skill_events(match_result), SKILL_INTERVAL)

    # ---- 阶段四：风险诊断（LLM + 本地规则） ----
    step()
    diagnose_user = (
        _json_text("简历结构", resume_struct) + "\n\n【简历原文】\n" + resume_text
    )
    try:
        diag = chat_json(diagnose_prompt.DIAGNOSE_SYSTEM, diagnose_user)
    except Exception as e:
        raise PipelineError(f"风险诊断失败：{e}") from e
    issues = _dedupe_issues(
        [i for i in diag.get("issues", []) if isinstance(i, dict)],
        _rule_scan(resume_text),
    )[:12]

    # ---- 匹配报告（规则检查项，不消耗额外 LLM 调用） ----
    report = build_report(resume_text, jd_struct, issues)
    step()
    _emit_staggered(emit, "issue", issues, ISSUE_INTERVAL)

    # ---- 阶段五：内容重构 ----
    step()
    rewrite_user = (
        _json_text("岗位要求", jd_struct)
        + "\n\n【简历原文】\n"
        + resume_text
        + (f"\n\n【提示】求职者标注的目标岗位为：{target_position}" if target_position else "")
    )
    try:
        rewrite = chat_json(rewrite_prompt.REWRITE_SYSTEM, rewrite_user)
    except Exception as e:
        raise PipelineError(f"内容重构失败：{e}") from e
    rewrite_pairs = rewrite.get("rewrite_pairs", [])
    step()
    _emit_staggered(emit, "rewrite", rewrite_pairs, REWRITE_INTERVAL)

    position_name = target_position or str(jd_struct.get("position_name") or "")
    return {
        "mock": False,
        "summary": str(rewrite.get("summary", "")),
        "highlights": rewrite.get("highlights", []),
        "match": match_result,
        "resume_overview": {
            "name": resume_struct.get("name", ""),
            "current_position": resume_struct.get("current_position", "") or position_name,
            "years_of_experience": resume_struct.get("years_of_experience"),
            "sections_found": resume_struct.get("sections_found", []),
            "sections_missing": resume_struct.get("sections_missing", []),
        },
        "issues": issues,
        "report": report,
        "optimized_resume_md": str(rewrite.get("optimized_resume_md", "")),
        "rewrite_pairs": rewrite_pairs,
    }
