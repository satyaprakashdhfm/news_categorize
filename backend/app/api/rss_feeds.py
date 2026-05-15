"""
RSS feed browse endpoints.
Returns parsed RSS items from curated sources, grouped by domain.
"""
from fastapi import APIRouter, Query, HTTPException
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rss", tags=["rss"])


@router.get("/domain/{domain_code}")
async def get_rss_for_domain(
    domain_code: str,
    limit_per_feed: int = Query(6, ge=1, le=20),
):
    """
    Fetch RSS items for a top-level domain (TEC, BUS, POL, ECO, OTH).
    Aggregates all curated feeds for that domain.
    """
    code = domain_code.upper()
    try:
        from app.services.rss_service import rss_service, RSS_FEEDS_BY_DOMAIN
        if code not in RSS_FEEDS_BY_DOMAIN:
            raise HTTPException(status_code=404, detail=f"No RSS feeds configured for domain '{code}'")
        items = await rss_service.fetch_for_domain(code, limit_per_feed=limit_per_feed)
        return {"domain": code, "items": items, "count": len(items)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[RSS API] domain {code} failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch RSS items")


@router.get("/feeds")
async def list_feeds():
    """Return the list of all configured RSS feeds grouped by domain."""
    from app.services.rss_service import RSS_FEEDS_BY_DOMAIN
    return {"feeds": RSS_FEEDS_BY_DOMAIN}
