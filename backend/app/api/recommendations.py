import uuid
import logging
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.recommendation import UserRecommendation
from app.models.user_interaction import UserInteraction

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
        .filter(UserRecommendation.is_seen.is_(False))
    )
    if domain:
        q = q.filter(UserRecommendation.domain == domain.upper())
    if subdomain:
        q = q.filter(UserRecommendation.subdomain == subdomain.upper())
    q = q.order_by(
        UserRecommendation.score.desc().nullslast(),
        UserRecommendation.created_at.desc(),
    )
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
        "has_more": (offset + limit) < total,
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
    # Also record dismiss interactions
    recs = db.query(UserRecommendation).filter(
        UserRecommendation.id.in_(rec_ids),
        UserRecommendation.user_id == current_user.id,
    ).all()
    for rec in recs:
        db.add(UserInteraction(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            rec_id=rec.id,
            source_url=rec.source_url,
            domain=rec.domain,
            subdomain=rec.subdomain,
            source_type=rec.source_type,
            action="dismiss",
        ))
    db.commit()
    return {"updated": len(rec_ids)}


class ClickPayload(BaseModel):
    rec_id: str
    dwell_seconds: Optional[int] = None


@router.post("/track-click")
def track_click(
    payload: ClickPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = db.query(UserRecommendation).filter(
        UserRecommendation.id == payload.rec_id,
        UserRecommendation.user_id == current_user.id,
    ).first()
    if not rec:
        return {"tracked": False}
    db.add(UserInteraction(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        rec_id=rec.id,
        source_url=rec.source_url,
        domain=rec.domain,
        subdomain=rec.subdomain,
        source_type=rec.source_type,
        action="click",
        dwell_seconds=payload.dwell_seconds,
    ))
    db.commit()
    return {"tracked": True}


class DwellPayload(BaseModel):
    rec_id: str
    dwell_seconds: int


@router.post("/track-dwell")
def track_dwell(
    payload: DwellPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing click interaction with dwell time."""
    interaction = (
        db.query(UserInteraction)
        .filter(
            UserInteraction.user_id == current_user.id,
            UserInteraction.rec_id == payload.rec_id,
            UserInteraction.action == "click",
        )
        .order_by(UserInteraction.created_at.desc())
        .first()
    )
    if interaction:
        interaction.dwell_seconds = payload.dwell_seconds
        db.commit()
        return {"updated": True}
    return {"updated": False}


@router.get("/admin/experiment-metrics")
def get_experiment_metrics(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """A/B test metrics: CTR, dismiss rate, avg dwell per experiment group."""
    from sqlalchemy import func as f, case

    # Total recs per experiment
    rec_stats = (
        db.query(
            UserRecommendation.experiment,
            f.count(UserRecommendation.id).label("total_recs"),
            f.sum(case((UserRecommendation.is_seen.is_(True), 1), else_=0)).label("seen_count"),
        )
        .filter(UserRecommendation.experiment.isnot(None))
        .group_by(UserRecommendation.experiment)
        .all()
    )

    # Click/dismiss counts per experiment
    interaction_stats = (
        db.query(
            UserRecommendation.experiment,
            UserInteraction.action,
            f.count(UserInteraction.id).label("action_count"),
            f.avg(UserInteraction.dwell_seconds).label("avg_dwell"),
        )
        .join(UserRecommendation, UserInteraction.rec_id == UserRecommendation.id)
        .filter(UserRecommendation.experiment.isnot(None))
        .group_by(UserRecommendation.experiment, UserInteraction.action)
        .all()
    )

    # Build response
    metrics: dict = {}
    for exp, total, seen in rec_stats:
        metrics[exp] = {
            "total_recs": total,
            "seen_count": seen or 0,
            "clicks": 0,
            "dismisses": 0,
            "ctr": 0.0,
            "dismiss_rate": 0.0,
            "avg_dwell_seconds": None,
        }

    for exp, action, count, avg_dwell in interaction_stats:
        if exp not in metrics:
            continue
        if action == "click":
            metrics[exp]["clicks"] = count
            metrics[exp]["avg_dwell_seconds"] = round(avg_dwell, 1) if avg_dwell else None
        elif action == "dismiss":
            metrics[exp]["dismisses"] = count

    for exp, m in metrics.items():
        total = m["total_recs"]
        if total > 0:
            m["ctr"] = round(m["clicks"] / total * 100, 2)
            m["dismiss_rate"] = round(m["dismisses"] / total * 100, 2)

    return {"experiments": metrics}


@router.post("/admin/generate", response_model=dict)
def admin_generate_recommendations(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.services.recommendation_service import generate_recommendations
    count = generate_recommendations()
    return {"generated": count}
