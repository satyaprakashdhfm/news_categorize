"""
Hacker News Intelligence Service
Fetches top/best stories from the HN Firebase API.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

HN_BASE = "https://hacker-news.firebaseio.com/v0"
_TIMEOUT = aiohttp.ClientTimeout(total=20)


class HackerNewsService:
    async def _fetch_json(self, session: aiohttp.ClientSession, url: str):
        try:
            async with session.get(url, timeout=_TIMEOUT) as resp:
                return await resp.json(content_type=None)
        except Exception as exc:
            logger.debug(f"[HN] request failed {url}: {exc}")
            return None

    async def _fetch_item(self, session: aiohttp.ClientSession, item_id: int) -> Optional[dict]:
        data = await self._fetch_json(session, f"{HN_BASE}/item/{item_id}.json")
        if not data:
            return None
        if data.get("type") != "story" or data.get("dead") or data.get("deleted"):
            return None
        title = (data.get("title") or "").strip()
        if not title:
            return None

        url = data.get("url") or f"https://news.ycombinator.com/item?id={data.get('id')}"
        hn_url = f"https://news.ycombinator.com/item?id={data.get('id')}"
        ts = data.get("time", 0)
        published_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None

        return {
            "id": data.get("id"),
            "title": title,
            "url": url,
            "hn_url": hn_url,
            "score": data.get("score", 0),
            "by": data.get("by", ""),
            "published_at": published_at,
            "comments": data.get("descendants", 0),
            "source_type": "hackernews",
            "source_name": "Hacker News",
        }

    async def _fetch_story_list(self, endpoint: str, limit: int) -> list[dict]:
        async with aiohttp.ClientSession() as session:
            ids_data = await self._fetch_json(session, f"{HN_BASE}/{endpoint}.json")
            if not isinstance(ids_data, list):
                return []
            ids = ids_data[:min(limit * 2, 100)]  # fetch extra to cover dead/deleted

            tasks = [self._fetch_item(session, item_id) for item_id in ids]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        items = [r for r in results if isinstance(r, dict)]
        return items[:limit]

    async def fetch_top(self, limit: int = 30) -> list[dict]:
        """Top stories on HN right now."""
        return await self._fetch_story_list("topstories", limit)

    async def fetch_best(self, limit: int = 30) -> list[dict]:
        """Best-rated stories on HN."""
        return await self._fetch_story_list("beststories", limit)

    async def fetch_new(self, limit: int = 30) -> list[dict]:
        """Newest stories on HN."""
        return await self._fetch_story_list("newstories", limit)

    async def search_by_keywords(self, keywords: list[str], stories: list[dict]) -> list[dict]:
        """Filter a pre-fetched story list by keyword relevance (title match)."""
        if not keywords:
            return stories
        lower_kw = [k.lower() for k in keywords]
        matched = []
        for story in stories:
            title_lower = story.get("title", "").lower()
            if any(kw in title_lower for kw in lower_kw):
                matched.append(story)
        return matched


hackernews_service = HackerNewsService()
