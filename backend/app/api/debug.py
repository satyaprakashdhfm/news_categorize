from __future__ import annotations

import time
import aiohttp
from fastapi import APIRouter

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.post("/test-reddit")
async def test_reddit(body: dict):
    """Test Reddit connectivity through an optional proxy."""
    proxy_url: str | None = (body.get("proxy_url") or "").strip() or None
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
