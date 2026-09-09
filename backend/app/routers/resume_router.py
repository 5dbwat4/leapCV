import json
import re
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import CV_DIR, DATA_DIR, MOCK, THUMB_DIR
from ..database import get_db
from ..models import Resume, User
from ..prompts.resume_extract import RESUME_EXTRACT_SYSTEM
from ..schemas import ResumeOut, ResumeStructuredUpdate, ResumeTextRequest
from ..services.exporter import ExportError, build_tex, compile_pdf, parse_resume_md
from ..services.llm import LLMError, chat_json
from ..services.parser import ALLOWED_SUFFIXES, MAX_FILE_SIZE, ParseError, parse_resume_file
from ..services.resume_struct import heuristic_resume_struct
from ..services.thumbnail import generate_pdf_thumbnail

router = APIRouter(prefix="/resumes", tags=["resumes"])


def _resume_out(resume: Resume) -> ResumeOut:
    structured = None
    if resume.structured_json:
        try:
            structured = json.loads(resume.structured_json)
        except json.JSONDecodeError:
            structured = None
    return ResumeOut(
        id=resume.id,
        filename=resume.filename,
        raw_text=resume.raw_text,
        file_path=resume.file_path,
        thumb_path=resume.thumb_path,
        file_size=resume.file_size,
        structured=structured,
        created_at=resume.created_at,
    )


def _get_owned_resume(resume_id: int, user: User, db: Session) -> Resume:
    resume = db.get(Resume, resume_id)
    if resume is None or resume.user_id != user.id:
        raise HTTPException(status_code=404, detail="简历不存在")
    return resume


def _parse_structured(resume: Resume) -> dict:
    """执行结构化解析：演示模式用启发式规则，正式模式走 LLM。"""
    if MOCK:
        return heuristic_resume_struct(resume.raw_text)
    try:
        structured = chat_json(RESUME_EXTRACT_SYSTEM, resume.raw_text, temperature=0.2)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    structured.pop("parse_source", None)
    return structured


@router.post("/upload", response_model=ResumeOut)
async def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    data = await file.read()

    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="不支持的文件类型，仅支持 PDF / DOCX / TXT / MD。")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="文件内容为空。")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件超过 10MB 限制。")

    try:
        text = parse_resume_file(filename, data)
    except ParseError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 原件落盘：data/cv/<uuid>.ext
    uid = uuid.uuid4().hex
    cv_path = CV_DIR / f"{uid}{suffix}"
    cv_path.write_bytes(data)

    # 首页缩略图：data/thumb/<uuid>.png（仅 PDF）
    thumb_rel = None
    if generate_pdf_thumbnail(cv_path, THUMB_DIR / f"{uid}.png"):
        thumb_rel = f"thumb/{uid}.png"

    resume = Resume(
        user_id=user.id,
        filename=filename or "未命名简历",
        raw_text=text,
        file_path=f"cv/{cv_path.name}",
        thumb_path=thumb_rel,
        file_size=len(data),
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return _resume_out(resume)


@router.get("/{resume_id}/thumb")
def get_resume_thumb(
    resume_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = _get_owned_resume(resume_id, user, db)
    if not resume.thumb_path:
        raise HTTPException(status_code=404, detail="该简历没有缩略图（仅 PDF 上传生成）")
    path = DATA_DIR / resume.thumb_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="缩略图文件缺失")
    return FileResponse(path, media_type="image/png")


@router.get("/{resume_id}/file")
def get_resume_file(
    resume_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = _get_owned_resume(resume_id, user, db)
    if not resume.file_path:
        raise HTTPException(status_code=404, detail="该简历由文本粘贴创建，无原始文件")
    path = DATA_DIR / resume.file_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="原始文件缺失")
    return FileResponse(path, filename=resume.filename)


def _pdf_download_name(resume: Resume) -> str:
    """中文下载文件名：复用简历文件名（去掉已有扩展名），清理非法字符。"""
    base = re.sub(r"\.\w+$", "", resume.filename or "").strip()
    base = re.sub(r'[\\/:*?"<>|\r\n]+', "", base).strip().strip(". ") or "简历"
    return f"{base}.pdf"


@router.get("/{resume_id}/pdf")
def get_resume_pdf(
    resume_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """下载简历 PDF：已生成过 PDF 的直接返回，否则用原文现场渲染（XeLaTeX）。"""
    resume = _get_owned_resume(resume_id, user, db)
    filename = _pdf_download_name(resume)
    disposition = (
        f"attachment; filename=\"resume-{resume.id}.pdf\"; "
        f"filename*=UTF-8''{quote(filename)}"
    )

    if resume.file_path and resume.file_path.endswith(".pdf"):
        path = DATA_DIR / resume.file_path
        if path.exists():
            return FileResponse(
                path,
                media_type="application/pdf",
                headers={"Content-Disposition": disposition, "Cache-Control": "no-store"},
            )

    try:
        content = compile_pdf(build_tex(parse_resume_md(resume.raw_text)))
    except ExportError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": disposition, "Cache-Control": "no-store"},
    )


@router.post("/text", response_model=ResumeOut)
def create_resume_by_text(
    body: ResumeTextRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = Resume(user_id=user.id, filename=body.filename, raw_text=body.raw_text.strip())
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return _resume_out(resume)


@router.get("/{resume_id}", response_model=ResumeOut)
def get_resume(
    resume_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _resume_out(_get_owned_resume(resume_id, user, db))


@router.post("/{resume_id}/parse", response_model=ResumeOut)
def parse_resume(
    resume_id: int,
    force: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """结构化解析简历并缓存；已有结果时直接返回，force=true 强制重新解析。"""
    resume = _get_owned_resume(resume_id, user, db)
    if resume.structured_json and not force:
        return _resume_out(resume)
    resume.structured_json = json.dumps(_parse_structured(resume), ensure_ascii=False)
    db.commit()
    return _resume_out(resume)


@router.put("/{resume_id}/structured", response_model=ResumeOut)
def update_resume_structured(
    resume_id: int,
    body: ResumeStructuredUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """保存用户在"我的简历"页手动编辑后的结构化信息。"""
    resume = _get_owned_resume(resume_id, user, db)
    resume.structured_json = json.dumps(body.structured, ensure_ascii=False)
    db.commit()
    return _resume_out(resume)


@router.get("", response_model=list[ResumeOut])
def list_resumes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = (
        db.query(Resume)
        .filter(Resume.user_id == user.id)
        .order_by(Resume.created_at.desc(), Resume.id.desc())
        .limit(50)
        .all()
    )
    return [_resume_out(r) for r in records]
