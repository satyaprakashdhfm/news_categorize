import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.models.recommendation import UserRecommendation

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
DOMAIN_SUBDOMAINS = {}
for sub_code, sub_cfg in SUBDOMAIN_CONFIG.items():
    dom = sub_cfg["domain"]
    DOMAIN_SUBDOMAINS.setdefault(dom, []).append(sub_code)


def _get_batch_label() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    hour = datetime.now(ist).hour
    if hour < 10:
        return "morning"
    elif hour < 16:
        return "afternoon"
    else:
        return "evening"


async def _search_google_news(query: str) -> list[dict]:
    try:
        from app.services.article_extractor_service import article_extractor_service
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
        logger.warning(f"[RECS] Google News failed: {exc}")
        return []


async def _search_reddit(subreddits: list[str]) -> list[dict]:
    if not subreddits:
        return []
    try:
        from app.services.reddit_scraping_service import reddit_scraping_service
        community_results = await reddit_scraping_service.scrape_communities(
            communities=subreddits[:2],
            mode="hot",
            posts_per_community=2,
            summarize=False,
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
        logger.warning(f"[RECS] Reddit failed: {exc}")
        return []


async def _search_youtube(channels: list[str]) -> list[dict]:
    if not channels:
        return []
    try:
        from app.services.youtube_scraping_service import youtube_scraping_service
        channel_results = await youtube_scraping_service.scrape_channels(
            channels=channels[:1],
            videos_per_channel=2,
            summarize=False,
        )
        results = []
        for channel in channel_results:
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
        logger.warning(f"[RECS] YouTube failed: {exc}")
        return []


async def _search_for_subdomain(sub_code: str) -> list[dict]:
    """Search Google News + Reddit + YouTube for a specific subdomain."""
    cfg = SUBDOMAIN_CONFIG.get(sub_code)
    if not cfg:
        return []

    queries = cfg.get("queries", [])
    subreddits = cfg.get("subreddits", [])
    youtube_channels = cfg.get("youtube", [])

    tasks = []
    # Google News — use first query
    if queries:
        tasks.append(_search_google_news(queries[0]))
    # Reddit
    tasks.append(_search_reddit(subreddits))
    # YouTube
    tasks.append(_search_youtube(youtube_channels))

    results_batches = await asyncio.gather(*tasks, return_exceptions=True)

    all_results = []
    for batch in results_batches:
        if isinstance(batch, list):
            all_results.extend(batch)

    # Deduplicate by URL
    seen = set()
    unique = []
    for item in all_results:
        url = item.get("source_url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(item)
    return unique


def generate_recommendations():
    """Generate personalized recommendations by searching at subdomain level."""
    db: Session = SessionLocal()
    batch_label = _get_batch_label()
    try:
        users = db.query(User).filter(User.interests.isnot(None)).all()
        users_with_interests = [u for u in users if u.interests]
        if not users_with_interests:
            logger.info("[RECS] No users with interests, skipping")
            return 0

        # Collect all unique subdomains needed across all users
        needed_subdomains = set()
        for user in users_with_interests:
            for domain in (user.interests or []):
                for sub in DOMAIN_SUBDOMAINS.get(domain, []):
                    needed_subdomains.add(sub)

        logger.info(f"[RECS] Searching {len(needed_subdomains)} subdomains for {len(users_with_interests)} users")

        # Search once per subdomain (shared across users with same interests)
        loop = asyncio.new_event_loop()
        subdomain_results = {}
        try:
            for sub_code in needed_subdomains:
                cfg = SUBDOMAIN_CONFIG.get(sub_code, {})
                results = loop.run_until_complete(_search_for_subdomain(sub_code))
                subdomain_results[sub_code] = results
                logger.info(f"[RECS] {sub_code} ({cfg.get('label', sub_code)}): {len(results)} items")
        finally:
            loop.close()

        # 24h cutoff for duplicate checking
        cutoff = datetime.utcnow() - timedelta(hours=24)

        total_created = 0
        for user in users_with_interests:
            interests = user.interests or []

            # Get URLs already recommended to this user in last 24h
            recent_urls = {
                r.source_url
                for r in db.query(UserRecommendation.source_url)
                .filter(
                    UserRecommendation.user_id == user.id,
                    UserRecommendation.created_at >= cutoff,
                    UserRecommendation.source_url.isnot(None),
                )
                .all()
                if r.source_url
            }

            new_recs = []
            for domain in interests:
                subdomains = DOMAIN_SUBDOMAINS.get(domain, [])
                for sub_code in subdomains:
                    cfg = SUBDOMAIN_CONFIG.get(sub_code, {})
                    items = subdomain_results.get(sub_code, [])
                    count = 0
                    for item in items:
                        if count >= 3:  # max 3 per subdomain per user
                            break
                        url = item.get("source_url", "")
                        if url in recent_urls:
                            continue

                        source_label = {
                            "google_news": "Google News",
                            "reddit": "Reddit",
                            "youtube": "YouTube",
                        }.get(item.get("source_type", ""), "Web")

                        rec = UserRecommendation(
                            id=str(uuid.uuid4()),
                            user_id=user.id,
                            domain=domain,
                            subdomain=sub_code,
                            reason=f"{cfg.get('label', sub_code)} — via {source_label}",
                            batch_label=batch_label,
                            title=item.get("title", "")[:512],
                            summary=(item.get("summary") or "")[:4000],
                            source_url=url[:1024] if url else None,
                            source_type=item.get("source_type"),
                            score=item.get("score"),
                        )
                        new_recs.append(rec)
                        recent_urls.add(url)
                        count += 1

            if new_recs:
                db.add_all(new_recs)
                total_created += len(new_recs)

        db.commit()
        logger.info(f"[RECS] Generated {total_created} recommendations for {len(users_with_interests)} users (batch={batch_label})")
        return total_created
    except Exception as exc:
        logger.error(f"[RECS] Error: {exc}", exc_info=True)
        db.rollback()
        return 0
    finally:
        db.close()
