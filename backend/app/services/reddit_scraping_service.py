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
            return content[:1200]
        return f"Reddit post about: {title}"[:400]

    @staticmethod
    def _word_count(text: str | None) -> int:
        if not text:
            return 0
        return len([w for w in text.strip().split() if w])

    @staticmethod
    def _collect_comment_lines(comment_listing: list[dict[str, Any]] | None, max_items: int = 20) -> list[str]:
        if not comment_listing:
            return []

        comments = (((comment_listing[1] or {}).get("data") or {}).get("children") or [])
        lines: list[str] = []

        def walk(nodes: list[dict[str, Any]]) -> None:
            for node in nodes:
                if len(lines) >= max_items:
                    return
                data = (node or {}).get("data") or {}
                body = (data.get("body") or "").strip()
                if body:
                    author = data.get("author") or "user"
                    score = int(data.get("score") or 0)
                    lines.append(f"- ({score}) {author}: {body[:320]}")

                replies = (((data.get("replies") or {}).get("data") or {}).get("children") or [])
                if replies and len(lines) < max_items:
                    walk(replies)

        walk(comments)
        return lines[:max_items]

    @staticmethod
    def _extract_response_text(response) -> str:
        texts: list[str] = []
        for candidate in (getattr(response, "candidates", None) or []):
            content = getattr(candidate, "content", None)
            for part in (getattr(content, "parts", None) or []):
                value = getattr(part, "text", None)
                if isinstance(value, str) and value.strip():
                    texts.append(value.strip())
        return "\n".join(texts).strip()

    def _summarize_post(self, title: str, selftext: str | None, comment_lines: list[str] | None = None) -> str:
        if not self._client:
            return self._fallback_summary(title, selftext)

        comments_block = "\n".join(comment_lines or [])
        prompt = (
            "Create a complete, high-accuracy Reddit discussion brief in 12 to 18 sentences. "
            "Minimum length: 240 words. "
            "Use only provided content. Do not invent facts. Cover: what the original post says, what people agree on, "
            "what people disagree on, key questions raised by commenters, and practical insights. "
            "Write in clear plain English as one readable block.\n\n"
            f"Title: {title}\n"
            f"Post Body: {selftext or ''}\n\n"
            f"Top Comments and Questions:\n{comments_block or '- no comments captured'}"
        )
        try:
            response = self._client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            text = self._extract_response_text(response)

            if self._word_count(text) < 200:
                expand_prompt = (
                    "Expand and deepen this Reddit analysis to at least 260 words. "
                    "Preserve factual accuracy, include discussion viewpoints and concrete insights, "
                    "and avoid repetition. Use only the source content below.\n\n"
                    f"Source details:\n{prompt}\n\n"
                    f"Draft summary:\n{text}"
                )
                expand_response = self._client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=expand_prompt,
                )
                expanded_text = self._extract_response_text(expand_response)
                if expanded_text:
                    text = expanded_text

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

        _proxy = settings.REDDIT_PROXY_URL or None
        try:
            async with session.get(url, params=params, timeout=25, proxy=_proxy) as resp:
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
            permalink = data.get("permalink") or ""
            created = data.get("created_utc")
            published_at = None
            if created:
                published_at = datetime.fromtimestamp(float(created), tz=timezone.utc).isoformat()

            title = (data.get("title") or "Untitled").strip()
            selftext = data.get("selftext") or None
            comment_lines: list[str] = []

            if permalink:
                comments_url = f"https://www.reddit.com{permalink}.json"
                try:
                    async with session.get(comments_url, params={"limit": "25", "sort": "top"}, timeout=25, proxy=_proxy) as c_resp:
                        if c_resp.status == 200:
                            comment_payload = await c_resp.json()
                            comment_lines = self._collect_comment_lines(comment_payload, max_items=35)
                except Exception:
                    comment_lines = []

            if summarize:
                summary = await asyncio.to_thread(self._summarize_post, title, selftext, comment_lines)
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
