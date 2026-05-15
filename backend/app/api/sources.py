import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.source import Source, SourceVote

router = APIRouter(prefix="/api/sources", tags=["sources"])

DOMAINS = [
    "general", "software-ai", "technology", "defence", "science",
    "business", "politics", "health", "environment", "sports",
]

DOMAIN_LABELS = {
    "software-ai": "Software & AI",
    "technology": "Technology",
    "defence": "Defence",
    "science": "Science",
    "business": "Business",
    "politics": "Politics",
    "health": "Health",
    "environment": "Environment",
    "sports": "Sports",
    "general": "General",
}


async def _ai_detect_info(name: str, url: str) -> dict:
    """Ask Ollama to suggest domain + one-line description for a source."""
    try:
        from app.core.ollama_client import get_llm_client, get_active_model
        from app.api.browser_research import _extract_response_text
        import re
        client = get_llm_client()
        model = get_active_model()
        domains_str = ", ".join(DOMAINS)
        prompt = (
            f'Source name: "{name}"\nURL: {url}\n\n'
            f'1. DOMAIN: Which single domain fits best? Choose from: {domains_str}\n'
            f'   Use "software-ai" for anything about AI, ML, LLMs, software engineering, or coding.\n'
            f'2. DESCRIPTION: Write one sentence (max 120 chars) describing what this source covers.\n\n'
            f'Reply in exactly this format:\n'
            f'DOMAIN: software-ai\n'
            f'DESCRIPTION: Weekly AI/ML research digest by Andrew Ng covering industry trends.'
        )
        resp = await asyncio.to_thread(client.models.generate_content, model=model, contents=prompt)
        text = _extract_response_text(resp).strip()
        domain_m = re.search(r'DOMAIN:\s*(\S+)', text, re.IGNORECASE)
        desc_m = re.search(r'DESCRIPTION:\s*(.+)', text, re.IGNORECASE)
        domain = domain_m.group(1).strip().lower() if domain_m else "general"
        if domain not in DOMAINS:
            domain = "general"
        description = desc_m.group(1).strip()[:200] if desc_m else ""
        return {"domain": domain, "description": description}
    except Exception:
        return {"domain": "general", "description": ""}


@router.post("/detect-info")
async def detect_info(data: dict):
    name = (data.get("name") or "").strip()
    url = (data.get("url") or "").strip()
    if not name and not url:
        return {"domain": "general", "description": ""}
    return await _ai_detect_info(name, url)


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

    current_uid = current_user.id if current_user else None
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
                "is_mine": src.submitted_by == current_uid,
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
    description = (data.get("description") or "").strip()
    if not url or not name:
        raise HTTPException(400, "name and url are required")
    if not description:
        raise HTTPException(400, "description is required")

    domain = data.get("domain") or "general"
    if domain not in DOMAINS:
        domain = "general"

    src = Source(
        name=name,
        url=url,
        description=description,
        domain=domain,
        source_type=_detect_type(url),
        submitted_by=current_user.id,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return {"id": src.id, "source_type": src.source_type}


@router.patch("/{source_id}")
def edit_source(
    source_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    src = db.query(Source).filter(Source.id == source_id).first()
    if not src:
        raise HTTPException(404, "Source not found")
    if src.submitted_by != current_user.id:
        raise HTTPException(403, "You can only edit your own sources")

    if "name" in data and data["name"].strip():
        src.name = data["name"].strip()
    if "url" in data and data["url"].strip():
        src.url = data["url"].strip()
        src.source_type = _detect_type(src.url)
    if "description" in data:
        src.description = data["description"].strip() or None
    if "domain" in data:
        d = data["domain"]
        src.domain = d if d in DOMAINS else "general"

    db.commit()
    return {"ok": True}


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
