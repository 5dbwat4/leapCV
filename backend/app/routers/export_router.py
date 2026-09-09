"""简历导出路由：把优化结果导出为 DOCX / LaTeX / PDF 下载。"""

import json
import logging
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Optimization, User
from ..services.exporter import ExportDoc, ExportError, build_docx, build_tex, compile_pdf, parse_resume_md

logger = logging.getLogger("leapcv.export")

router = APIRouter(prefix="/optimize", tags=["export"])

_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_TEX_MIME = "application/x-tex"
_PDF_MIME = "application/pdf"


def _get_owned_optimization(optimization_id: int, user: User, db: Session) -> Optimization:
    """校验记录存在且属于当前用户，否则一律 404（不暴露他人记录）。"""
    record = db.get(Optimization, optimization_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="分析记录不存在")
    return record


def _extract_resume_md(record: Optimization) -> str:
    """从 result_json 提取优化后简历 Markdown。

    兼容两种落库结构：结果直接存顶层，或包在 ``result`` 字典里；
    两处都没有 ``optimized_resume_md`` 时视为无优化后简历。
    """
    try:
        data = json.loads(record.result_json or "")
    except json.JSONDecodeError:
        data = {}
    nested = data.get("result") if isinstance(data, dict) else None
    source = nested if isinstance(nested, dict) and nested.get("optimized_resume_md") else data
    md = str(source.get("optimized_resume_md") or "").strip() if isinstance(source, dict) else ""
    if not md:
        raise HTTPException(status_code=404, detail="该记录没有优化后简历")
    return md


def _safe_filename(record: Optimization, ext: str) -> str:
    """生成 `简跃简历-{目标岗位或优化版}-{id}.ext`，清理文件名非法字符。"""
    position = re.sub(r'[\\/:*?"<>|\r\n]+', "", record.target_position or "").strip().strip(". ")
    if not position:
        position = "优化版"
    return f"简跃简历-{position}-{record.id}.{ext}"


def _content_disposition(filename: str, record_id: int, ext: str) -> str:
    """RFC 5987：ASCII 兜底文件名 + filename*=UTF-8'' 编码的中文文件名。"""
    ascii_fallback = f"leapcv-resume-{record_id}.{ext}"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


def _build_doc(record: Optimization) -> ExportDoc:
    """公共流程：取 Markdown 并解析为导出文档结构。"""
    return parse_resume_md(_extract_resume_md(record))


def _file_response(record: Optimization, content: bytes, media_type: str, ext: str) -> Response:
    """统一构造带中文文件名下载头的响应。"""
    filename = _safe_filename(record, ext)
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": _content_disposition(filename, record.id, ext),
            "Cache-Control": "no-store",
        },
    )


@router.get("/{optimization_id}/export/docx")
def export_docx(
    optimization_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """导出优化后简历为 DOCX。"""
    record = _get_owned_optimization(optimization_id, user, db)
    content = build_docx(_build_doc(record))
    return _file_response(record, content, _DOCX_MIME, "docx")


@router.get("/{optimization_id}/export/tex")
def export_tex(
    optimization_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """导出优化后简历为 LaTeX 源码。"""
    record = _get_owned_optimization(optimization_id, user, db)
    content = build_tex(_build_doc(record)).encode("utf-8")
    return _file_response(record, content, _TEX_MIME, "tex")


@router.get("/{optimization_id}/export/pdf")
def export_pdf(
    optimization_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """导出优化后简历为 PDF（服务端 XeLaTeX 编译；环境缺失或编译失败返回 503）。"""
    record = _get_owned_optimization(optimization_id, user, db)
    tex = build_tex(_build_doc(record))
    try:
        content = compile_pdf(tex)
    except ExportError as e:
        logger.warning("简历 PDF 导出失败（记录 %s）：%s", optimization_id, e)
        raise HTTPException(status_code=503, detail=str(e))
    return _file_response(record, content, _PDF_MIME, "pdf")
