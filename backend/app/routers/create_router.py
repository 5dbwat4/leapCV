"""创建简历路由：表单模式（步骤定义 + 一次性生成）与聊天模式（LLM 问答会话）。

表单模式：前端按 /create/steps 逐步提问，用户作答后提交 /create/finish；
聊天模式：/create/chat/start 开启会话，/create/chat/message 逐条对话，
/create/chat/finish 从完整对话中生成简历（或用户随时点"生成"提前收尾）。
两种模式最终都走同一条落库管线：Markdown → XeLaTeX PDF → 缩略图 → 简历记录。
"""

import json
import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import CV_DIR, MOCK, THUMB_DIR
from ..database import get_db
from ..models import Resume, User
from ..schemas import CreateAnswers, CreateFinishOut, CreateStepOut, ResumeOut
from ..services import chat_creator, resume_composer
from ..services.exporter import ExportError, build_tex, compile_pdf, parse_resume_md
from ..services.llm import LLMError
from ..services.thumbnail import generate_pdf_thumbnail
from .resume_router import _resume_out

logger = logging.getLogger("leapcv.create")

router = APIRouter(prefix="/create", tags=["create"])


# ---------------------------------------------------------------------------
# 公共：Markdown → PDF + 缩略图 + 落库
# ---------------------------------------------------------------------------


def _safe_name_part(text: str, fallback: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\r\n]+', "", text or "").strip().strip(". ")
    return cleaned[:40] or fallback


def _finalize(user: User, db: Session, markdown: str, structured: dict | None) -> CreateFinishOut:
    """把最终简历 Markdown 渲染为 PDF 并保存为一份新简历；PDF 失败不阻断落库。"""
    doc = parse_resume_md(markdown)
    base_name = (
        f"简跃简历-{_safe_name_part(doc.intent, '')}"
        if doc.intent
        else (f"简跃简历-{_safe_name_part(doc.name, '')}" if doc.name else "简跃简历")
    )

    pdf_bytes: bytes | None = None
    pdf_error: str | None = None
    try:
        pdf_bytes = compile_pdf(build_tex(parse_resume_md(markdown)))
    except ExportError as e:
        pdf_error = str(e)
        logger.warning("创建简历 PDF 渲染失败：%s", e)

    uid = uuid.uuid4().hex
    file_rel: str | None = None
    thumb_rel: str | None = None
    file_size: int | None = None
    if pdf_bytes is not None:
        pdf_path = CV_DIR / f"{uid}.pdf"
        pdf_path.write_bytes(pdf_bytes)
        file_rel = f"cv/{uid}.pdf"
        file_size = len(pdf_bytes)
        if generate_pdf_thumbnail(pdf_path, THUMB_DIR / f"{uid}.png"):
            thumb_rel = f"thumb/{uid}.png"

    resume = Resume(
        user_id=user.id,
        filename=f"{base_name}.pdf" if pdf_bytes is not None else f"{base_name}.md",
        raw_text=markdown,
        file_path=file_rel,
        thumb_path=thumb_rel,
        file_size=file_size,
        structured_json=json.dumps(structured, ensure_ascii=False) if structured else None,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return CreateFinishOut(
        resume=_resume_out(resume),
        markdown=markdown,
        polished=True,
        pdf_url=f"/api/resumes/{resume.id}/pdf" if pdf_bytes is not None else None,
        pdf_error=pdf_error,
    )


# ---------------------------------------------------------------------------
# 表单模式
# ---------------------------------------------------------------------------


@router.get("/steps", response_model=list[CreateStepOut])
def get_steps(user: User = Depends(get_current_user)):
    """问答步骤定义（顺序即提问顺序），前端据此渲染向导。"""
    return [CreateStepOut(**s) for s in resume_composer.CREATE_STEPS]


@router.post("/finish", response_model=CreateFinishOut)
def finish_create(
    body: CreateAnswers,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """汇总全部作答，生成简历 Markdown 与 PDF 并落库。"""
    try:
        resume_composer.validate_answers(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    cleaned = resume_composer._clean_answers(body)
    base_md = resume_composer.compose_resume_md(cleaned)
    polished_md = resume_composer.polish_resume(cleaned, base_md)
    final_md = polished_md if polished_md else base_md
    return _finalize(user, db, final_md, resume_composer.build_struct(cleaned))


# ---------------------------------------------------------------------------
# 聊天模式（需要配置大模型 API Key）
# ---------------------------------------------------------------------------


class ChatMessageRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1, max_length=2000)


class ChatSessionRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)


class ChatStartOut(BaseModel):
    session_id: str
    reply: str


class ChatMessageOut(BaseModel):
    reply: str
    done: bool
    turns: int


def _require_llm() -> None:
    if MOCK:
        raise HTTPException(status_code=400, detail="聊天问答需要配置大模型 API Key（backend/.env），请改用表单模式。")


@router.get("/mode")
def get_mode(user: User = Depends(get_current_user)):
    """创建方式可用性：llm_available=True 时聊天模式可用。"""
    return {"llm_available": not MOCK}


@router.post("/chat/start", response_model=ChatStartOut)
def chat_start(user: User = Depends(get_current_user)):
    """开启聊天会话，返回首条顾问消息。"""
    _require_llm()
    session_id, welcome = chat_creator.start_session()
    return ChatStartOut(session_id=session_id, reply=welcome)


@router.post("/chat/message", response_model=ChatMessageOut)
def chat_message(
    body: ChatMessageRequest,
    user: User = Depends(get_current_user),
):
    """求职者发一条消息，返回顾问的下一问（done=true 表示信息已收齐）。"""
    _require_llm()
    try:
        return chat_creator.chat_turn(body.session_id, body.message)
    except KeyError:
        raise HTTPException(status_code=404, detail="会话不存在或已过期，请重新开始")
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/chat/finish", response_model=CreateFinishOut)
def chat_finish(
    body: ChatSessionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """结束会话并生成简历（顾问收尾后，或用户随时点击"生成我的简历"）。"""
    _require_llm()
    try:
        markdown, highlights = chat_creator.finish_session(body.session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="会话不存在或已过期，请重新开始")
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    out = _finalize(user, db, markdown, None)
    out.highlights = highlights
    return out
