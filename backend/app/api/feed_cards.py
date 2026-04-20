import uuid
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.feed_card import FeedCard, UserFeedCard
from app.models.user import User
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
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(FeedCard).filter(FeedCard.is_global == True)
    if domain:
        q = q.filter(FeedCard.domain == domain.upper())
    if subdomain:
        q = q.filter(FeedCard.subdomain == subdomain.upper())
    if card_type:
        q = q.filter(FeedCard.type == card_type)
    total = q.count()
    cards = q.order_by(FeedCard.created_at.desc()).offset(offset).limit(limit).all()
    return FeedCardListResponse(cards=cards, total=total)


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

    is_global = True if payload.type == "custom" else (payload.is_global if current_user.role == "admin" else False)

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
    db.delete(pin)
    db.commit()


# ── Attach run to existing or new card ──────────────────────────────────────
# Called automatically by the frontend after every research run completes.
# Merge logic:
#   1. domain+subdomain given → find existing custom card for that slot, update run_id
#   2. No domain → check title similarity ≥ 95% against existing custom cards
#   3. No match → create a new global custom card

@router.post("/attach-run", response_model=AttachRunResponse)
def attach_run(payload: AttachRunRequest, db: Session = Depends(get_db)):
    # Case 1: admin ran research for a specific domain/subdomain slot
    if payload.domain and payload.subdomain:
        existing = (
            db.query(FeedCard)
            .filter(
                FeedCard.type == "custom",
                FeedCard.domain == payload.domain.upper(),
                FeedCard.subdomain == payload.subdomain.upper(),
            )
            .order_by(FeedCard.created_at.desc())
            .first()
        )
        if existing:
            existing.run_id = payload.run_id
            db.commit()
            return AttachRunResponse(
                merged=True,
                card_id=existing.id,
                message=f"Merged into existing card: {existing.title}",
            )
        card = FeedCard(
            id=str(uuid.uuid4()),
            type="custom",
            title=payload.title or payload.query,
            domain=payload.domain.upper(),
            subdomain=payload.subdomain.upper(),
            run_id=payload.run_id,
            is_global=True,
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        return AttachRunResponse(merged=False, card_id=card.id, message="Created new card for this domain slot")

    # Case 2: user research — check query similarity against existing custom card titles
    query_lower = payload.query.strip().lower()
    existing_cards = db.query(FeedCard).filter(FeedCard.type == "custom").all()
    best_match = None
    best_ratio = 0.0
    for card in existing_cards:
        ratio = SequenceMatcher(None, query_lower, (card.title or "").strip().lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = card

    if best_match and best_ratio >= 0.95:
        best_match.run_id = payload.run_id
        db.commit()
        return AttachRunResponse(
            merged=True,
            card_id=best_match.id,
            message=f"Merged into existing card: '{best_match.title}' ({best_ratio:.0%} match)",
        )

    # Case 3: no match → new card
    card = FeedCard(
        id=str(uuid.uuid4()),
        type="custom",
        title=payload.title or payload.query,
        domain=payload.domain.upper() if payload.domain else None,
        subdomain=payload.subdomain.upper() if payload.subdomain else None,
        run_id=payload.run_id,
        is_global=True,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return AttachRunResponse(merged=False, card_id=card.id, message="Created new card in Global Feed")


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
