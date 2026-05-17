import uuid
import asyncio
import json
import math
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from app.core.database import SessionLocal
from app.models.feed_card import FeedCard, UserFeedCard
from app.models.browser_research_run import BrowserResearchRun, BrowserResearchItem
from app.models.recommendation import UserRecommendation
from app.models.user_interaction import UserInteraction
from app.models.user import User

logger = logging.getLogger(__name__)

# Max age for recommendations before cleanup (days)
RECOMMENDATION_TTL_DAYS = 7
# Fraction of recommendations from outside user's interests (serendipity)
SERENDIPITY_RATIO = 0.10
MAX_SERENDIPITY_ITEMS = 5
# A/B experiment groups
EXPERIMENT_GROUPS = ["control", "trending_boost"]
# Collaborative filtering - minimum overlap to consider users "similar"
COLLAB_MIN_OVERLAP = 3

DOMAIN_NAMES = {
    "POL": "Policy & Governance",
    "ECO": "Economy",
    "BUS": "Business",
    "TEC": "Science & Technology",
    "OTH": "Others",
}

# ── Subdomain-level search config ────────────────────────────────────────────

SUBDOMAIN_CONFIG = {
    # Science & Technology
    "SAI": {
        "domain": "TEC", "label": "Software & AI",
        "queries": ["artificial intelligence AI LLM breakthroughs news today", "software engineering open source tech news"],
        "subreddits": ["artificial", "MachineLearning", "programming"],
        "youtube": ["@TwoMinutePapers"],
    },
    "PHY": {
        "domain": "TEC", "label": "Science – Physics",
        "queries": ["physics research quantum computing fusion energy breakthroughs", "particle physics dark matter discovery news"],
        "subreddits": ["Physics", "QuantumComputing"],
        "youtube": ["@veaborea"],
    },
    "BIO": {
        "domain": "TEC", "label": "Biotechnology",
        "queries": ["biotech gene editing CRISPR drug approval clinical trials news", "pandemic preparedness health research"],
        "subreddits": ["biotech", "science"],
        "youtube": [],
    },
    "ROB": {
        "domain": "TEC", "label": "Robotics",
        "queries": ["robotics humanoid autonomous systems industrial automation news", "AI robotics embodied intelligence"],
        "subreddits": ["robotics", "Automate"],
        "youtube": [],
    },
    "DEF": {
        "domain": "TEC", "label": "Defence & Weapon Technologies",
        "queries": ["defense technology military drones hypersonic weapons cyber warfare", "arms procurement defense innovation news"],
        "subreddits": ["DefenseNews", "LessCredibleDefence"],
        "youtube": [],
    },
    "SPC": {
        "domain": "TEC", "label": "Space",
        "queries": ["space launch satellite SpaceX NASA moon Mars mission news", "commercial space rocket constellation today"],
        "subreddits": ["space", "SpaceXLounge"],
        "youtube": ["@EverydayAstronaut"],
    },
    "NMI": {
        "domain": "TEC", "label": "Nano & Material Innovation",
        "queries": ["nanotechnology advanced materials graphene metamaterials research", "material science manufacturing breakthroughs"],
        "subreddits": ["Nanotechnology"],
        "youtube": [],
    },
    "EHW": {
        "domain": "TEC", "label": "Electronics & Hardware",
        "queries": ["semiconductor chip TSMC GPU AI hardware innovation news", "consumer electronics devices supply chain"],
        "subreddits": ["hardware", "chipdesign"],
        "youtube": [],
    },
    # Economy
    "MAC": {
        "domain": "ECO", "label": "Macroeconomics",
        "queries": ["global GDP growth inflation recession economic outlook news", "IMF World Bank fiscal policy macroeconomics"],
        "subreddits": ["economics"],
        "youtube": [],
    },
    "MIC": {
        "domain": "ECO", "label": "Microeconomics",
        "queries": ["consumer trends corporate competition pricing market structure", "business economics supply demand news"],
        "subreddits": ["economics"],
        "youtube": [],
    },
    "INV": {
        "domain": "ECO", "label": "Investments",
        "queries": ["stock market IPO venture capital private equity investment news", "emerging markets capital flows today"],
        "subreddits": ["stocks", "investing"],
        "youtube": [],
    },
    "MON": {
        "domain": "ECO", "label": "Monetary Policy",
        "queries": ["central bank interest rate decision monetary policy inflation", "Federal Reserve ECB rate cut hike news"],
        "subreddits": ["finance", "economics"],
        "youtube": [],
    },
    "TRD": {
        "domain": "ECO", "label": "Trade & Global Economy",
        "queries": ["global trade tariffs supply chain WTO bilateral deals news", "export import reshoring trade war"],
        "subreddits": ["GlobalTrade", "economics"],
        "youtube": [],
    },
    # Policy & Governance
    "EXE": {
        "domain": "POL", "label": "Executive",
        "queries": ["heads of state executive decisions government policy leadership", "president prime minister cabinet news today"],
        "subreddits": ["worldnews", "politics"],
        "youtube": [],
    },
    "LEG": {
        "domain": "POL", "label": "Legislative",
        "queries": ["parliament legislation bills policy reforms legislative debates", "congress senate law passing news"],
        "subreddits": ["politics", "law"],
        "youtube": [],
    },
    "JUD": {
        "domain": "POL", "label": "Judiciary",
        "queries": ["court rulings landmark legal judgments constitutional law", "supreme court international justice human rights"],
        "subreddits": ["law", "SupremeCourt"],
        "youtube": [],
    },
    "GEO": {
        "domain": "POL", "label": "Geopolitics",
        "queries": ["geopolitical flashpoints global power shifts alliances diplomacy", "international crisis world order rivalries news"],
        "subreddits": ["geopolitics", "worldnews"],
        "youtube": ["@WION"],
    },
    # Business
    "SCA": {
        "domain": "BUS", "label": "Startups & Corporate Activity",
        "queries": ["startup funding unicorn IPO mergers acquisitions corporate deals", "venture capital cross-border business news"],
        "subreddits": ["startups", "business"],
        "youtube": [],
    },
    "MID": {
        "domain": "BUS", "label": "Markets & Industry Dynamics",
        "queries": ["industry disruption market consolidation sector dynamics news", "competitive landscape incumbent challengers business"],
        "subreddits": ["business", "entrepreneur"],
        "youtube": [],
    },
}

# Map domain → its subdomains
DOMAIN_SUBDOMAINS: dict[str, list[str]] = {}
for _sub_code, _sub_cfg in SUBDOMAIN_CONFIG.items():
    DOMAIN_SUBDOMAINS.setdefault(_sub_cfg["domain"], []).append(_sub_code)


# ── Source fetchers (unchanged) ───────────────────────────────────────────────

async def _search_google_news(query: str, country_code: str = "USA") -> list[dict]:
    try:
        from app.services.article_extractor_service import article_extractor_service
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        items = await article_extractor_service.search(
            country_code=country_code, topic=query, date=today, max_results=3
        )
        return [
            {
                "title": item.get("title", ""),
                "summary": item.get("content", ""),
                "source_url": item.get("url", ""),
                "source_type": "google_news",
                "score": None,
            }
            for item in items if item.get("title")
        ]
    except Exception as exc:
        logger.warning(f"[CRON] Google News failed: {exc}")
        return []


async def _search_reddit(subreddits: list[str]) -> list[dict]:
    if not subreddits:
        return []
    try:
        from app.services.reddit_scraping_service import reddit_scraping_service
        community_results = await reddit_scraping_service.scrape_communities(
            communities=subreddits[:2], mode="hot", posts_per_community=2, summarize=False,
        )
        results = []
        for community in community_results:
            for post in community.get("posts", []):
                if post.get("title"):
                    results.append({
                        "title": post["title"],
                        "summary": post.get("summary") or (post.get("selftext") or "")[:500],
                        "source_url": post.get("post_url", ""),
                        "source_type": "reddit",
                        "score": post.get("score", 0),
                    })
        return results
    except Exception as exc:
        logger.warning(f"[CRON] Reddit failed: {exc}")
        return []


async def _search_youtube(channels: list[str]) -> list[dict]:
    if not channels:
        return []
    try:
        from app.services.youtube_scraping_service import youtube_scraping_service
        channel_results = await youtube_scraping_service.scrape_channels(
            channels=channels[:1], videos_per_channel=2, summarize=False,
        )
        results = []
        for channel in (channel_results if isinstance(channel_results, list) else []):
            for video in channel.get("videos", []):
                if video.get("title"):
                    results.append({
                        "title": video["title"],
                        "summary": video.get("summary") or (video.get("description") or "")[:500],
                        "source_url": video.get("video_url", ""),
                        "source_type": "youtube",
                        "score": video.get("view_count"),
                    })
        return results
    except Exception as exc:
        logger.warning(f"[CRON] YouTube failed: {exc}")
        return []


async def _search_hackernews(keywords: list[str]) -> list[dict]:
    if not keywords:
        return []
    try:
        from app.services.hackernews_service import hackernews_service
        stories = await hackernews_service.fetch_best(limit=40)
        matched = await hackernews_service.search_by_keywords(keywords[:3], stories)
        return [
            {
                "title": s["title"],
                "summary": f"Hacker News — {s.get('score', 0)} points · {s.get('comments', 0)} comments",
                "source_url": s.get("hn_url") or s.get("url", ""),
                "source_type": "hackernews",
                "score": s.get("score"),
                "published_at": s.get("published_at"),
                "comments": s.get("comments"),
            }
            for s in matched[:3]
        ]
    except Exception as exc:
        logger.warning(f"[RECS] HN failed: {exc}")
        return []


async def _fetch_rss(sub_code: str, domain_code: str) -> list[dict]:
    try:
        from app.services.rss_service import rss_service
        items = await rss_service.fetch_for_subdomain(sub_code, limit_per_feed=3)
        return [
            {
                "title": item["title"],
                "summary": item.get("summary", ""),
                "source_url": item["url"],
                "source_type": "rss",
                "score": None,
                "published_at": item.get("published_at"),
            }
            for item in items if item.get("title")
        ]
    except Exception as exc:
        logger.warning(f"[RECS] RSS failed for {sub_code}: {exc}")
        return []


async def _ai_filter_items(items: list[dict], topic: str) -> list[dict]:
    """One LLM call — sends only titles, returns items the model considers relevant."""
    import re as _re
    if not items:
        return items
    try:
        from app.core.ollama_client import get_llm_client, get_active_model
        _client = get_llm_client()
        _model = get_active_model()
        lines = "\n".join(f"{i+1}. {it.get('title','')[:120]}" for i, it in enumerate(items))
        prompt = (
            f'A user is interested in: "{topic}"\n\n'
            f'For each item below, answer YES if it is a useful result for that interest, '
            f'NO if it does not match what the user is looking for.\n'
            f'Reply ONLY with: 1:YES 2:NO 3:YES (number colon YES or NO for every item)\n\n'
            f'{lines}'
        )
        resp = await asyncio.to_thread(_client.models.generate_content, model=_model, contents=prompt)
        text = (resp.text or "")
        pairs = _re.findall(r'(\d+)\s*[:.\-]\s*(YES|NO|yes|no|Yes|No)', text)
        if pairs:
            keep_nums = {int(n) for n, v in pairs if v.upper() == "YES"}
        else:
            keep_nums = {int(n) for n in _re.findall(r'\b(\d+)\b', text)
                         if 1 <= int(n) <= len(items)}
        if keep_nums:
            kept = [it for i, it in enumerate(items) if (i + 1) in keep_nums]
            if len(kept) >= max(2, len(items) * 0.25):
                logger.info(f"[CRON] AI filter kept {len(kept)}/{len(items)} for '{topic[:60]}'")
                return kept
    except Exception as _e:
        logger.warning(f"[CRON] AI filter failed: {_e}")
    return items


def _extract_hn_keywords(cfg: dict) -> list[str]:
    """Extract short keywords from subdomain label + queries for HN title matching."""
    words: list[str] = []
    label = cfg.get("label", "")
    if label:
        words.extend(w for w in label.split() if len(w) > 2 and w not in {"and", "the", "for"})
    for q in cfg.get("queries", []):
        for w in q.split():
            if len(w) > 3 and w.lower() not in {
                "news", "today", "breakthroughs", "research", "latest", "current",
                "recent", "global", "world",
            }:
                words.append(w)
    # Deduplicate while keeping order, limit to top keywords
    seen_w: set[str] = set()
    unique_kw: list[str] = []
    for w in words:
        lw = w.lower()
        if lw not in seen_w:
            seen_w.add(lw)
            unique_kw.append(w)
    return unique_kw[:6]


async def _search_for_subdomain_base(sub_code: str, trending_keywords: list[str] = None) -> list[dict]:
    """Search non-geo sources (Reddit, YouTube, RSS, HN) — shared across countries."""
    cfg = SUBDOMAIN_CONFIG.get(sub_code)
    if not cfg:
        return []

    tasks = []
    tasks.append(_search_reddit(cfg.get("subreddits", [])))
    tasks.append(_search_youtube(cfg.get("youtube", [])))
    tasks.append(_fetch_rss(sub_code, cfg.get("domain", "")))
    # Combine static keywords with trending keywords for HN search
    hn_keywords = _extract_hn_keywords(cfg)
    if trending_keywords:
        # Add trending words that overlap with this subdomain's topic
        label_words = {w.lower() for w in cfg.get("label", "").split() if len(w) > 2}
        query_words = set()
        for q in cfg.get("queries", []):
            query_words.update(w.lower() for w in q.split() if len(w) > 3)
        relevant_trending = [
            kw for kw in trending_keywords
            if kw.lower() in label_words or kw.lower() in query_words
        ]
        if relevant_trending:
            hn_keywords = list(dict.fromkeys(relevant_trending + hn_keywords))[:8]
    if hn_keywords:
        tasks.append(_search_hackernews(hn_keywords))

    results_batches = await asyncio.gather(*tasks, return_exceptions=True)

    items: list[dict] = []
    for batch in results_batches:
        if isinstance(batch, list):
            items.extend(batch)
    return items


async def _search_google_news_for_subdomain(sub_code: str, country_code: str = "USA") -> list[dict]:
    """Search Google News for a subdomain with a specific country."""
    cfg = SUBDOMAIN_CONFIG.get(sub_code)
    if not cfg:
        return []
    tasks = [_search_google_news(q, country_code=country_code) for q in cfg.get("queries", [])]
    results_batches = await asyncio.gather(*tasks, return_exceptions=True)
    items: list[dict] = []
    for batch in results_batches:
        if isinstance(batch, list):
            items.extend(batch)
    return items


def _dedup_and_filter_sync(items: list[dict]) -> list[dict]:
    """Deduplicate items by URL."""
    seen: set[str] = set()
    unique: list[dict] = []
    for item in items:
        url = item.get("source_url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(item)
        elif not url:
            unique.append(item)
    return unique


async def _search_for_subdomain(sub_code: str, country_code: str = "USA") -> list[dict]:
    """Full search for a subdomain: base sources + geo-aware Google News."""
    cfg = SUBDOMAIN_CONFIG.get(sub_code)
    if not cfg:
        return []

    base_items, gnews_items = await asyncio.gather(
        _search_for_subdomain_base(sub_code),
        _search_google_news_for_subdomain(sub_code, country_code=country_code),
        return_exceptions=True,
    )

    all_items: list[dict] = []
    if isinstance(gnews_items, list):
        all_items.extend(gnews_items)
    if isinstance(base_items, list):
        all_items.extend(base_items)

    unique = _dedup_and_filter_sync(all_items)

    # AI relevance filter
    if unique and cfg.get("queries"):
        unique = await _ai_filter_items(unique, cfg["queries"][0])

    return unique


# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_batch_label() -> str:
    """Return morning/afternoon/evening based on current UTC hour."""
    hour = datetime.now(timezone.utc).hour
    if hour < 12:
        return "morning"
    elif hour < 17:
        return "afternoon"
    return "evening"


def _cleanup_old_recommendations(db: Session) -> int:
    """Delete recommendations older than TTL to prevent DB bloat."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECOMMENDATION_TTL_DAYS)
    deleted = (
        db.query(UserRecommendation)
        .filter(UserRecommendation.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    if deleted:
        logger.info(f"[CRON] Cleaned up {deleted} old recommendations (>{RECOMMENDATION_TTL_DAYS}d)")
    return deleted


def _get_dismissed_urls(db: Session, user_id: str) -> set[str]:
    """Get source_urls the user has already dismissed (is_seen=True)."""
    rows = (
        db.query(UserRecommendation.source_url)
        .filter(
            UserRecommendation.user_id == user_id,
            UserRecommendation.is_seen.is_(True),
            UserRecommendation.source_url.isnot(None),
        )
        .all()
    )
    return {r.source_url for r in rows if r.source_url}


def _get_existing_urls(db: Session, user_id: str) -> set[str]:
    """Get source_urls already recommended to this user (within TTL window)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECOMMENDATION_TTL_DAYS)
    rows = (
        db.query(UserRecommendation.source_url)
        .filter(
            UserRecommendation.user_id == user_id,
            UserRecommendation.created_at >= cutoff,
            UserRecommendation.source_url.isnot(None),
        )
        .all()
    )
    return {r.source_url for r in rows if r.source_url}


def _get_user_affinity(db: Session, user_id: str) -> dict[str, float]:
    """
    Build per-subdomain affinity from click/dismiss history.
    Clicks boost, dismisses penalize. Returns {subdomain: affinity_score}.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    interactions = (
        db.query(
            UserInteraction.subdomain,
            UserInteraction.action,
            sa_func.count(UserInteraction.id).label("cnt"),
        )
        .filter(
            UserInteraction.user_id == user_id,
            UserInteraction.created_at >= cutoff,
            UserInteraction.subdomain.isnot(None),
        )
        .group_by(UserInteraction.subdomain, UserInteraction.action)
        .all()
    )
    affinity: dict[str, float] = {}
    for sub, action, cnt in interactions:
        if not sub:
            continue
        current = affinity.get(sub, 0.0)
        if action == "click":
            current += cnt * 3.0
        elif action == "dismiss":
            current -= cnt * 1.5
        affinity[sub] = current
    return affinity


async def _fetch_trending_keywords() -> list[str]:
    """Fetch current trending topics from HN to augment static queries."""
    try:
        from app.services.hackernews_service import hackernews_service
        stories = await hackernews_service.fetch_best(limit=30)
        # Extract frequent meaningful words from top HN titles
        word_freq: dict[str, int] = {}
        stop = {
            "the", "and", "for", "are", "but", "not", "you", "all", "can",
            "has", "was", "one", "our", "out", "how", "its", "than", "them",
            "been", "have", "from", "with", "this", "that", "what", "when",
            "your", "will", "more", "about", "which", "their", "into",
            "show", "ask", "new", "now", "why", "just", "get", "use",
        }
        for s in stories:
            for w in (s.get("title", "") or "").split():
                w_clean = w.strip("()[]{}:.,!?\"'").lower()
                if len(w_clean) > 3 and w_clean not in stop and w_clean.isalpha():
                    word_freq[w_clean] = word_freq.get(w_clean, 0) + 1
        # Top trending words that appear in multiple stories
        trending = sorted(
            ((w, c) for w, c in word_freq.items() if c >= 2),
            key=lambda x: x[1], reverse=True,
        )
        keywords = [w for w, _ in trending[:10]]
        if keywords:
            logger.info(f"[CRON] Trending keywords: {keywords}")
        return keywords
    except Exception as exc:
        logger.warning(f"[CRON] Trending keywords fetch failed: {exc}")
        return []


def _get_collaborative_boost(db: Session, user_id: str) -> dict[str, float]:
    """
    Collaborative filtering: find users with similar click patterns,
    return boost scores for subdomains they clicked that current user hasn't.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    # Get current user's clicked URLs
    user_clicks = (
        db.query(UserInteraction.source_url)
        .filter(
            UserInteraction.user_id == user_id,
            UserInteraction.action == "click",
            UserInteraction.created_at >= cutoff,
            UserInteraction.source_url.isnot(None),
        )
        .all()
    )
    user_urls = {r.source_url for r in user_clicks if r.source_url}
    if len(user_urls) < 2:
        return {}

    # Find other users who clicked the same URLs
    similar_users = (
        db.query(
            UserInteraction.user_id,
            sa_func.count(UserInteraction.id).label("overlap"),
        )
        .filter(
            UserInteraction.user_id != user_id,
            UserInteraction.action == "click",
            UserInteraction.source_url.in_(user_urls),
            UserInteraction.created_at >= cutoff,
        )
        .group_by(UserInteraction.user_id)
        .having(sa_func.count(UserInteraction.id) >= COLLAB_MIN_OVERLAP)
        .order_by(sa_func.count(UserInteraction.id).desc())
        .limit(10)
        .all()
    )

    if not similar_users:
        return {}

    similar_user_ids = [r.user_id for r in similar_users]

    # Get subdomains those similar users clicked (that current user hasn't)
    collab_subs = (
        db.query(
            UserInteraction.subdomain,
            sa_func.count(UserInteraction.id).label("cnt"),
        )
        .filter(
            UserInteraction.user_id.in_(similar_user_ids),
            UserInteraction.action == "click",
            UserInteraction.created_at >= cutoff,
            UserInteraction.subdomain.isnot(None),
        )
        .group_by(UserInteraction.subdomain)
        .all()
    )

    boost: dict[str, float] = {}
    for sub, cnt in collab_subs:
        if sub:
            boost[sub] = min(cnt * 2.0, 15.0)  # cap at 15

    if boost:
        logger.debug(f"[CRON] Collab boost for {user_id[:8]}: {boost}")
    return boost


def _assign_experiment(user_id: str) -> str:
    """Deterministically assign user to an A/B experiment group based on user_id hash."""
    h = hash(user_id) % len(EXPERIMENT_GROUPS)
    return EXPERIMENT_GROUPS[h]


def _compute_relevance_score(item: dict, subdomain_affinity: float = 0.0) -> float:
    """
    Compute a relevance score for ranking recommendations.
    Factors: source engagement, recency, source quality, user affinity.
    Returns a float where higher = more relevant.
    """
    score = 0.0

    # Source engagement score (normalized log scale)
    raw_score = item.get("score")
    if raw_score and raw_score > 0:
        score += min(math.log1p(raw_score) * 5, 50)  # cap at 50

    # Source type quality bonus
    source_bonus = {
        "google_news": 15,
        "hackernews": 12,
        "rss": 10,
        "reddit": 8,
        "youtube": 8,
    }
    score += source_bonus.get(item.get("source_type", ""), 5)

    # Recency bonus — items with published_at get a boost if recent
    pub = item.get("published_at")
    if pub:
        try:
            if isinstance(pub, str):
                pub = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - pub).total_seconds() / 3600
            if age_hours < 6:
                score += 20
            elif age_hours < 24:
                score += 10
            elif age_hours < 72:
                score += 5
        except (ValueError, TypeError):
            pass

    # Title length heuristic — very short titles are usually low quality
    title = item.get("title", "")
    if len(title) > 30:
        score += 5

    # User affinity boost/penalty from click/dismiss history
    score += min(max(subdomain_affinity, -20), 30)

    return score


def _save_run_for_card(db: Session, card: FeedCard, items: list[dict]) -> None:
    """Create a BrowserResearchRun from fetched items and link it to the card."""
    cfg = SUBDOMAIN_CONFIG.get(card.subdomain or "", {})
    run = BrowserResearchRun(
        run_id=str(uuid.uuid4()),
        query=(cfg.get("queries") or [card.title or card.subdomain or ""])[0],
        selected_reddit_communities=json.dumps(cfg.get("subreddits", [])),
        youtube_channels_used=json.dumps(cfg.get("youtube", [])),
        total_blogs=len(items),
        created_by=None,
    )
    db.add(run)
    for item in items:
        db.add(BrowserResearchItem(
            run_id=run.run_id,
            source=item.get("source_type", "web"),
            title=(item.get("title") or "")[:512],
            summary=(item.get("summary") or "")[:4000],
            url=item.get("source_url") or "",
            score=item.get("score"),
            published_at=item.get("published_at"),
            comments=item.get("comments"),
        ))
    card.run_id = run.run_id


# ── Main cron function ────────────────────────────────────────────────────────

def refresh_cards() -> int:
    """
    Cron entry point.

    Phase 1 — Admin cards (is_global=True, created_by=NULL, type='domain'):
      Always refreshed regardless of user activity. These are the showcase cards.

    Phase 2 — User-pinned cards (UserFeedCard rows):
      Any card saved by at least one user gets a fresh run.
      Admin cards already handled in Phase 1 are skipped here.
    """
    db: Session = SessionLocal()
    try:
        # Phase 1: admin/global domain cards
        admin_cards: list[FeedCard] = (
            db.query(FeedCard)
            .filter(
                FeedCard.is_global.is_(True),
                FeedCard.created_by.is_(None),
                FeedCard.type == "domain",
            )
            .all()
        )

        # Phase 2: user-pinned non-admin cards
        admin_ids = {c.id for c in admin_cards}
        pinned_ids = {
            row.card_id
            for row in db.query(UserFeedCard.card_id).distinct().all()
            if row.card_id not in admin_ids
        }
        user_cards: list[FeedCard] = (
            db.query(FeedCard).filter(FeedCard.id.in_(pinned_ids)).all()
            if pinned_ids else []
        )

        # Only cards with a known subdomain config
        cards_to_refresh = [
            c for c in (admin_cards + user_cards)
            if c.subdomain and c.subdomain in SUBDOMAIN_CONFIG
        ]

        logger.info(
            f"[CRON] Refreshing {len(cards_to_refresh)} cards "
            f"({len(admin_cards)} admin + {len(user_cards)} user-pinned)"
        )

        users = db.query(User).filter(User.interests.isnot(None)).all()

        # Fetch Google News from ALL supported countries
        all_countries = ["USA", "INDIA", "UK", "CHINA", "GERMANY", "JAPAN", "FRANCE", "ITALY"]

        # ── Collect all subdomains needed (cards + all user interests) ──
        all_needed_subs: set[str] = {c.subdomain for c in cards_to_refresh}
        for u in users:
            for code in (u.interests or []):
                code_upper = code.upper()
                if code_upper in DOMAIN_SUBDOMAINS:
                    all_needed_subs.update(DOMAIN_SUBDOMAINS[code_upper])
                if code_upper in SUBDOMAIN_CONFIG:
                    all_needed_subs.add(code_upper)

        unique_subs = list(all_needed_subs)

        # Step 0: Fetch trending keywords from HN for adaptive queries
        loop = asyncio.new_event_loop()
        try:
            trending_keywords = loop.run_until_complete(_fetch_trending_keywords())
        except Exception:
            trending_keywords = []
        finally:
            loop.close()

        # Step 1: Fetch base (non-geo) sources once per subdomain (with trending)
        # Step 2: Fetch Google News per (subdomain, country) combo
        base_tasks = [_search_for_subdomain_base(s, trending_keywords=trending_keywords) for s in unique_subs]
        gnews_tasks = []
        gnews_keys = []
        for sub in unique_subs:
            for country in all_countries:
                gnews_tasks.append(_search_google_news_for_subdomain(sub, country))
                gnews_keys.append((sub, country))

        loop = asyncio.new_event_loop()
        try:
            all_results = loop.run_until_complete(
                asyncio.gather(*(base_tasks + gnews_tasks), return_exceptions=True)
            )
        finally:
            loop.close()

        # Split results
        base_results = all_results[:len(unique_subs)]
        gnews_results = all_results[len(unique_subs):]

        base_items_map: dict[str, list[dict]] = {
            sub: (res if isinstance(res, list) else [])
            for sub, res in zip(unique_subs, base_results)
        }
        gnews_items_map: dict[tuple[str, str], list[dict]] = {
            key: (res if isinstance(res, list) else [])
            for key, res in zip(gnews_keys, gnews_results)
        }

        # Merge: sub_items_by_country[(sub, country)] = base + gnews, deduped
        sub_items_by_country: dict[tuple[str, str], list[dict]] = {}
        for sub in unique_subs:
            base = base_items_map.get(sub, [])
            for country in all_countries:
                gnews = gnews_items_map.get((sub, country), [])
                merged = _dedup_and_filter_sync(gnews + base)
                sub_items_by_country[(sub, country)] = merged

        # Default USA sub_items for card refresh
        sub_items: dict[str, list[dict]] = {
            sub: sub_items_by_country.get((sub, "USA"), [])
            for sub in unique_subs
        }

        refreshed = 0
        for card in cards_to_refresh:
            items = sub_items.get(card.subdomain, [])
            if not items:
                logger.warning(f"[CRON] No items fetched for {card.subdomain} ('{card.title}'), skipping")
                continue
            _save_run_for_card(db, card, items)
            refreshed += 1
            tag = "admin" if card.id in admin_ids else "user"
            logger.info(f"[CRON] [{tag}] '{card.title}' ({card.subdomain}): {len(items)} items")

        db.commit()
        logger.info(f"[CRON] Complete — {refreshed}/{len(cards_to_refresh)} cards refreshed")

        # ── Phase 3: Cleanup old recommendations ─────────────────────────
        _cleanup_old_recommendations(db)

        # ── Phase 4: Create UserRecommendation rows per user interest ────
        batch_label = _get_batch_label()
        rec_count = 0
        skipped_dup = 0
        skipped_dismissed = 0
        serendipity_count = 0

        for user in users:
            interests = user.interests or []
            if not interests:
                continue

            # Assign A/B experiment group
            experiment = _assign_experiment(user.id)

            # Pre-fetch URLs already recommended and dismissed for this user
            existing_urls = _get_existing_urls(db, user.id)
            dismissed_urls = _get_dismissed_urls(db, user.id)

            # Get click/dismiss affinity per subdomain
            affinity = _get_user_affinity(db, user.id)

            # Collaborative filtering: boost from similar users' clicks
            collab_boost = _get_collaborative_boost(db, user.id)

            # Collect subdomains the user cares about (both domain and subdomain codes)
            user_subs: set[str] = set()
            user_domains: set[str] = set()
            for code in interests:
                code_upper = code.upper()
                if code_upper in DOMAIN_SUBDOMAINS:
                    user_subs.update(DOMAIN_SUBDOMAINS[code_upper])
                    user_domains.add(code_upper)
                if code_upper in SUBDOMAIN_CONFIG:
                    user_subs.add(code_upper)
                    user_domains.add(SUBDOMAIN_CONFIG[code_upper]["domain"])

            if not user_subs:
                continue

            # Helper to build a candidate from an item
            def _make_candidate(item, sub_code, is_serendipity=False):
                url = item.get("source_url") or ""
                if url and url in dismissed_urls:
                    return None, "dismissed"
                if url and url in existing_urls:
                    return None, "dup"
                sub_aff = affinity.get(sub_code, 0.0) + collab_boost.get(sub_code, 0.0)
                relevance = _compute_relevance_score(item, subdomain_affinity=sub_aff)
                # Trending boost for experiment group
                if experiment == "trending_boost" and trending_keywords:
                    title_lower = (item.get("title") or "").lower()
                    trending_hits = sum(1 for kw in trending_keywords if kw in title_lower)
                    if trending_hits:
                        relevance += trending_hits * 5
                if is_serendipity:
                    relevance *= 0.7
                cfg = SUBDOMAIN_CONFIG.get(sub_code, {})
                domain_code = cfg.get("domain", "OTH")
                return (item, sub_code, domain_code, relevance, is_serendipity), None

            # ── Merge items from ALL countries (deduped) ──
            def _get_merged_items(sub_code: str) -> list[dict]:
                combined: list[dict] = []
                for c in all_countries:
                    combined.extend(sub_items_by_country.get((sub_code, c), []))
                return _dedup_and_filter_sync(combined)

            # ── Interest-matched candidates ──
            candidates = []
            for sub_code in user_subs:
                for item in _get_merged_items(sub_code):
                    result, skip_reason = _make_candidate(item, sub_code)
                    if skip_reason == "dismissed":
                        skipped_dismissed += 1
                    elif skip_reason == "dup":
                        skipped_dup += 1
                    elif result:
                        candidates.append(result)

            # ── Serendipity: inject items from domains user hasn't selected ──
            other_subs = [
                s for s in SUBDOMAIN_CONFIG
                if s not in user_subs and SUBDOMAIN_CONFIG[s]["domain"] not in user_domains
            ]
            serendipity_candidates = []
            for sub_code in other_subs:
                for item in _get_merged_items(sub_code):
                    result, _ = _make_candidate(item, sub_code, is_serendipity=True)
                    if result:
                        serendipity_candidates.append(result)

            # Pick top N serendipity items
            serendipity_candidates.sort(key=lambda c: c[3], reverse=True)
            max_ser = min(MAX_SERENDIPITY_ITEMS, max(1, int(len(candidates) * SERENDIPITY_RATIO)))
            candidates.extend(serendipity_candidates[:max_ser])

            # Sort all candidates by relevance
            candidates.sort(key=lambda c: c[3], reverse=True)

            for item, sub_code, domain_code, relevance, is_serendipity in candidates:
                cfg = SUBDOMAIN_CONFIG.get(sub_code, {})
                url = item.get("source_url") or ""

                # Build a descriptive reason
                source_label = {
                    "google_news": "Google News",
                    "reddit": "Reddit",
                    "youtube": "YouTube",
                    "hackernews": "Hacker News",
                    "rss": "RSS",
                }.get(item.get("source_type", ""), "Web")
                score_part = ""
                if item.get("score"):
                    if item.get("source_type") == "youtube":
                        score_part = f" ({item['score'] // 1000}k views)"
                    else:
                        score_part = f" ({item['score']} pts)"
                if is_serendipity:
                    reason = f"Discover: {cfg.get('label', sub_code)} via {source_label}{score_part}"
                else:
                    reason = f"{cfg.get('label', sub_code)} via {source_label}{score_part}"

                db.add(UserRecommendation(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    domain=domain_code,
                    subdomain=sub_code,
                    reason=reason,
                    batch_label=batch_label,
                    title=(item.get("title") or "")[:512],
                    summary=(item.get("summary") or "")[:4000],
                    source_url=url,
                    source_type=item.get("source_type", "web"),
                    score=int(relevance),
                    experiment=experiment,
                ))
                rec_count += 1
                if is_serendipity:
                    serendipity_count += 1
                if url:
                    existing_urls.add(url)

        db.commit()
        logger.info(
            f"[CRON] Created {rec_count} recommendations for {len(users)} users "
            f"({serendipity_count} serendipity, skipped {skipped_dup} dups, {skipped_dismissed} dismissed)"
        )
        return refreshed

    except Exception as exc:
        logger.error(f"[CRON] Error: {exc}", exc_info=True)
        db.rollback()
        return 0
    finally:
        db.close()


# Backward-compat alias — main.py scheduler calls generate_recommendations
generate_recommendations = refresh_cards
