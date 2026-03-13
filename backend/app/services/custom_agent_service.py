from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from app.services.article_extractor_service import article_extractor_service


STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "about",
    "that",
    "this",
    "into",
    "like",
    "want",
    "news",
    "based",
    "research",
    "related",
    "latest",
    "update",
    "updates",
    "over",
    "under",
    "between",
    "all",
    "top",
    "you",
    "your",
    "are",
    "was",
    "were",
    "have",
    "has",
    "had",
    "will",
    "shall",
    "would",
    "can",
    "could",
    "should",
    "get",
    "give",
    "take",
    "make",
    "more",
    "less",
    "very",
    "just",
    "most",
    "buzzing",
    "right",
    "now",
    "today",
    "usa",
    "us",
}

SPECIAL_SHORT_KEYWORDS = {"ai", "ml", "llm"}
HIGH_INTENT_KEYWORDS = {"ai", "github", "repo", "repos", "open", "source", "opensource"}


def build_title_from_prompt(prompt: str) -> str:
    words = [w for w in "".join(c if c.isalnum() or c.isspace() else " " for c in prompt).split() if w]
    head = " ".join(words[:7]).strip()
    if not head:
        return "Custom Agent"
    if len(head) > 48:
        return f"{head[:45]}..."
    return head


def extract_keywords(prompt: str) -> list[str]:
    cleaned = "".join(c.lower() if c.isalnum() or c.isspace() else " " for c in (prompt or ""))
    words = [
        w
        for w in cleaned.split()
        if ((len(w) >= 3) or (w in SPECIAL_SHORT_KEYWORDS)) and w not in STOP_WORDS
    ]
    return words[:25]


def _extract_phrases(prompt: str) -> list[str]:
    text = " ".join((prompt or "").lower().split())
    phrases: list[str] = []
    if "open source" in text:
        phrases.append("open source")
    if "github repos" in text:
        phrases.append("github repos")
    if "github repo" in text:
        phrases.append("github repo")
    return phrases


def score_text(title: str, summary: str, content: str, keywords: list[str], phrases: list[str]) -> int:
    if not keywords:
        return 0
    title_text = (title or "").lower()
    haystack = f"{title or ''} {summary or ''} {content or ''}".lower()

    score = 0
    for kw in keywords:
        if kw in title_text:
            score += 3
        elif kw in haystack:
            score += 1

    for phrase in phrases:
        if phrase in title_text:
            score += 5
        elif phrase in haystack:
            score += 3

    return score


def _to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _build_query_topics(prompt: str, keywords: list[str]) -> list[str]:
    topics: list[str] = []

    base_prompt = (prompt or "").strip()
    if base_prompt:
        topics.append(base_prompt)

    if keywords:
        topics.append(" ".join(keywords[:6]))

    # Include one high-intent variant to improve precision for specific prompts.
    focused = [k for k in keywords if k in HIGH_INTENT_KEYWORDS]
    if focused:
        topics.append(" ".join(focused[:4]))

    # Deduplicate while preserving order.
    seen: set[str] = set()
    deduped: list[str] = []
    for topic in topics:
        key = topic.lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(topic)
    return deduped[:3]


async def search_prompt_articles(
    prompt: str,
    country: str = "USA",
    date: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Search and rank fresh articles for a prompt. Default returns up to 20 articles."""
    safe_limit = max(1, min(limit, 50))
    query_date = date or datetime.now().strftime("%Y-%m-%d")
    keywords = extract_keywords(prompt)
    phrases = _extract_phrases(prompt)
    topics = _build_query_topics(prompt, keywords)

    # Pull candidates from multiple prompt variants for broader coverage.
    searches = [
        article_extractor_service.search(
            country_code=(country or "USA").upper(),
            topic=topic,
            date=query_date,
            max_results=safe_limit,
        )
        for topic in topics
    ]
    batches = await asyncio.gather(*searches)
    raw_results = [item for batch in batches for item in (batch or [])]

    # Deduplicate URLs while preserving order.
    deduped: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in raw_results:
        url = (item.get("url") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        deduped.append(item)

    semaphore = asyncio.Semaphore(5)

    async def enrich(item: dict[str, Any]) -> dict[str, Any]:
        async with semaphore:
            title = (item.get("title") or "").strip()
            summary = (item.get("content") or "").strip()
            url = (item.get("url") or "").strip()
            extracted = await article_extractor_service.extract(url=url, fallback_title=title)
            final_title = (extracted.get("title") or title or "Untitled").strip()
            final_content = extracted.get("content") or None
            final_summary = summary or (final_content[:300] if final_content else None)
            score = score_text(final_title, final_summary or "", final_content or "", keywords, phrases)
            return {
                "title": final_title,
                "url": url,
                "summary": final_summary,
                "content": final_content,
                "image_url": extracted.get("image_url") or None,
                "published_at": _to_iso(extracted.get("published_at") or item.get("published_date")),
                "score": score,
            }

    enriched = await asyncio.gather(*[enrich(item) for item in deduped])
    ranked = sorted(enriched, key=lambda x: x.get("score", 0), reverse=True)

    # Keep results relevant to the prompt intent before trimming.
    focused_terms = [k for k in keywords if k in HIGH_INTENT_KEYWORDS]
    if focused_terms:
        filtered = [
            row
            for row in ranked
            if any(term in f"{row.get('title','')} {row.get('summary','')}".lower() for term in focused_terms)
        ]
    else:
        filtered = [row for row in ranked if row.get("score", 0) >= 2]

    if len(filtered) < safe_limit:
        # Fallback to top-ranked results only if strict filtering leaves too few.
        filtered = ranked

    return filtered[:safe_limit]
