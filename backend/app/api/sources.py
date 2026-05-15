import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.source import Source, SourceVote

router = APIRouter(prefix="/api/sources", tags=["sources"])

# Mirror of frontend INTEREST_TREE — top-level domain → subdomain codes
DOMAIN_TREE = {
    "TEC": ["SAI", "LLM", "AGT", "WEB", "MOB", "CLD", "SEC", "DAT", "OSS", "ROB", "BLK", "HRD", "SPC", "PHY", "BIO", "DEF", "NMI"],
    "BUS": ["SCA", "MID", "FIN", "INV", "MON", "TRD"],
    "POL": ["GEO", "EXE", "LEG", "JUD", "DIP"],
    "ECO": ["MAC", "MIC", "ENE", "CLM"],
    "OTH": ["SCI", "HEA", "EDU", "GAM"],
}

DOMAIN_LABELS = {
    "TEC": "Technology", "BUS": "Business & Finance", "POL": "Politics & World",
    "ECO": "Economy", "OTH": "Science & Society",
    "SAI": "Software & AI", "LLM": "LLMs & Generative AI", "AGT": "AI Agents",
    "WEB": "Web Development", "MOB": "Mobile Development", "CLD": "Cloud & DevOps",
    "SEC": "Cybersecurity", "DAT": "Data Science", "OSS": "Open Source",
    "ROB": "Robotics", "BLK": "Blockchain & Crypto", "HRD": "Hardware & Chips",
    "SPC": "Space", "PHY": "Physics & Quantum", "BIO": "Biotech & Genomics",
    "DEF": "Defence Technology", "NMI": "Nano & Materials",
    "SCA": "Startups & VC", "MID": "Markets & Industry", "FIN": "FinTech",
    "INV": "Investing", "MON": "Monetary Policy", "TRD": "Trade & Economy",
    "GEO": "Geopolitics", "EXE": "Government", "LEG": "Legislature & Policy",
    "JUD": "Judiciary & Law", "DIP": "Diplomacy & Security",
    "MAC": "Macroeconomics", "MIC": "Microeconomics", "ENE": "Energy & Resources",
    "CLM": "Climate & Environment",
    "SCI": "General Science", "HEA": "Health & Medicine", "EDU": "Education",
    "GAM": "Gaming & Media",
}

# All valid codes (top-level + subdomains)
DOMAINS = list(DOMAIN_TREE.keys()) + [c for subs in DOMAIN_TREE.values() for c in subs]


async def _fetch_page_meta(url: str) -> dict:
    """Fetch a URL and extract og:description / meta description / title."""
    import httpx, re as _re
    headers = {"User-Agent": "Mozilla/5.0 (compatible; CurioBot/1.0)"}
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            html = r.text[:30000]  # only need the <head>
        def _meta(prop, attr="content"):
            m = _re.search(
                rf'<meta[^>]+(?:property|name)=["\'](?:og:)?{prop}["\'][^>]+{attr}=["\']([^"\']+)["\']',
                html, _re.IGNORECASE,
            ) or _re.search(
                rf'<meta[^>]+{attr}=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:)?{prop}["\']',
                html, _re.IGNORECASE,
            )
            return m.group(1).strip() if m else ""
        title_m = _re.search(r'<title[^>]*>([^<]+)</title>', html, _re.IGNORECASE)
        return {
            "title": title_m.group(1).strip() if title_m else "",
            "description": _meta("description") or _meta("og:description") or "",
        }
    except Exception:
        return {"title": "", "description": ""}


async def _ai_detect_info(name: str, url: str) -> dict:
    """Fetch page meta then ask Ollama for domain code + clean one-line description."""
    import re
    # Step 1: get real page metadata
    meta = await _fetch_page_meta(url)
    page_desc = meta["description"]
    page_title = meta["title"] or name

    try:
        from app.core.ollama_client import get_llm_client, get_active_model
        from app.api.browser_research import _extract_response_text
        client = get_llm_client()
        model = get_active_model()
        codes_hint = (
            "SAI=Software & AI, LLM=LLMs & Generative AI, AGT=AI Agents, SEC=Cybersecurity, DAT=Data Science, "
            "DEF=Defence Technology, BIO=Biotech & Genomics, SPC=Space, ROB=Robotics, HRD=Hardware & Chips, "
            "SCA=Startups & VC, FIN=FinTech, INV=Investing, TRD=Trade & Economy, "
            "GEO=Geopolitics, DIP=Diplomacy & Security, EXE=Government, "
            "ENE=Energy & Resources, CLM=Climate & Environment, "
            "HEA=Health & Medicine, SCI=General Science, EDU=Education, GAM=Gaming & Media, "
            "TEC=Technology (generic), BUS=Business (generic), POL=Politics (generic), "
            "ECO=Economy (generic), OTH=Science & Society (generic)"
        )
        context = f'Page title: "{page_title}"\nPage description: "{page_desc}"\nURL: {url}'
        prompt = (
            f'{context}\n\n'
            f'Domain codes: {codes_hint}\n\n'
            f'1. DOMAIN: Most specific code that fits.\n'
            f'2. DESCRIPTION: One crisp sentence (max 120 chars) describing what this source covers. '
            f'Use the page description above as your primary source — rewrite it to be clear and concise.\n\n'
            f'Reply in exactly this format:\n'
            f'DOMAIN: SAI\n'
            f'DESCRIPTION: Weekly AI/ML digest by Andrew Ng covering research and industry trends.'
        )
        resp = await asyncio.to_thread(client.models.generate_content, model=model, contents=prompt)
        text = _extract_response_text(resp).strip()
        domain_m = re.search(r'DOMAIN:\s*(\S+)', text, re.IGNORECASE)
        desc_m = re.search(r'DESCRIPTION:\s*(.+)', text, re.IGNORECASE)
        domain = domain_m.group(1).strip().upper() if domain_m else "TEC"
        if domain not in DOMAINS:
            domain = "TEC"
        description = desc_m.group(1).strip()[:200] if desc_m else page_desc[:200]
        return {"domain": domain, "description": description}
    except Exception:
        # Fallback: return raw page description if AI fails
        return {"domain": "TEC", "description": page_desc[:200]}


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
    source_type: Optional[str] = Query(None),
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
        if domain in DOMAIN_TREE:
            q = q.filter(Source.domain.in_([domain] + DOMAIN_TREE[domain]))
        else:
            q = q.filter(Source.domain == domain)

    if source_type and source_type != "all":
        q = q.filter(Source.source_type == source_type)

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

    domain = (data.get("domain") or "TEC").upper()
    if domain not in DOMAINS:
        domain = "TEC"

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
