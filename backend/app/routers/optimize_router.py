import json
import logging
import queue
import threading
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import SessionLocal, get_db
from ..models import Optimization, Resume, User
from ..schemas import OptimizeAnswerRequest, OptimizeRequest
from ..services.interactive import get_gate, pop_gate, register_gate
from ..services.pipeline import PipelineError, run_pipeline

logger = logging.getLogger("leapcv.optimize")

router = APIRouter(tags=["optimize"])

# 每个 Quick check 问题的等待上限（秒）；超时后管线改用【请补充】占位符继续
QUESTION_TIMEOUT = 180.0


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/optimize/answer")
def answer_quick_check(
    body: OptimizeAnswerRequest,
    user: User = Depends(get_current_user),
):
    """接收 Quick check 作答，唤醒等待中的分析管线。"""
    gate = get_gate(body.run_id)
    if gate is None or not gate.answer(body.question_id, body.answer):
        raise HTTPException(status_code=404, detail="问题已失效（分析可能已超时或结束）")
    return {"ok": True}


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

    # 运行标识 + 问答门：阶段五 Quick check 时管线线程阻塞在 gate 上，
    # 前端通过 /optimize/answer 唤醒
    run_id = uuid.uuid4().hex
    gate = register_gate(run_id)

    def event_stream():
        q: queue.Queue = queue.Queue()

        def task():
            try:
                result = run_pipeline(
                    resume_text,
                    body.jd_text,
                    body.target_position,
                    lambda kind, payload: q.put((kind, payload)),
                    run_id=run_id,
                    ask_user=lambda payload: gate.ask(str(payload.get("id", "")), QUESTION_TIMEOUT),
                )
                q.put(("done", result))
            except PipelineError as e:
                q.put(("error", {"message": str(e)}))
            except Exception:
                logger.exception("管线执行异常")
                q.put(("error", {"message": "分析过程中出现意外错误，请稍后重试。"}))

        threading.Thread(target=task, daemon=True).start()

        try:
            while True:
                kind, payload = q.get()
                if kind == "done":
                    # 用独立会话落库（请求级 session 在流式响应期间不可依赖）
                    # target_position 未显式提供时，回退用 JD 抽取出的岗位名，保证历史记录可读
                    record_position = (
                        body.target_position or str(payload.get("position_name") or "")
                    )[:100]
                    session = SessionLocal()
                    try:
                        record = Optimization(
                            user_id=user.id,
                            resume_id=body.resume_id,
                            target_position=record_position,
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
                    # progress / resume_struct / jd_struct / score / skill / issue /
                    # question / rewrite 等中间事件原样转发为同名 SSE 事件
                    yield _sse(kind, payload)
        finally:
            # 流结束或客户端断开（取消分析）时注销问答门：避免管线线程在 ask() 上永久阻塞
            pop_gate(run_id)
            gate.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
