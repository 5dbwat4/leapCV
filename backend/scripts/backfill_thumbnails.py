"""一次性回填历史 PDF 简历的首页缩略图。

背景：缩略图功能上线前上传的简历记录 thumb_path 为空，且部分早期记录
未保留原始文件。本脚本遍历 file_path 指向 PDF 且无缩略图的记录，补渲染
首页 PNG 并写回 thumb_path；原始文件缺失或渲染失败的记录跳过并提示。

用法（在 backend 目录下）：
    .venv/Scripts/python.exe scripts/backfill_thumbnails.py
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import DATA_DIR, THUMB_DIR  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Resume  # noqa: E402
from app.services.thumbnail import generate_pdf_thumbnail  # noqa: E402


def main() -> int:
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        candidates = (
            db.query(Resume)
            .filter(Resume.file_path.isnot(None))
            .filter(Resume.thumb_path.is_(None))
            .all()
        )
        pending = [r for r in candidates if r.file_path.lower().endswith(".pdf")]
        print(f"待回填 {len(pending)} 条 PDF 简历（共检查 {len(candidates)} 条无缩略图记录）")
        ok = 0
        for r in pending:
            cv_path = DATA_DIR / r.file_path
            if not cv_path.exists():
                print(f"[跳过] id={r.id} {r.filename}: 原始文件缺失 ({r.file_path})")
                continue
            thumb_rel = f"thumb/{cv_path.stem}.png"
            if generate_pdf_thumbnail(cv_path, DATA_DIR / thumb_rel):
                r.thumb_path = thumb_rel
                ok += 1
                print(f"[完成] id={r.id} {r.filename}")
            else:
                print(f"[失败] id={r.id} {r.filename}: 渲染失败")
        db.commit()
        print(f"回填完成：成功 {ok}/{len(pending)}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
