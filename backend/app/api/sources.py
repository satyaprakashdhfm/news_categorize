import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.source import Source, SourceVote

router = APIRouter(prefix="/api/sources", tags=["sources"])

DOMAINS = ["general", "technology", "defence", "science", "business", "politics", "health", "environment", "sports"]


async def _ai_detect_domain(name: str, url: str) -> str:
    """Ask Ollama to classify a source into one of the known domains."""
    try:
        from app.core.ollama_client import get_llm_client, get_active_model
        from app.api.browser_research import _extract_response_text
        client = get_llm_client()
        model = get_active_model()
        prompt = (
            f'Source name: "{name}"\nURL: {url}\n\n'
            f'Which single domain does this news/media source belong to?\n'
            f'Choose ONLY ONE from: technology, defence, science, business, politics, health, environment, sports, general\n'
            f'Reply with ONLY the domain word, nothing else.'
        )
        resp = await asyncio.to_thread(client.models.generate_content, model=model, contents=prompt)
        text = _extract_response_text(resp).strip().lower().split()[0]
        return text if text in DOMAINS else "general"
    except Exception:
        return "general"


@router.post("/detect-domain")
async def detect_domain(data: dict):
    name = (data.get("name") or "").strip()
    url = (data.get("url") or "").strip()
    if not name and not url:
        return {"domain": "general"}
    domain = await _ai_detect_domain(name, url)
    return {"domain": domain}


def _detect_type(url: str) -> str:
    u = url.lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "twitter.com" in u or "x.com" in u:
        return "twitter"
    if "reddit.com" in u:
        return "reddit"
    return "web"


def _build_score_query(db: Session):
    up_subq = (
        db.query(SourceVote.source_id, func.count(SourceVote.id).label("upvotes"))
        .filter(SourceVote.vote == 1)
        .group_by(SourceVote.source_id)
        .subquery()
    )
    down_subq = (
        db.query(SourceVote.source_id, func.count(SourceVote.id).label("downvotes"))
        .filter(SourceVote.vote == -1)
        .group_by(SourceVote.source_id)
        .subquery()
    )
    return up_subq, down_subq


@router.get("")
def list_sources(
    domain: Optional[str] = Query(None),
    sort: str = Query("hot"),
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    up_subq, down_subq = _build_score_query(db)

    q = (
        db.query(
            Source,
            func.coalesce(up_subq.c.upvotes, 0).label("upvotes"),
            func.coalesce(down_subq.c.downvotes, 0).label("downvotes"),
        )
        .outerjoin(up_subq, Source.id == up_subq.c.source_id)
        .outerjoin(down_subq, Source.id == down_subq.c.source_id)
    )

    if domain and domain != "all":
        q = q.filter(Source.domain == domain)

    if sort == "new":
        q = q.order_by(Source.created_at.desc())
    else:
        q = q.order_by(
            (func.coalesce(up_subq.c.upvotes, 0) - func.coalesce(down_subq.c.downvotes, 0)).desc(),
            Source.created_at.desc(),
        )

    rows = q.all()

    user_votes: dict = {}
    if current_user:
        for sv in db.query(SourceVote).filter(SourceVote.user_id == current_user.id).all():
            user_votes[sv.source_id] = sv.vote

    return {
        "sources": [
            {
                "id": src.id,
                "name": src.name,
                "url": src.url,
                "description": src.description,
                "domain": src.domain,
                "source_type": src.source_type,
                "submitted_by": src.submitter.name if src.submitter else None,
                "created_at": src.created_at.isoformat(),
                "upvotes": int(ups),
                "downvotes": int(downs),
                "score": int(ups) - int(downs),
                "my_vote": user_votes.get(src.id, 0),
            }
            for src, ups, downs in rows
        ]
    }


@router.post("")
def add_source(
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    url = (data.get("url") or "").strip()
    name = (data.get("name") or "").strip()
    if not url or not name:
        raise HTTPException(400, "name and url are required")

    domain = data.get("domain") or "general"
    if domain not in DOMAINS:
        domain = "general"

    src = Source(
        name=name,
        url=url,
        description=(data.get("description") or "").strip() or None,
        domain=domain,
        source_type=_detect_type(url),
        submitted_by=current_user.id,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return {"id": src.id, "source_type": src.source_type}


@router.post("/{source_id}/vote")
def vote_source(
    source_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    v = int(data.get("vote", 1))
    if v not in (1, -1):
        raise HTTPException(400, "vote must be 1 or -1")

    src = db.query(Source).filter(Source.id == source_id).first()
    if not src:
        raise HTTPException(404, "Source not found")

    existing = (
        db.query(SourceVote)
        .filter(SourceVote.source_id == source_id, SourceVote.user_id == current_user.id)
        .first()
    )

    if existing:
        if existing.vote == v:
            db.delete(existing)
            db.commit()
            return {"action": "removed"}
        existing.vote = v
        db.commit()
        return {"action": "changed"}

    db.add(SourceVote(source_id=source_id, user_id=current_user.id, vote=v))
    db.commit()
    return {"action": "added"}


@router.delete("/{source_id}")
def delete_source(
    source_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    src = db.query(Source).filter(Source.id == source_id).first()
    if not src:
        raise HTTPException(404, "Source not found")
    if src.submitted_by != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Not allowed")
    db.delete(src)
    db.commit()
    return {"ok": True}
