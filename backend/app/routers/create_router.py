"""创建简历路由：问答步骤定义 + 一次性生成（组装 Markdown → LLM 润色 → PDF → 落库）。

前端按 /create/steps 逐步提问，用户作答后提交 /create/finish；
后端把答案拼成结构化 Markdown（演示模式可直接用），配置了 LLM 时润色表述，
再用导出服务的 XeLaTeX 管线渲染 PDF、生成首页缩略图并保存为一份新简历。
"""

import json
import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import CV_DIR, DATA_DIR, THUMB_DIR
from ..database import get_db
from ..models import Resume, User
from ..schemas import CreateAnswers, CreateFinishOut, CreateStepOut, ResumeOut
from ..services import resume_composer
from ..services.exporter import ExportError, build_tex, compile_pdf, parse_resume_md
from ..services.thumbnail import generate_pdf_thumbnail
from .resume_router import _resume_out

logger = logging.getLogger("leapcv.create")

router = APIRouter(prefix="/create", tags=["create"])


@router.get("/steps", response_model=list[CreateStepOut])
def get_steps(user: User = Depends(get_current_user)):
    """问答步骤定义（顺序即提问顺序），前端据此渲染向导。"""
    return [CreateStepOut(**s) for s in resume_composer.CREATE_STEPS]


def _safe_name_part(text: str, fallback: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\r\n]+', "", text or "").strip().strip(". ")
    return cleaned[:40] or fallback


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

    # ---- PDF 渲染（失败不阻断创建：简历照常落库，用户可稍后在"我的简历"重新下载） ----
    pdf_bytes: bytes | None = None
    pdf_error: str | None = None
    try:
        pdf_bytes = compile_pdf(build_tex(parse_resume_md(final_md)))
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

    position = _safe_name_part(cleaned.intent, "")
    person = _safe_name_part(cleaned.name, "")
    base_name = f"简跃简历-{position}" if position else (f"简跃简历-{person}" if person else "简跃简历")

    resume = Resume(
        user_id=user.id,
        filename=f"{base_name}.pdf" if pdf_bytes is not None else f"{base_name}.md",
        raw_text=final_md,
        file_path=file_rel,
        thumb_path=thumb_rel,
        file_size=file_size,
        structured_json=json.dumps(resume_composer.build_struct(cleaned), ensure_ascii=False),
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    out_resume = _resume_out(resume)
    return CreateFinishOut(
        resume=out_resume,
        markdown=final_md,
        polished=polished_md is not None,
        pdf_url=f"/api/resumes/{resume.id}/pdf" if pdf_bytes is not None else None,
        pdf_error=pdf_error,
    )
