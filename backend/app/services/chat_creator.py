"""创建简历 · 聊天问答服务：LLM 驱动的对话会话管理 + 终稿生成。

每个会话对应一段"简历顾问 ↔ 求职者"的对话；LLM 每轮决定下一个问题或收尾，
会话结束后从完整转录中直接产出简历 Markdown（格式契约与表单模式一致），
失败时回退为结构化抽取 + 确定性组装。仅进程内有效（uvicorn 单进程部署）。
"""

from __future__ import annotations

import logging
import threading
import time
import uuid

from ..prompts.create_chat import (
    CREATE_ASSEMBLE_SYSTEM,
    CREATE_CHAT_SYSTEM,
    CREATE_PROFILE_SYSTEM,
)
from ..schemas import CreateAnswers
from . import resume_composer
from .llm import LLMError, chat_json

logger = logging.getLogger("leapcv.create.chat")

MAX_TURNS = 12  # 顾问提问轮数上限：达到后强制收尾
SESSION_TTL = 1800.0  # 会话 30 分钟未使用则回收

_WELCOME = (
    "你好，我是简跃，你的简历顾问。接下来我会问你几个问题，聊完就能帮你生成一份排版精美的简历。"
    "先说说吧——你叫什么名字？这次想投什么岗位？"
)


class ChatSession:
    """单次聊天创建会话：对话转录 + 轮数计数。"""

    def __init__(self) -> None:
        self.session_id = uuid.uuid4().hex
        self.messages: list[dict] = []  # [{"role": "assistant"|"user", "content": str}]
        self.turns = 0
        self.created_at = time.monotonic()
        self.last_active = time.monotonic()


_sessions: dict[str, ChatSession] = {}
_sessions_lock = threading.Lock()


def _gc() -> None:
    """回收超时会话（在锁内调用）。"""
    now = time.monotonic()
    stale = [sid for sid, s in _sessions.items() if now - s.last_active > SESSION_TTL]
    for sid in stale:
        _sessions.pop(sid, None)
    if stale:
        logger.info("回收 %d 个超时会话", len(stale))


def _get(session_id: str) -> ChatSession:
    with _sessions_lock:
        s = _sessions.get(session_id)
    if s is None:
        raise KeyError(session_id)
    s.last_active = time.monotonic()
    return s


def _pop(session_id: str) -> None:
    with _sessions_lock:
        _sessions.pop(session_id, None)


def _transcript(messages: list[dict]) -> str:
    """对话转录：顾问 / 求职者 前缀的纯文本，便于 LLM 理解与最终抽取。"""
    lines = []
    for m in messages:
        who = "顾问" if m["role"] == "assistant" else "求职者"
        lines.append(f"{who}：{m['content']}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 会话生命周期
# ---------------------------------------------------------------------------


def start_session() -> tuple[str, str]:
    """创建会话，返回 (session_id, 首条顾问消息)。"""
    with _sessions_lock:
        _gc()
        s = ChatSession()
        _sessions[s.session_id] = s
    s.messages.append({"role": "assistant", "content": _WELCOME})
    return s.session_id, _WELCOME


def chat_turn(session_id: str, user_message: str) -> dict:
    """求职者发一条消息，LLM 回复下一个问题（或收尾）。

    返回 {"reply": str, "done": bool, "turns": int}。
    """
    s = _get(session_id)
    s.messages.append({"role": "user", "content": user_message.strip()})
    s.turns += 1
    near_limit = s.turns >= MAX_TURNS - 1
    system = CREATE_CHAT_SYSTEM
    if near_limit:
        system += "\n\n注意：已接近提问上限，本轮请尽量收尾：信息基本够就 done 置为 true。"
    try:
        out = chat_json(system, _transcript(s.messages), temperature=0.5, max_tokens=1500)
    except LLMError as e:
        logger.warning("聊天轮次 LLM 调用失败（会话 %s）：%s", session_id[:8], e)
        raise
    reply = str(out.get("reply") or "").strip() or "能再多说一点吗？"
    done = bool(out.get("done")) or s.turns >= MAX_TURNS
    s.messages.append({"role": "assistant", "content": reply})
    return {"reply": reply, "done": done, "turns": s.turns}


def finish_session(session_id: str) -> tuple[str, list[str]]:
    """会话收尾：转录 → 简历 Markdown + 亮点。返回 (markdown, highlights)。

    两级生成策略：先让 LLM 直接写终稿（质量最佳）；格式不合格或调用失败时，
    回退为结构化抽取 + 确定性组装（保证可用）。
    """
    s = _get(session_id)
    transcript = f"【简历顾问与求职者的对话记录】\n{_transcript(s.messages)}"

    # 失败时保留会话（前端可重试生成）；成功才销毁。超时会话由 GC 回收。

    # 1) 直接产出终稿
    try:
        out = chat_json(CREATE_ASSEMBLE_SYSTEM, transcript, temperature=0.4, max_tokens=4000)
        md = str(out.get("resume_md") or "").strip()
        highlights = [str(h).strip() for h in (out.get("highlights") or []) if str(h).strip()][:5]
        if _valid_md(md):
            _pop(session_id)
            return md, highlights
        logger.warning("终稿 Markdown 不合格（len=%d），回退结构化抽取", len(md))
    except LLMError as e:
        logger.warning("终稿组装失败，回退结构化抽取：%s", e)

    # 2) 结构化抽取 + 确定性组装
    try:
        out = chat_json(CREATE_PROFILE_SYSTEM, transcript, temperature=0.2, max_tokens=3000)
    except LLMError as e:
        raise LLMError("简历生成失败：大模型两次尝试均未成功，请重试或改用表单模式。") from e
    try:
        answers = CreateAnswers.model_validate(_normalize_profile(out))
    except Exception as e:
        raise LLMError("简历生成失败：信息抽取结果异常，请重试或改用表单模式。") from e
    if not answers.name.strip():
        raise LLMError("对话中还没有提到你的姓名，请在表单模式里补充后再试。")
    md = resume_composer.compose_resume_md(answers)
    _pop(session_id)
    return md, []


def _valid_md(md: str) -> bool:
    """终稿格式契约校验：一级标题 + 至少一个板块 + 合理长度。"""
    return bool(md) and md.startswith("#") and "\n## " in md and len(md) >= 80


def _normalize_profile(out: dict) -> dict:
    """LLM 抽取结果容错清洗：空值归一、只保留 CreateAnswers 认识的字段。"""
    allowed = set(CreateAnswers.model_fields)
    clean: dict = {}
    for key in allowed:
        v = out.get(key, "")
        if isinstance(v, list):
            clean[key] = [x for x in (v or []) if isinstance(x, (str, dict))]
        elif isinstance(v, str):
            clean[key] = v
        elif v is None:
            clean[key] = ""
    for key in ("education", "work", "internships", "projects"):
        clean[key] = [
            {k2: ("" if v2 is None else str(v2)) for k2, v2 in (item or {}).items()}
            for item in clean.get(key, [])
            if isinstance(item, dict)
        ]
    for key in ("work", "internships", "projects"):
        for item in clean.get(key, []):
            hl = item.get("highlights")
            item["highlights"] = [str(h) for h in hl if h is not None] if isinstance(hl, list) else []
    return clean
