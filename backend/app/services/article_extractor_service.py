from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class ArticleExtractorService:
    """Extract full article text using local newspaper4k package."""

    def __init__(self) -> None:
        self._is_newspaper_available = False
        self._init_newspaper_import()

    def _init_newspaper_import(self) -> None:
        """Ensure local newspaper package is importable at runtime."""
        project_root = Path(__file__).resolve().parents[2]
        newspaper_root = project_root / "news scrapping"

        if str(newspaper_root) not in sys.path:
            sys.path.insert(0, str(newspaper_root))

        try:
            import newspaper  # noqa: F401

            self._is_newspaper_available = True
            logger.info("[EXTRACTOR] newspaper4k integration is active")
        except Exception as exc:
            self._is_newspaper_available = False
            logger.warning(f"[EXTRACTOR] newspaper4k unavailable: {exc}")

    async def search(self, country_code: str, topic: str, date: str, max_results: int = 5) -> list[dict]:
        """Discover article URLs using newspaper4k Google News source."""
        if not self._is_newspaper_available:
            return []

        return await asyncio.to_thread(self._search_sync, country_code, topic, date, max_results)

    def _search_sync(self, country_code: str, topic: str, date: str, max_results: int) -> list[dict]:
        try:
            from newspaper.google_news import GoogleNewsSource

            country_name = self._country_name(country_code)
            keyword = f"{country_name} {topic} {date} news".strip()
            source = GoogleNewsSource(
                country=self._country_to_gnews(country_code),
                language="en",
                period="7d",
                max_results=max_results,
            )
            source.build(top_news=False, keyword=keyword)

            items: list[dict] = []
            seen_urls: set[str] = set()
            for article in source.articles[:max_results]:
                url = (article.url or "").strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                items.append(
                    {
                        "title": (article.title or "").strip(),
                        "content": (article.summary or "").strip(),
                        "url": url,
                        "published_date": datetime.now().isoformat(),
                    }
                )

            return items
        except Exception as exc:
            logger.warning(f"[EXTRACTOR] Discovery failed for {country_code}/{topic}: {exc}")
            return []

    async def extract(self, url: str, fallback_title: str = "") -> dict:
        """Extract title/content/image/date from URL with graceful fallback."""
        if not self._is_newspaper_available:
            return {
                "title": fallback_title,
                "content": None,
                "image_url": None,
                "published_at": None,
            }

        return await asyncio.to_thread(self._extract_sync, url, fallback_title)

    def _extract_sync(self, url: str, fallback_title: str) -> dict:
        try:
            import newspaper

            article = newspaper.article(url, language="en")

            title = (article.title or "").strip() or fallback_title
            content = (article.text or "").strip() or None
            image_url = (article.top_image or "").strip() or None

            published_at: Optional[datetime] = None
            if getattr(article, "publish_date", None):
                published_at = article.publish_date

            return {
                "title": title,
                "content": content,
                "image_url": image_url,
                "published_at": published_at,
            }
        except Exception as exc:
            logger.debug(f"[EXTRACTOR] Extraction failed for {url}: {exc}")
            return {
                "title": fallback_title,
                "content": None,
                "image_url": None,
                "published_at": None,
            }

    @staticmethod
    def _country_to_gnews(country_code: str) -> str:
        mapping = {
            "USA": "US",
            "CHINA": "CN",
            "GERMANY": "DE",
            "INDIA": "IN",
            "JAPAN": "JP",
            "UK": "GB",
            "FRANCE": "FR",
            "ITALY": "IT",
        }
        return mapping.get((country_code or "").upper(), "US")

    @staticmethod
    def _country_name(country_code: str) -> str:
        mapping = {
            "USA": "United States",
            "CHINA": "China",
            "GERMANY": "Germany",
            "INDIA": "India",
            "JAPAN": "Japan",
            "UK": "United Kingdom",
            "FRANCE": "France",
            "ITALY": "Italy",
        }
        return mapping.get((country_code or "").upper(), country_code)


article_extractor_service = ArticleExtractorService()
