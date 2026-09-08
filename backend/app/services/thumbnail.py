"""简历首页缩略图生成：仅 PDF 有"页"的概念可渲染为图片。

DOCX/TXT/MD 无固定分页，不生成缩略图（thumb_path 为 NULL，前端回退为文件图标）。
"""

import logging
from pathlib import Path

logger = logging.getLogger("leapcv.thumbnail")

THUMB_MAX_SIZE = (600, 850)  # 最长边像素上限


def generate_pdf_thumbnail(cv_path: Path, thumb_path: Path) -> bool:
    """渲染 PDF 第 1 页为 PNG 缩略图；成功返回 True，失败/不适用返回 False（不阻塞上传）。"""
    if cv_path.suffix.lower() != ".pdf":
        return False
    try:
        import pdfplumber

        with pdfplumber.open(cv_path) as pdf:
            if not pdf.pages:
                return False
            page_img = pdf.pages[0].to_image(resolution=120)
            pil = page_img.original
            pil.thumbnail(THUMB_MAX_SIZE)
            if pil.mode not in ("RGB", "L"):
                pil = pil.convert("RGB")
            pil.save(thumb_path, format="PNG")
        return True
    except Exception:
        # 缩略图失败不影响上传主流程
        logger.exception("缩略图生成失败: %s", cv_path.name)
        return False
