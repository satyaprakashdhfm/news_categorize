import uuid
import asyncio
import json
import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.feed_card import FeedCard, UserFeedCard
from app.models.browser_research_run import BrowserResearchRun, BrowserResearchItem

logger = logging.getLogger(__name__)

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

async def _search_google_news(query: str) -> list[dict]:
    try:
        from app.services.article_extractor_service import article_extractor_service
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        items = await article_extractor_service.search(
            country_code="USA", topic=query, date=today, max_results=3
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
            }
            for item in items if item.get("title")
        ]
    except Exception as exc:
        logger.warning(f"[RECS] RSS failed for {sub_code}: {exc}")
        return []


async def _search_for_subdomain(sub_code: str) -> list[dict]:
    cfg = SUBDOMAIN_CONFIG.get(sub_code)
    if not cfg:
        return []

    tasks = []
    if cfg.get("queries"):
        tasks.append(_search_google_news(cfg["queries"][0]))
    tasks.append(_search_reddit(cfg.get("subreddits", [])))
    tasks.append(_search_youtube(cfg.get("youtube", [])))

    results_batches = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set[str] = set()
    unique: list[dict] = []
    for batch in results_batches:
        if not isinstance(batch, list):
            continue
        for item in batch:
            url = item.get("source_url", "")
            if url and url not in seen:
                seen.add(url)
                unique.append(item)
    return unique


# ── DB helpers ────────────────────────────────────────────────────────────────

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

        if not cards_to_refresh:
            logger.info("[CRON] No cards to refresh")
            return 0

        logger.info(
            f"[CRON] Refreshing {len(admin_cards)} admin cards + "
            f"{len(user_cards)} user-pinned cards"
        )

        # Search all needed subdomains concurrently (once per subdomain, shared across cards)
        unique_subs = list({c.subdomain for c in cards_to_refresh})
        loop = asyncio.new_event_loop()
        try:
            raw = loop.run_until_complete(
                asyncio.gather(*[_search_for_subdomain(s) for s in unique_subs], return_exceptions=True)
            )
        finally:
            loop.close()

        sub_items: dict[str, list[dict]] = {
            sub: (res if isinstance(res, list) else [])
            for sub, res in zip(unique_subs, raw)
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
        return refreshed

    except Exception as exc:
        logger.error(f"[CRON] Error: {exc}", exc_info=True)
        db.rollback()
        return 0
    finally:
        db.close()


# Backward-compat alias — main.py scheduler calls generate_recommendations
generate_recommendations = refresh_cards
