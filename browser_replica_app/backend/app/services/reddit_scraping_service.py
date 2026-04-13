from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import aiohttp

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedditScrapingService:
    def __init__(self) -> None:
        self._client = None
        self._init_summary_client()

    def _init_summary_client(self) -> None:
        try:
            from google import genai

            self._client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        except Exception as exc:
            self._client = None
            logger.warning(f"[REDDIT] Summary client unavailable: {exc}")

    @staticmethod
    def _normalize_subreddit(name: str) -> str:
        value = (name or "").strip()
        if value.startswith("r/"):
            value = value[2:]
        return value.strip("/")

    @staticmethod
    def _mode_to_path(mode: str) -> tuple[str, dict[str, str]]:
        m = (mode or "top_today").lower()
        if m == "new":
            return "new", {}
        if m == "hot":
            return "hot", {}
        return "top", {"t": "day"}

    @staticmethod
    def _fallback_summary(title: str, selftext: str | None) -> str:
        content = (selftext or "").strip().replace("\n", " ")
        if content:
            return content[:220]
        return f"Reddit post about: {title}"[:220]

    def _summarize_post(self, title: str, selftext: str | None) -> str:
        if not self._client:
            return self._fallback_summary(title, selftext)

        prompt = (
            "Summarize this reddit post in simple normal style in 2 sentences.\n\n"
            f"Title: {title}\n"
            f"Body: {selftext or ''}"
        )
        try:
            response = self._client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt,
            )
            text = (response.text or "").strip()
            return text or self._fallback_summary(title, selftext)
        except Exception:
            return self._fallback_summary(title, selftext)

    async def _fetch_subreddit_posts(
        self,
        session: aiohttp.ClientSession,
        subreddit: str,
        mode: str,
        limit: int,
        summarize: bool,
    ) -> dict[str, Any]:
        path, extra = self._mode_to_path(mode)
        url = f"https://www.reddit.com/r/{subreddit}/{path}.json"
        params = {"limit": str(limit), **extra}

        try:
            async with session.get(url, params=params, timeout=25) as resp:
                if resp.status != 200:
                    logger.warning(f"[REDDIT] {subreddit} fetch failed: {resp.status}")
                    return {"community": subreddit, "mode": mode, "posts": []}
                payload = await resp.json()
        except Exception as exc:
            logger.warning(f"[REDDIT] {subreddit} fetch error: {exc}")
            return {"community": subreddit, "mode": mode, "posts": []}

        children = ((payload or {}).get("data") or {}).get("children") or []
        posts: list[dict[str, Any]] = []

        for node in children[:limit]:
            data = node.get("data") or {}
            post_url = data.get("url") or ""
            created = data.get("created_utc")
            published_at = None
            if created:
                published_at = datetime.fromtimestamp(float(created), tz=timezone.utc).isoformat()

            title = (data.get("title") or "Untitled").strip()
            selftext = data.get("selftext") or None
            if summarize:
                summary = await asyncio.to_thread(self._summarize_post, title, selftext)
            else:
                summary = self._fallback_summary(title, selftext)

            posts.append(
                {
                    "post_id": data.get("id"),
                    "subreddit": subreddit,
                    "title": title,
                    "post_url": post_url,
                    "selftext": selftext,
                    "summary": summary,
                    "author": data.get("author"),
                    "score": int(data.get("score") or 0),
                    "num_comments": int(data.get("num_comments") or 0),
                    "published_at": published_at,
                }
            )

        return {"community": subreddit, "mode": mode, "posts": posts}

    async def scrape_communities(
        self,
        communities: list[str],
        mode: str = "top_today",
        posts_per_community: int = 10,
        summarize: bool = True,
    ) -> list[dict[str, Any]]:
        cleaned = [self._normalize_subreddit(c) for c in communities if self._normalize_subreddit(c)]
        if not cleaned:
            return []

        headers = {
            "User-Agent": "CurioRedditCustomScraper/1.0",
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            tasks = [
                self._fetch_subreddit_posts(session, subreddit, mode, posts_per_community, summarize)
                for subreddit in cleaned
            ]
            results = await asyncio.gather(*tasks)

        return results


reddit_scraping_service = RedditScrapingService()
