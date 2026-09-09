import json
import logging
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import SessionLocal, get_db
from ..models import Optimization, Resume, User
from ..schemas import OptimizeRequest
from ..services.pipeline import PipelineError, run_pipeline

logger = logging.getLogger("leapcv.optimize")

router = APIRouter(tags=["optimize"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/optimize")
def optimize(
    body: OptimizeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = db.get(Resume, body.resume_id)
    if resume is None or resume.user_id != user.id:
        raise HTTPException(status_code=404, detail="简历不存在，请重新上传")
    resume_text = resume.raw_text

    def event_stream():
        q: queue.Queue = queue.Queue()

        def task():
            try:
                result = run_pipeline(
                    resume_text,
                    body.jd_text,
                    body.target_position,
                    lambda kind, payload: q.put((kind, payload)),
                )
                q.put(("done", result))
            except PipelineError as e:
                q.put(("error", {"message": str(e)}))
            except Exception:
                logger.exception("管线执行异常")
                q.put(("error", {"message": "分析过程中出现意外错误，请稍后重试。"}))

        threading.Thread(target=task, daemon=True).start()

        while True:
            kind, payload = q.get()
            if kind == "done":
                # 用独立会话落库（请求级 session 在流式响应期间不可依赖）
                session = SessionLocal()
                try:
                    record = Optimization(
                        user_id=user.id,
                        resume_id=body.resume_id,
                        target_position=body.target_position,
                        jd_text=body.jd_text,
                        result_json=json.dumps(payload, ensure_ascii=False),
                        match_score=int(payload.get("match", {}).get("total", 0)),
                        is_mock=bool(payload.get("mock", False)),
                    )
                    session.add(record)
                    session.commit()
                    session.refresh(record)
                    record_id = record.id
                finally:
                    session.close()
                yield _sse("result", {"id": record_id, "result": payload})
                break
            elif kind == "error":
                yield _sse("error", payload)
                break
            else:
                # progress / resume_struct / jd_struct / score / skill / issue / rewrite
                # 等中间事件原样转发为同名 SSE 事件
                yield _sse(kind, payload)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
