"""
Hacker News browse endpoints.
Returns top/best/new stories from the public HN API.
"""
from fastapi import APIRouter, Query, HTTPException
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/hackernews", tags=["hackernews"])


@router.get("/top")
async def get_top_stories(limit: int = Query(30, ge=1, le=100)):
    """Fetch top stories from Hacker News."""
    try:
        from app.services.hackernews_service import hackernews_service
        stories = await hackernews_service.fetch_top(limit=limit)
        return {"stories": stories, "count": len(stories), "feed": "top"}
    except Exception as exc:
        logger.error(f"[HN API] top stories failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch HN stories")


@router.get("/best")
async def get_best_stories(limit: int = Query(30, ge=1, le=100)):
    """Fetch best-ranked stories from Hacker News."""
    try:
        from app.services.hackernews_service import hackernews_service
        stories = await hackernews_service.fetch_best(limit=limit)
        return {"stories": stories, "count": len(stories), "feed": "best"}
    except Exception as exc:
        logger.error(f"[HN API] best stories failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch HN stories")


@router.get("/new")
async def get_new_stories(limit: int = Query(30, ge=1, le=100)):
    """Fetch newest stories from Hacker News."""
    try:
        from app.services.hackernews_service import hackernews_service
        stories = await hackernews_service.fetch_new(limit=limit)
        return {"stories": stories, "count": len(stories), "feed": "new"}
    except Exception as exc:
        logger.error(f"[HN API] new stories failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch HN stories")
