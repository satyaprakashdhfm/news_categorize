import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.recommendation import UserRecommendation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("/my", response_model=dict)
def get_my_recommendations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    domain: str = Query(None),
    subdomain: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(UserRecommendation)
        .filter(UserRecommendation.user_id == current_user.id)
    )
    if domain:
        q = q.filter(UserRecommendation.domain == domain.upper())
    if subdomain:
        q = q.filter(UserRecommendation.subdomain == subdomain.upper())
    q = q.order_by(UserRecommendation.created_at.desc())
    total = q.count()
    recs = q.offset(offset).limit(limit).all()
    return {
        "recommendations": [
            {
                "id": r.id,
                "domain": r.domain,
                "subdomain": r.subdomain,
                "reason": r.reason,
                "is_seen": r.is_seen,
                "batch_label": r.batch_label,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "title": r.title,
                "summary": r.summary,
                "source_url": r.source_url,
                "source_type": r.source_type,
                "image_url": r.image_url,
                "score": r.score,
            }
            for r in recs
        ],
        "total": total,
    }


@router.post("/mark-seen")
def mark_seen(
    rec_ids: list[str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(UserRecommendation).filter(
        UserRecommendation.id.in_(rec_ids),
        UserRecommendation.user_id == current_user.id,
    ).update({"is_seen": True}, synchronize_session=False)
    db.commit()
    return {"updated": len(rec_ids)}


@router.post("/admin/generate", response_model=dict)
def admin_generate_recommendations(db: Session = Depends(get_db)):
    from app.services.recommendation_service import generate_recommendations
    count = generate_recommendations()
    return {"generated": count}
