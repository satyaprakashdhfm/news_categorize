import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.models.recommendation import UserRecommendation
from app.services.interests_config import (
    ALL_SUBDOMAINS,
    VALID_DOMAIN_CODES,
    VALID_SUBDOMAIN_CODES,
    DOMAIN_TO_SUBDOMAINS,
    resolve_to_subdomains,
)

logger = logging.getLogger(__name__)


def _get_batch_label() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    hour = datetime.now(ist).hour
    if hour < 10:
        return "morning"
    elif hour < 16:
        return "afternoon"
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
        logger.warning(f"[RECS] Reddit failed: {exc}")
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
        logger.warning(f"[RECS] YouTube failed: {exc}")
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
    """
    Search Google News + Reddit + YouTube + HN + RSS for a specific subdomain.
    Uses interests_config as the single source of truth.
    """
    cfg = ALL_SUBDOMAINS.get(sub_code)
    if not cfg:
        return []

    queries = cfg.get("queries", [])
    subreddits = cfg.get("subreddits", [])
    youtube_channels = cfg.get("youtube", [])
    hn_keywords = cfg.get("hn_queries", [])
    domain_code = cfg.get("domain", "OTH")

    tasks = []
    if queries:
        tasks.append(_search_google_news(queries[0]))
    tasks.append(_search_reddit(subreddits))
    if youtube_channels:
        tasks.append(_search_youtube(youtube_channels))
    if hn_keywords:
        tasks.append(_search_hackernews(hn_keywords))
    tasks.append(_fetch_rss(sub_code, domain_code))

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


def generate_recommendations() -> int:
    """
    Generate personalized recommendations for all users with interests.
    Supports both domain-level and subdomain-level interest codes.
    Uses interests_config as the canonical source.
    """
    db: Session = SessionLocal()
    batch_label = _get_batch_label()
    try:
        users = db.query(User).filter(User.interests.isnot(None)).all()
        users_with_interests = [u for u in users if u.interests]
        if not users_with_interests:
            logger.info("[RECS] No users with interests, skipping")
            return 0

        # Collect all unique subdomains needed across all users
        needed_subdomains: set[str] = set()
        for user in users_with_interests:
            resolved = resolve_to_subdomains(user.interests or [])
            needed_subdomains.update(resolved)

        logger.info(f"[RECS] Searching {len(needed_subdomains)} subdomains for {len(users_with_interests)} users")

        # Search once per subdomain, shared across users
        loop = asyncio.new_event_loop()
        subdomain_results: dict[str, list[dict]] = {}
        try:
            for sub_code in needed_subdomains:
                results = loop.run_until_complete(_search_for_subdomain(sub_code))
                cfg = ALL_SUBDOMAINS.get(sub_code, {})
                subdomain_results[sub_code] = results
                logger.info(f"[RECS] {sub_code} ({cfg.get('label', sub_code)}): {len(results)} items")
        finally:
            loop.close()

        cutoff = datetime.utcnow() - timedelta(hours=24)
        total_created = 0

        for user in users_with_interests:
            resolved_subs = resolve_to_subdomains(user.interests or [])

            # URLs already sent to this user in the last 24h
            recent_urls: set[str] = {
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

            new_recs: list[UserRecommendation] = []
            for sub_code in resolved_subs:
                cfg = ALL_SUBDOMAINS.get(sub_code, {})
                domain_code = cfg.get("domain", "OTH")
                items = subdomain_results.get(sub_code, [])
                count = 0

                for item in items:
                    if count >= 3:  # max 3 per subdomain per user per batch
                        break
                    url = item.get("source_url", "")
                    if url in recent_urls:
                        continue

                    source_label = {
                        "google_news": "Google News",
                        "reddit": "Reddit",
                        "youtube": "YouTube",
                        "hackernews": "Hacker News",
                        "rss": "RSS",
                    }.get(item.get("source_type", ""), "Web")

                    rec = UserRecommendation(
                        id=str(uuid.uuid4()),
                        user_id=user.id,
                        domain=domain_code,
                        subdomain=sub_code,
                        reason=f"{cfg.get('label', sub_code)} — via {source_label}",
                        batch_label=batch_label,
                        title=(item.get("title") or "")[:512],
                        summary=(item.get("summary") or "")[:4000],
                        source_url=url[:1024] if url else None,
                        source_type=item.get("source_type"),
                        score=int(item["score"]) if item.get("score") is not None else None,
                    )
                    new_recs.append(rec)
                    recent_urls.add(url)
                    count += 1

            if new_recs:
                db.add_all(new_recs)
                total_created += len(new_recs)

        db.commit()
        logger.info(
            f"[RECS] Generated {total_created} recommendations "
            f"for {len(users_with_interests)} users (batch={batch_label})"
        )
        return total_created

    except Exception as exc:
        logger.error(f"[RECS] Error: {exc}", exc_info=True)
        db.rollback()
        return 0
    finally:
        db.close()
