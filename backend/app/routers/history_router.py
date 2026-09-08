import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Optimization, User
from ..schemas import HistoryDetail, HistoryItem

router = APIRouter(prefix="/history", tags=["history"])


def _to_item(record: Optimization) -> HistoryItem:
    return HistoryItem(
        id=record.id,
        target_position=record.target_position,
        match_score=record.match_score,
        is_mock=record.is_mock,
        jd_excerpt=record.jd_text[:100],
        created_at=record.created_at,
    )


@router.get("", response_model=list[HistoryItem])
def list_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = (
        db.query(Optimization)
        .filter(Optimization.user_id == user.id)
        .order_by(Optimization.created_at.desc(), Optimization.id.desc())
        .limit(100)
        .all()
    )
    return [_to_item(r) for r in records]


@router.get("/{item_id}", response_model=HistoryDetail)
def get_history_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.get(Optimization, item_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="记录不存在")
    item = _to_item(record)
    return HistoryDetail(
        **item.model_dump(),
        resume_id=record.resume_id,
        jd_text=record.jd_text,
        result=json.loads(record.result_json),
    )


@router.delete("/{item_id}")
def delete_history_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.get(Optimization, item_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(record)
    db.commit()
    return {"ok": True}
