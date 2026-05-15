"""
RSS Feed Intelligence Service
Fetches and parses RSS/Atom feeds from curated sources.
feedparser is already in requirements.txt.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

_TIMEOUT = aiohttp.ClientTimeout(total=20)

# ── Curated feed list grouped by domain ────────────────────────────────────
RSS_FEEDS_BY_DOMAIN: dict[str, list[dict]] = {
    "TEC": [
        {"name": "Hacker News",    "url": "https://news.ycombinator.com/rss"},
        {"name": "TechCrunch",     "url": "https://techcrunch.com/feed/"},
        {"name": "Wired",          "url": "https://www.wired.com/feed/rss"},
        {"name": "Ars Technica",   "url": "https://feeds.arstechnica.com/arstechnica/index"},
        {"name": "The Verge",      "url": "https://www.theverge.com/rss/index.xml"},
    ],
    "BUS": [
        {"name": "TechCrunch Startups", "url": "https://techcrunch.com/category/startups/feed/"},
        {"name": "TechCrunch Venture",  "url": "https://techcrunch.com/category/venture/feed/"},
    ],
    "POL": [
        {"name": "BBC World News", "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
    ],
    "ECO": [
        {"name": "BBC Business",   "url": "https://feeds.bbci.co.uk/news/business/rss.xml"},
    ],
    "OTH": [
        {"name": "BBC Science",    "url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"},
    ],
}

# Domain cards for each subdomain (used when fetching by subdomain)
SUBDOMAIN_TO_DOMAIN_FEEDS: dict[str, list[dict]] = {
    "SAI": RSS_FEEDS_BY_DOMAIN["TEC"],
    "LLM": RSS_FEEDS_BY_DOMAIN["TEC"][:3],
    "AGT": RSS_FEEDS_BY_DOMAIN["TEC"][:3],
    "WEB": RSS_FEEDS_BY_DOMAIN["TEC"],
    "MOB": RSS_FEEDS_BY_DOMAIN["TEC"][-2:],
    "CLD": RSS_FEEDS_BY_DOMAIN["TEC"][-2:],
    "SEC": RSS_FEEDS_BY_DOMAIN["TEC"][-2:],
    "DAT": RSS_FEEDS_BY_DOMAIN["TEC"][:2],
    "OSS": RSS_FEEDS_BY_DOMAIN["TEC"][:2],
    "ROB": RSS_FEEDS_BY_DOMAIN["TEC"][:2],
    "HRD": RSS_FEEDS_BY_DOMAIN["TEC"][-2:],
    "SPC": RSS_FEEDS_BY_DOMAIN["OTH"],
    "PHY": RSS_FEEDS_BY_DOMAIN["OTH"],
    "BIO": RSS_FEEDS_BY_DOMAIN["OTH"],
    "DEF": RSS_FEEDS_BY_DOMAIN["POL"],
    "NMI": RSS_FEEDS_BY_DOMAIN["OTH"],
    "BLK": RSS_FEEDS_BY_DOMAIN["BUS"],
    "SCA": RSS_FEEDS_BY_DOMAIN["BUS"],
    "MID": RSS_FEEDS_BY_DOMAIN["BUS"],
    "FIN": RSS_FEEDS_BY_DOMAIN["BUS"],
    "INV": RSS_FEEDS_BY_DOMAIN["BUS"],
    "MON": RSS_FEEDS_BY_DOMAIN["ECO"],
    "TRD": RSS_FEEDS_BY_DOMAIN["ECO"],
    "GEO": RSS_FEEDS_BY_DOMAIN["POL"],
    "EXE": RSS_FEEDS_BY_DOMAIN["POL"],
    "LEG": RSS_FEEDS_BY_DOMAIN["POL"],
    "JUD": RSS_FEEDS_BY_DOMAIN["POL"],
    "DIP": RSS_FEEDS_BY_DOMAIN["POL"],
    "MAC": RSS_FEEDS_BY_DOMAIN["ECO"],
    "MIC": RSS_FEEDS_BY_DOMAIN["ECO"],
    "ENE": RSS_FEEDS_BY_DOMAIN["ECO"],
    "CLM": RSS_FEEDS_BY_DOMAIN["OTH"],
    "SCI": RSS_FEEDS_BY_DOMAIN["OTH"],
    "HEA": RSS_FEEDS_BY_DOMAIN["OTH"],
    "EDU": RSS_FEEDS_BY_DOMAIN["OTH"],
    "GAM": RSS_FEEDS_BY_DOMAIN["TEC"][-2:],
}

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    return _TAG_RE.sub("", text or "").strip()


def _parse_date(entry) -> Optional[str]:
    if entry.get("published"):
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(entry.published).isoformat()
        except Exception:
            pass
    if entry.get("updated"):
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(entry.updated).isoformat()
        except Exception:
            pass
    return None


class RssService:
    async def fetch_feed(self, feed_url: str, source_name: str, limit: int = 8) -> list[dict]:
        try:
            import feedparser
        except ImportError:
            logger.warning("[RSS] feedparser not installed. Run: pip install feedparser")
            return []

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    feed_url,
                    timeout=_TIMEOUT,
                    headers={"User-Agent": "Curio/2.0 (RSS Reader; +https://github.com/curio)"},
                ) as resp:
                    content = await resp.text()
        except Exception as exc:
            logger.warning(f"[RSS] fetch failed {feed_url}: {exc}")
            return []

        try:
            feed = feedparser.parse(content)
        except Exception as exc:
            logger.warning(f"[RSS] parse failed {feed_url}: {exc}")
            return []

        items = []
        for entry in feed.entries[:limit]:
            url = (entry.get("link") or "").strip()
            title = _strip_html(entry.get("title") or "").strip()
            if not title or not url:
                continue

            summary = _strip_html(entry.get("summary") or entry.get("description") or "")[:1200]
            item_id = hashlib.md5(url.encode()).hexdigest()

            items.append({
                "id": item_id,
                "title": title,
                "url": url,
                "summary": summary,
                "source_name": source_name,
                "feed_url": feed_url,
                "published_at": _parse_date(entry),
                "source_type": "rss",
            })
        return items

    async def fetch_for_domain(self, domain: str, limit_per_feed: int = 5) -> list[dict]:
        feeds = RSS_FEEDS_BY_DOMAIN.get(domain, [])
        tasks = [self.fetch_feed(f["url"], f["name"], limit_per_feed) for f in feeds]
        batches = await asyncio.gather(*tasks, return_exceptions=True)

        seen: set[str] = set()
        all_items: list[dict] = []
        for batch in batches:
            if not isinstance(batch, list):
                continue
            for item in batch:
                if item["url"] not in seen:
                    seen.add(item["url"])
                    all_items.append(item)
        return all_items

    async def fetch_for_subdomain(self, sub_code: str, limit_per_feed: int = 4) -> list[dict]:
        feeds = SUBDOMAIN_TO_DOMAIN_FEEDS.get(sub_code, [])
        if not feeds:
            return []
        tasks = [self.fetch_feed(f["url"], f["name"], limit_per_feed) for f in feeds[:2]]
        batches = await asyncio.gather(*tasks, return_exceptions=True)

        seen: set[str] = set()
        items: list[dict] = []
        for batch in batches:
            if isinstance(batch, list):
                for item in batch:
                    if item["url"] not in seen:
                        seen.add(item["url"])
                        items.append(item)
        return items


rss_service = RssService()
