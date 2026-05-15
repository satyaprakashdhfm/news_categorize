import json
import logging
import re
import uuid
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.feed_card import FeedCard, UserFeedCard
from app.models.browser_research_run import BrowserResearchRun
from app.models.user import User

logger = logging.getLogger(__name__)


def _ai_same_topic(query_a: str, query_b: str) -> bool:
    """Ask LLM whether two research queries are about the same core topic."""
    try:
        from app.core.ollama_client import get_llm_client, get_active_model
        client = get_llm_client()
        prompt = (
            "Are these two research queries about the same core topic? "
            "Answer ONLY with JSON, no other text: {\"same\": true} or {\"same\": false}\n\n"
            f'Query A: "{query_a}"\n'
            f'Query B: "{query_b}"'
        )
        response = client.models.generate_content(model=get_active_model(), contents=prompt)
        text = (response.text or "").strip()
        match = re.search(r'\{[^}]+\}', text)
        if match:
            data = json.loads(match.group())
            return bool(data.get("same", False))
    except Exception as exc:
        logger.warning(f"[AI_SIMILARITY] LLM call failed: {exc}")
    return False


_DOMAIN_MAP = {
    "POL": ["EXE", "LEG", "JUD", "GEO"],
    "ECO": ["MAC", "MIC", "INV", "MON", "TRD"],
    "BUS": ["SCA", "MID"],
    "TEC": ["SAI", "PHY", "BIO", "ROB", "DEF", "SPC", "NMI", "EHW"],
}
_DOMAIN_DESCRIPTIONS = {
    "POL": "politics, government, policy, elections, law, courts, geopolitics, diplomacy, international relations",
    "ECO": "economy, markets, inflation, interest rates, trade, GDP, monetary policy, investments, stocks",
    "BUS": "business, startups, companies, mergers, acquisitions, venture capital, industry, corporate",
    "TEC": "technology, AI, software, science, engineering, robotics, space, biotech, hardware, defense tech, weapons",
}
_SUBDOMAIN_DESCRIPTIONS = {
    "EXE": "executive branch, presidency, prime minister, cabinet, government administration",
    "LEG": "parliament, congress, legislature, laws, bills, voting",
    "JUD": "courts, judiciary, legal rulings, supreme court, international court",
    "GEO": "geopolitics, foreign policy, diplomacy, international relations, treaties",
    "MAC": "macroeconomics, GDP, inflation, recession, national economy",
    "MIC": "microeconomics, supply/demand, pricing, individual markets",
    "INV": "investments, stocks, bonds, portfolio, asset management",
    "MON": "monetary policy, central bank, interest rates, Fed, ECB",
    "TRD": "trade, imports, exports, tariffs, global commerce, supply chains",
    "SCA": "startups, venture capital, funding rounds, IPO, corporate activity, M&A",
    "MID": "market dynamics, industry competition, sector analysis",
    "SAI": "software, AI, machine learning, data science, programming, open source, LLMs",
    "PHY": "physics, material science, energy, quantum, nuclear research",
    "BIO": "biotechnology, genetics, pharmaceuticals, CRISPR, biomedical",
    "ROB": "robotics, automation, drones, autonomous systems",
    "DEF": "defence, weapons, military technology, hypersonic, cyber warfare, arms",
    "SPC": "space, satellites, rockets, NASA, SpaceX, astronomy",
    "NMI": "nanotechnology, materials innovation, semiconductors",
    "EHW": "electronics, hardware, chips, consumer tech, IoT",
}


def _keyword_classify_domain(query: str) -> tuple[str, str]:
    """Keyword-based fallback classifier — always returns a domain+subdomain."""
    q = query.lower()
    scores: dict[str, int] = {}
    for sub, desc in _SUBDOMAIN_DESCRIPTIONS.items():
        scores[sub] = sum(1 for kw in desc.replace(",", "").split() if len(kw) > 3 and kw in q)
    best_sub = max(scores, key=lambda s: scores[s])
    # find parent domain
    for domain, subs in _DOMAIN_MAP.items():
        if best_sub in subs:
            return domain, best_sub if scores[best_sub] > 0 else None
    return "OTH", None


def _ai_classify_domain(query: str) -> tuple[str, str]:
    """Use LLM to classify a free-form research query into a domain+subdomain.
    Falls back to keyword matching if LLM is unavailable."""
    try:
        from app.core.ollama_client import get_llm_client, get_active_model
        client = get_llm_client()
        domain_lines = "\n".join(f'  "{d}": {desc}' for d, desc in _DOMAIN_DESCRIPTIONS.items())
        subdomain_lines = "\n".join(f'  "{s}": {desc}' for s, desc in _SUBDOMAIN_DESCRIPTIONS.items())
        prompt = (
            "Classify this research query into one domain and one subdomain from the lists below.\n"
            "Answer ONLY with JSON, no other text: {\"domain\": \"XXX\", \"subdomain\": \"YYY\"}\n"
            "If it truly doesn't fit any domain, use {\"domain\": null, \"subdomain\": null}\n\n"
            f"Query: \"{query}\"\n\n"
            f"Domains:\n{domain_lines}\n\n"
            f"Subdomains:\n{subdomain_lines}"
        )
        response = client.models.generate_content(model=get_active_model(), contents=prompt)
        text = (response.text or "").strip()
        match = re.search(r'\{[^}]+\}', text)
        if match:
            data = json.loads(match.group())
            domain = data.get("domain")
            subdomain = data.get("subdomain")
            if domain in _DOMAIN_MAP:
                valid_sub = subdomain if subdomain in _DOMAIN_MAP.get(domain, []) else None
                logger.info(f"[AI_CLASSIFY] '{query[:60]}' → {domain}·{valid_sub}")
                return domain, valid_sub
    except Exception as exc:
        logger.warning(f"[AI_CLASSIFY] LLM call failed, using keyword fallback: {exc}")
    # Always fall back to keyword matching — never return None
    domain, subdomain = _keyword_classify_domain(query)
    logger.info(f"[KEYWORD_CLASSIFY] '{query[:60]}' → {domain}·{subdomain}")
    return domain, subdomain
from app.schemas.feed_card import (
    AttachRunRequest,
    AttachRunResponse,
    FeedCardCreate,
    FeedCardUpdate,
    FeedCardResponse,
    FeedCardListResponse,
    PinCardRequest,
    UserFeedCardResponse,
)

router = APIRouter(prefix="/api/feed-cards", tags=["feed-cards"])


# ── Global feed (public, no auth required) ─────────────────────────────────

@router.get("/global", response_model=FeedCardListResponse)
def get_global_cards(
    domain: Optional[str] = Query(None),
    subdomain: Optional[str] = Query(None),
    card_type: Optional[str] = Query(None),
    hours_back: Optional[int] = Query(None, ge=1, le=8760),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timedelta
    q = db.query(FeedCard).filter(FeedCard.is_global == True)
    if domain:
        q = q.filter(FeedCard.domain == domain.upper())
    if subdomain:
        q = q.filter(FeedCard.subdomain == subdomain.upper())
    if card_type:
        q = q.filter(FeedCard.type == card_type)
    if hours_back:
        since = datetime.now() - timedelta(hours=hours_back)
        q = q.filter(FeedCard.updated_at >= since)

    q = q.order_by(FeedCard.updated_at.desc(), FeedCard.created_at.desc())
    total = q.count()
    cards = q.offset(offset).limit(limit).all()
    return FeedCardListResponse(cards=cards, total=total)


# ── Hot cards (public, flat ranked list for sidebar) ─────────────────────────

@router.get("/hot", response_model=dict)
def get_hot_cards(
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    cards = db.query(FeedCard).all()

    def _score(card):
        s = 0
        if card.run_id:
            s += 100
        s += len(card.pinned_by) * 10
        if card.updated_at and (now - card.updated_at).total_seconds() < 86400:
            s += 50
        return s

    top = sorted(cards, key=_score, reverse=True)[:limit]
    return {
        "cards": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "domain": c.domain,
                "subdomain": c.subdomain,
                "pinned_count": c.pinned_count,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                "run_id": c.run_id,
                "type": c.type,
                "created_by": c.created_by,
                "is_global": c.is_global,
            }
            for c in top
        ]
    }


# ── Trending cards (public, grouped by domain/subdomain) ───────────────────

@router.get("/trending", response_model=dict)
def get_trending_cards(
    limit_per_subdomain: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
):
    cards = db.query(FeedCard).all()
    # Populated cards first, then by pinned_count desc
    cards_sorted = sorted(
        cards,
        key=lambda c: (0 if c.run_id else 1, -len(c.pinned_by)),
    )

    # Group by domain → subdomain
    grouped: dict[str, dict[str, list]] = {}
    for card in cards_sorted:
        domain = card.domain or "OTH"
        subdomain = card.subdomain or "OTH"
        if domain not in grouped:
            grouped[domain] = {}
        if subdomain not in grouped[domain]:
            grouped[domain][subdomain] = []
        if len(grouped[domain][subdomain]) < limit_per_subdomain:
            grouped[domain][subdomain].append({
                "id": card.id,
                "type": card.type,
                "title": card.title,
                "domain": card.domain,
                "subdomain": card.subdomain,
                "description": card.description,
                "run_id": card.run_id,
                "is_global": card.is_global,
                "created_at": card.created_at.isoformat(),
                "updated_at": card.updated_at.isoformat(),
                "pinned_count": len(card.pinned_by),
            })

    return {"trending": grouped}


# ── Single card (public) ────────────────────────────────────────────────────

@router.get("/{card_id}", response_model=FeedCardResponse)
def get_card(card_id: str, db: Session = Depends(get_db)):
    card = db.query(FeedCard).filter(FeedCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Feed card not found")
    return card


# ── Create card (auth required) ─────────────────────────────────────────────
# Admin → can create domain cards with is_global=True
# User  → can create custom cards (is_global defaults to False)

@router.post("", response_model=FeedCardResponse, status_code=status.HTTP_201_CREATED)
def create_card(
    payload: FeedCardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.type == "domain" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create domain cards")
    if payload.type == "custom" and not payload.run_id:
        raise HTTPException(status_code=400, detail="run_id required for custom cards")

    # Domain cards are always global (admin only); user custom cards are private by default
    is_global = (payload.is_global if current_user.role == "admin" else False)

    card = FeedCard(
        id=str(uuid.uuid4()),
        type=payload.type,
        title=payload.title,
        domain=payload.domain.upper() if payload.domain else None,
        subdomain=payload.subdomain.upper() if payload.subdomain else None,
        description=payload.description,
        run_id=payload.run_id,
        created_by=current_user.id,
        is_global=is_global,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


# ── Update card (owner or admin) ────────────────────────────────────────────

@router.patch("/{card_id}", response_model=FeedCardResponse)
def update_card(
    card_id: str,
    payload: FeedCardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(FeedCard).filter(FeedCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Feed card not found")
    if card.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorised")

    if payload.title is not None:
        card.title = payload.title
    if payload.description is not None:
        card.description = payload.description
    if payload.is_global is not None:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can change global visibility")
        card.is_global = payload.is_global

    db.commit()
    db.refresh(card)
    return card


# ── Delete card (owner or admin) ────────────────────────────────────────────

@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(FeedCard).filter(FeedCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Feed card not found")
    if card.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorised")
    db.delete(card)
    db.commit()


# ── User personal feed ───────────────────────────────────────────────────────

@router.get("/my/feed", response_model=list[UserFeedCardResponse])
def get_my_feed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pins = (
        db.query(UserFeedCard)
        .options(joinedload(UserFeedCard.card))
        .filter(UserFeedCard.user_id == current_user.id)
        .order_by(UserFeedCard.position, UserFeedCard.added_at)
        .all()
    )
    return pins


@router.post("/my/feed/{card_id}", response_model=UserFeedCardResponse, status_code=status.HTTP_201_CREATED)
def pin_card(
    card_id: str,
    payload: PinCardRequest = PinCardRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(FeedCard).filter(FeedCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Feed card not found")

    existing = db.query(UserFeedCard).filter(
        UserFeedCard.user_id == current_user.id,
        UserFeedCard.card_id == card_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Card already in your feed")

    pin = UserFeedCard(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        card_id=card_id,
        position=payload.position,
    )
    db.add(pin)
    card.pinned_count = (card.pinned_count or 0) + 1
    db.commit()
    db.refresh(pin)
    return pin


@router.delete("/my/feed/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def unpin_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pin = db.query(UserFeedCard).filter(
        UserFeedCard.user_id == current_user.id,
        UserFeedCard.card_id == card_id,
    ).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Card not in your feed")
    card = db.query(FeedCard).filter(FeedCard.id == card_id).first()
    db.delete(pin)
    if card:
        card.pinned_count = max(0, (card.pinned_count or 0) - 1)
    db.commit()


# ── User's own created cards (private) ────────────────────────────────────────

@router.get("/my/cards", response_model=FeedCardListResponse)
def get_my_created_cards(
    domain: Optional[str] = Query(None),
    hours_back: Optional[int] = Query(None, ge=1, le=8760),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get cards created by the current user (their own research)."""
    from datetime import datetime, timedelta
    q = db.query(FeedCard).filter(FeedCard.created_by == current_user.id)
    if domain:
        q = q.filter(FeedCard.domain == domain.upper())
    if hours_back:
        since = datetime.now() - timedelta(hours=hours_back)
        q = q.filter(FeedCard.updated_at >= since)
    total = q.count()
    cards = q.order_by(FeedCard.updated_at.desc()).offset(offset).limit(limit).all()
    return FeedCardListResponse(cards=cards, total=total)


# ── Attach run to existing or new card ──────────────────────────────────────
# Called automatically by the frontend after every research run completes.
# Merge logic:
#   1. domain+subdomain given → find existing custom card for that slot, update run_id
#   2. No domain → check title similarity ≥ 95% against existing custom cards
#   3. No match → create a new global custom card

@router.post("/attach-run", response_model=AttachRunResponse)
def attach_run(
    payload: AttachRunRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    def _stamp_run(run_id: str, card_id: str) -> None:
        """Back-fill card_id on the run row using raw SQL (column added by migration_v4)."""
        try:
            from sqlalchemy import text
            db.execute(
                text("UPDATE browser_research_runs SET card_id = :cid WHERE run_id = :rid AND (card_id IS NULL OR card_id = '')"),
                {"cid": card_id, "rid": run_id},
            )
        except Exception:
            pass  # migration not yet applied — silently skip

    # Priority: if caller knows the exact card to update, skip all matching logic
    if payload.card_id:
        target = db.query(FeedCard).filter(FeedCard.id == payload.card_id).first()
        if target:
            target.run_id = payload.run_id
            _stamp_run(payload.run_id, target.id)
            db.commit()
            return AttachRunResponse(merged=True, card_id=target.id, message="Updated card run_id directly")

    # Case 1: domain+subdomain given → always link to the DOMAIN card (never create a parallel custom card)
    if payload.domain and payload.subdomain:
        domain_card = (
            db.query(FeedCard)
            .filter(
                FeedCard.type == "domain",
                FeedCard.domain == payload.domain.upper(),
                FeedCard.subdomain == payload.subdomain.upper(),
            )
            .first()
        )
        if domain_card:
            domain_card.run_id = payload.run_id
            _stamp_run(payload.run_id, domain_card.id)
            db.commit()
            return AttachRunResponse(
                merged=True,
                card_id=domain_card.id,
                message=f"Research linked to domain card: {domain_card.title}",
            )
        # No domain card exists for this slot — create one (shouldn't happen after seeding)
        card = FeedCard(
            id=str(uuid.uuid4()),
            type="custom",
            title=payload.title or payload.query,
            domain=payload.domain.upper(),
            subdomain=payload.subdomain.upper(),
            run_id=payload.run_id,
            created_by=current_user.id if current_user else None,
            is_global=False,
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        return AttachRunResponse(merged=False, card_id=card.id, message="Created new card (global)")

    # Case 2: user research — use AI to check if query matches any existing card's topic
    query_norm = payload.query.strip().lower()
    existing_cards = db.query(FeedCard).all()

    # Stopwords to ignore when extracting content words
    _MERGE_STOPWORDS = {
        "what", "are", "the", "new", "latest", "updates", "update", "on", "about",
        "for", "and", "or", "of", "in", "to", "a", "an", "is", "it", "with",
        "how", "why", "when", "where", "who", "which", "news", "recent", "current",
        "give", "show", "get", "find", "tell", "me", "us", "best", "top", "now",
    }

    def _content_words(text: str) -> set[str]:
        words = re.findall(r"[a-z0-9]+", text.lower())
        return {w for w in words if len(w) > 3 and w not in _MERGE_STOPWORDS}

    query_content = _content_words(query_norm)

    # Pre-filter: require BOTH high lexical ratio AND at least 1 shared content word
    candidates = []
    for card in existing_cards:
        card_norm = (card.title or "").strip().lower()
        ratio = SequenceMatcher(None, query_norm, card_norm).ratio()
        if ratio < 0.65:
            continue
        # Reject if no content-word overlap — catches "updates on X" vs "updates on Y"
        card_content = _content_words(card_norm)
        if query_content and card_content and not query_content.intersection(card_content):
            continue
        candidates.append((ratio, card))
    candidates.sort(key=lambda x: x[0], reverse=True)

    for ratio_val, candidate in candidates[:3]:
        is_near_match = ratio_val >= 0.85
        if is_near_match or _ai_same_topic(payload.query, candidate.title or ""):
            candidate.run_id = payload.run_id
            db.commit()
            msg = (
                f"Updated existing card: '{candidate.title}'"
                if is_near_match
                else f"Merged into existing card: '{candidate.title}' (AI confirmed same topic)"
            )
            return AttachRunResponse(merged=True, card_id=candidate.id, message=msg)

    # Case 3: no match → new card; auto-classify domain/subdomain via AI
    auto_domain, auto_subdomain = None, None
    if not payload.domain:
        auto_domain, auto_subdomain = _ai_classify_domain(payload.query)
        if auto_domain:
            logger.info(f"[AI_CLASSIFY] '{payload.query[:60]}' → {auto_domain}·{auto_subdomain}")

    card = FeedCard(
        id=str(uuid.uuid4()),
        type="custom",
        title=payload.title or payload.query,
        domain=(payload.domain.upper() if payload.domain else auto_domain),
        subdomain=(payload.subdomain.upper() if payload.subdomain else auto_subdomain),
        run_id=payload.run_id,
        created_by=current_user.id if current_user else None,
        is_global=False,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return AttachRunResponse(merged=False, card_id=card.id, message="Created new card (private to your feed)")


# ── Admin: seed predefined domain cards ─────────────────────────────────────

DOMAIN_CARD_DEFINITIONS = [
    # Policy & Governance
    ("POL", "EXE", "Executive"),
    ("POL", "LEG", "Legislative"),
    ("POL", "JUD", "Judiciary"),
    ("POL", "GEO", "Geopolitics"),
    # Economy
    ("ECO", "MAC", "Macroeconomics"),
    ("ECO", "MIC", "Microeconomics"),
    ("ECO", "INV", "Investments"),
    ("ECO", "MON", "Monetary Policy"),
    ("ECO", "TRD", "Trade & Global Economy"),
    # Business
    ("BUS", "SCA", "Startups & Corporate Activity"),
    ("BUS", "MID", "Markets & Industry Dynamics"),
    # Science & Technology
    ("TEC", "SAI", "Software & AI"),
    ("TEC", "PHY", "Science – Physics"),
    ("TEC", "BIO", "Biotechnology"),
    ("TEC", "ROB", "Robotics"),
    ("TEC", "DEF", "Defence & Weapon Technologies"),
    ("TEC", "SPC", "Space"),
    ("TEC", "NMI", "Nano & Material Innovation"),
    ("TEC", "EHW", "Electronics & Hardware"),
]

DOMAIN_NAMES = {"POL": "Policy & Governance", "ECO": "Economy", "BUS": "Business", "TEC": "Science & Technology"}


@router.post("/admin/seed-domains", response_model=dict)
def seed_domain_cards(
    db: Session = Depends(get_db),
):
    created = 0
    skipped = 0
    for domain, subdomain, label in DOMAIN_CARD_DEFINITIONS:
        existing = db.query(FeedCard).filter(
            FeedCard.type == "domain",
            FeedCard.domain == domain,
            FeedCard.subdomain == subdomain,
        ).first()
        if existing:
            skipped += 1
            continue
        card = FeedCard(
            id=str(uuid.uuid4()),
            type="domain",
            title=f"{label}",
            domain=domain,
            subdomain=subdomain,
            description=f"{label} news under {DOMAIN_NAMES.get(domain, domain)}",
            is_global=True,
        )
        db.add(card)
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped, "total": len(DOMAIN_CARD_DEFINITIONS)}


# ── Admin: list ALL cards (with pagination) ──────────────────────────────────

@router.get("/admin/all", response_model=FeedCardListResponse)
def admin_list_all_cards(
    domain: Optional[str] = Query(None),
    card_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(FeedCard)
    if domain:
        q = q.filter(FeedCard.domain == domain.upper())
    if card_type:
        q = q.filter(FeedCard.type == card_type)
    total = q.count()
    cards = q.order_by(FeedCard.domain, FeedCard.subdomain, FeedCard.created_at).offset(offset).limit(limit).all()
    return FeedCardListResponse(cards=cards, total=total)


# ── Admin: promote / demote global ──────────────────────────────────────────

@router.patch("/{card_id}/global", response_model=FeedCardResponse)
def set_global(
    card_id: str,
    is_global: bool = Query(...),
    db: Session = Depends(get_db),
):
    card = db.query(FeedCard).filter(FeedCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Feed card not found")
    card.is_global = is_global
    db.commit()
    db.refresh(card)
    return card
