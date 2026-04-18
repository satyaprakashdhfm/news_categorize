from __future__ import annotations

import re
import time
import aiohttp
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/proxy-config")
async def get_proxy_config():
    """Return proxy URL with password masked for display."""
    raw = settings.REDDIT_PROXY_URL or ""
    masked = re.sub(r"(:)([^@]+)(@)", r"\1****\3", raw) if raw else ""
    return {"configured": bool(raw), "masked_url": masked}


@router.post("/test-reddit")
async def test_reddit(body: dict):
    """Test Reddit connectivity. Uses configured proxy from settings when use_configured_proxy=True."""
    use_configured = body.get("use_configured_proxy", False)
    proxy_url: str | None = (settings.REDDIT_PROXY_URL or None) if use_configured else None
    subreddit: str = (body.get("subreddit") or "technology").strip().lstrip("r/")
    url = f"https://www.reddit.com/r/{subreddit}/top.json"
    headers = {"User-Agent": "CurioDebugTester/1.0"}

    start = time.monotonic()
    try:
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(
                url,
                params={"limit": "3", "t": "day"},
                timeout=15,
                proxy=proxy_url,
            ) as resp:
                elapsed_ms = round((time.monotonic() - start) * 1000)
                if resp.status != 200:
                    return {
                        "ok": False,
                        "status": resp.status,
                        "elapsed_ms": elapsed_ms,
                        "error": f"Reddit returned HTTP {resp.status}",
                        "posts": [],
                    }
                data = await resp.json()
                children = (((data or {}).get("data") or {}).get("children") or [])
                posts = [
                    {
                        "title": (c.get("data") or {}).get("title", ""),
                        "score": (c.get("data") or {}).get("score", 0),
                    }
                    for c in children[:3]
                ]
                return {
                    "ok": True,
                    "status": resp.status,
                    "elapsed_ms": elapsed_ms,
                    "error": None,
                    "posts": posts,
                }
    except Exception as exc:
        elapsed_ms = round((time.monotonic() - start) * 1000)
        return {
            "ok": False,
            "status": None,
            "elapsed_ms": elapsed_ms,
            "error": str(exc),
            "posts": [],
        }
