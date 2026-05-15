from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/users")
def get_user_stats(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)

    total = db.query(func.count(User.id)).scalar() or 0
    today = db.query(func.count(User.id)).filter(User.created_at >= today_start).scalar() or 0
    week = db.query(func.count(User.id)).filter(User.created_at >= week_start).scalar() or 0

    # Last 7 days breakdown for sparkline
    daily = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        count = db.query(func.count(User.id)).filter(
            User.created_at >= day_start,
            User.created_at < day_end,
        ).scalar() or 0
        daily.append(count)

    return {"total": total, "today": today, "week": week, "daily": daily}
