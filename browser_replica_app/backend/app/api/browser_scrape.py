import asyncio
from datetime import datetime
import json
import logging
import re
from urllib.parse import quote_plus
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from google import genai
import requests
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.browser_scrape_record import BrowserScrapeRecord
from app.schemas.browser_scrape import (
    BrowserScrapeHistoryResponse,
    BrowserScrapeItem,
    BrowserResearchRequest,
    BrowserResearchResponse,
    BrowserResearchSourceResult,
    BrowserScrapeRequest,
    BrowserScrapeResponse,
)
from app.services.browser_scrape_service import browser_scrape_service


router = APIRouter(prefix="/api/browser-scrape", tags=["browser-scrape"])
logger = logging.getLogger(__name__)

AI_KEYWORDS = {
    "ai",
    "artificial",
    "intelligence",
    "machine",
    "learning",
    "llm",
    "openai",
    "chatgpt",
    "genai",
    "gpt",
    "model",
    "models",
}

EXPLORE_DOMAIN_KEYWORDS = {
    "technology": [
        "technology", "tech", "software", "programming", "developer", "internet", "startup",
        "ai", "machine", "learning", "llm", "openai", "chatgpt", "cloud", "cyber", "data",
    ],
    "news_politics": [
        "news", "politics", "policy", "government", "election", "geopolitics", "economy", "war",
    ],
    "science": ["science", "research", "physics", "biology", "chemistry", "space", "neuroscience"],
    "business": ["business", "finance", "stocks", "market", "investment", "economics", "startup"],
}

EXPLORE_DOMAIN_SLUGS = {
    "technology": "technology",
    "news_politics": "news_and_politics",
    "science": "science",
    "business": "business_and_finance",
}

EXPLORE_TECH_FALLBACK_CANDIDATES = [
    {"name": "isthisAI", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 3_100_000, "url": "https://www.reddit.com/r/isthisAI"},
    {"name": "ChatGPT", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 2_100_000, "url": "https://www.reddit.com/r/ChatGPT"},
    {"name": "ClaudeAI", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 2_500_000, "url": "https://www.reddit.com/r/ClaudeAI"},
    {"name": "singularity", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 942_000, "url": "https://www.reddit.com/r/singularity"},
    {"name": "LocalLLaMA", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 1_100_000, "url": "https://www.reddit.com/r/LocalLLaMA"},
    {"name": "ClaudeCode", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 895_000, "url": "https://www.reddit.com/r/ClaudeCode"},
    {"name": "OpenAI", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 685_000, "url": "https://www.reddit.com/r/OpenAI"},
    {"name": "antiai", "section": "Artificial Intelligence & Machine Learning", "weekly_visitors": 696_000, "url": "https://www.reddit.com/r/antiai"},
    {"name": "technology", "section": "Tech News & Discussion", "weekly_visitors": 4_800_000, "url": "https://www.reddit.com/r/technology"},
    {"name": "techsupport", "section": "Tech News & Discussion", "weekly_visitors": 1_900_000, "url": "https://www.reddit.com/r/techsupport"},
    {"name": "apple", "section": "Tech News & Discussion", "weekly_visitors": 974_000, "url": "https://www.reddit.com/r/apple"},
    {"name": "ProgrammerHumor", "section": "Programming", "weekly_visitors": 1_100_000, "url": "https://www.reddit.com/r/ProgrammerHumor"},
    {"name": "webdev", "section": "Programming", "weekly_visitors": 694_000, "url": "https://www.reddit.com/r/webdev"},
    {"name": "learnprogramming", "section": "Programming", "weekly_visitors": 610_000, "url": "https://www.reddit.com/r/learnprogramming"},
]

_gemini_client = None


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    if not settings.GOOGLE_API_KEY:
        return None
    try:
        _gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    except Exception:
        _gemini_client = None
    return _gemini_client

# Saved for later (intentionally not used now; selection is fully dynamic):
# AI_PREFERRED_COMMUNITIES = [
#     "ChatGPT",
#     "OpenAI",
#     "LocalLLaMA",
#     "StableDiffusion",
#     "singularity",
#     "ClaudeAI",
#     "RealOrAI",
#     "ArtificialIntelligence",
#     "isthisAI",
#     "CharacterAI",
#     "GeminiAI",
# ]


def _build_query_urls(query: str) -> list[tuple[str, str]]:
    encoded = quote_plus(query)
    return [
        ("news", f"https://news.google.com/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"),
        ("youtube", f"https://www.youtube.com/results?search_query={encoded}"),
        ("reddit", f"https://old.reddit.com/search/?q={encoded}&sort=relevance&t=month"),
    ]


def _fallback_urls(source: str, query: str) -> list[str]:
    encoded = quote_plus(query)
    if source == "news":
        return [f"https://www.bing.com/news/search?q={encoded}"]
    if source == "youtube":
        return [f"https://www.youtube.com/results?search_query={encoded}&sp=EgIQAQ%253D%253D"]
    if source == "reddit":
        return [
            f"https://www.reddit.com/search/?q={encoded}&sort=relevance&t=month",
        ]
    return []


def _is_unusable_text(text: str) -> bool:
    normalized = (text or "").strip().lower()
    if len(normalized) < 80:
        return True
    blocked_signatures = [
        "you've been blocked",
        "you have been blocked",
        "blocked by network security",
        "verify you are human",
        "captcha",
        "access denied",
        "try visual search",
        "drop image anywhere",
    ]
    return any(signature in normalized for signature in blocked_signatures)


def _is_blocked_explore_text(text: str) -> bool:
    t = str(text or "").lower()
    return "blocked by network security" in t or "file a ticket" in t


def _clean_text(value: str, max_len: int = 240) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:max_len]


def _is_user_profile_community(name: str) -> bool:
    return str(name or "").lower().startswith("u_")


def _is_ai_query(query: str) -> bool:
    q = str(query or "").lower()
    return any(k in q for k in AI_KEYWORDS)


def _tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9_]+", str(text or "").lower()) if len(t) >= 3]


def _detect_explore_domain(query: str) -> tuple[str, list[str]]:
    q = str(query or "").lower()
    best_domain = "technology"
    best_score = -1
    for domain, keywords in EXPLORE_DOMAIN_KEYWORDS.items():
        score = sum(1 for k in keywords if k in q)
        if score > best_score:
            best_score = score
            best_domain = domain
    return best_domain, EXPLORE_DOMAIN_KEYWORDS.get(best_domain, [])


def _match_score(corpus: str, terms: list[str]) -> int:
    text = str(corpus or "").lower()
    return sum(1 for term in terms if term and term in text)


def _parse_visitors_to_int(text: str) -> int:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*([KMB])\s+weekly\s+visitors", text, flags=re.I)
    if not match:
        return 0
    value = float(match.group(1))
    unit = match.group(2).upper()
    multiplier = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}.get(unit, 1)
    return int(value * multiplier)


def _extract_explore_domain_url(main_text: str, domain_slug: str) -> str:
    pattern = rf"https://www\.reddit\.com/explore/[^\s)]+/{re.escape(domain_slug)}/"
    match = re.search(pattern, str(main_text or ""), flags=re.I)
    if match:
        return match.group(0)
    return f"https://www.reddit.com/explore/29m4k39/{domain_slug}/"


def _extract_explore_domain_candidates(main_text: str) -> list[dict]:
    text = str(main_text or "")
    pattern = re.compile(r"\[([^\]]+)\]\((https://www\.reddit\.com/explore/[^)]+/([a-z_]+)/)\)", re.I)
    candidates: list[dict] = []
    seen = set()
    for label, url, slug in pattern.findall(text):
        key = slug.lower()
        if key in seen:
            continue
        seen.add(key)
        candidates.append({"label": label.strip(), "slug": key, "url": url})
    return candidates


def _extract_communities_from_explore_text(explore_text: str) -> list[dict]:
    lines = str(explore_text or "").split("\n")
    current_section = ""
    candidates: list[dict] = []
    seen: set[str] = set()

    for idx, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue

        if line.startswith("### "):
            current_section = line.replace("### ", "", 1).strip()
            continue

        link_match = re.search(r"\[r/([A-Za-z0-9_]+)\]\((https://www\.reddit\.com/r/[A-Za-z0-9_]+[^)]*)\)", line)
        if link_match:
            name = link_match.group(1)
            if name.lower() in seen or _is_user_profile_community(name):
                continue
            visitors = 0
            window = " ".join(lines[idx: min(idx + 6, len(lines))])
            visitors = _parse_visitors_to_int(window)
            candidates.append(
                {
                    "name": name,
                    "url": link_match.group(2),
                    "section": current_section or "General",
                    "weekly_visitors": visitors,
                }
            )
            seen.add(name.lower())
            continue

        heading_match = re.match(r"^####\s+([A-Za-z0-9_]+)$", line)
        if heading_match:
            name = heading_match.group(1).strip()
            if name.lower() in seen or _is_user_profile_community(name):
                continue
            window = " ".join(lines[idx: min(idx + 8, len(lines))])
            visitors = _parse_visitors_to_int(window)
            candidates.append(
                {
                    "name": name,
                    "url": f"https://www.reddit.com/r/{name}",
                    "section": current_section or "General",
                    "weekly_visitors": visitors,
                }
            )
            seen.add(name.lower())
            continue

    return candidates


def _section_matches_domain(section: str, domain_slug: str, ai_query: bool) -> bool:
    s = str(section or "").lower()
    if ai_query:
        return "artificial intelligence" in s or "machine learning" in s
    if domain_slug == "technology":
        tech_sections = [
            "tech news",
            "programming",
            "software",
            "computers",
            "consumer electronics",
            "artificial intelligence",
            "virtual",
        ]
        return any(k in s for k in tech_sections)
    if domain_slug == "news_and_politics":
        return "news" in s or "politics" in s
    if domain_slug == "business_and_finance":
        return "business" in s or "finance" in s
    if domain_slug == "science":
        return "science" in s
    return True


def _select_section_communities(
    candidates: list[dict],
    query: str,
    domain_slug: str,
    limit: int,
) -> list[dict]:
    ai_query = _is_ai_query(query)
    scoped = [
        c for c in candidates
        if _section_matches_domain(c.get("section", ""), domain_slug=domain_slug, ai_query=ai_query)
    ]

    if not scoped:
        scoped = candidates

    if ai_query:
        blocked_tokens = ["complaint", "jobs", "job", "hiring", "career", "newsbot", "memes"]
        scoped = [
            c for c in scoped
            if not any(tok in str(c.get("name", "")).lower() for tok in blocked_tokens)
        ]

    ranked = sorted(
        scoped,
        key=lambda x: int(x.get("weekly_visitors") or 0),
        reverse=True,
    )

    unique = []
    seen = set()
    for item in ranked:
        key = str(item.get("name", "")).lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= limit:
            break

    return unique


def _rank_explore_communities_for_query(candidates: list[dict], query: str, limit: int) -> list[dict]:
    query_terms = _tokenize(query)
    ai_query = _is_ai_query(query)
    ranked_candidates = []

    for item in candidates:
        name = item.get("name", "")
        section = item.get("section", "")
        corpus = f"{name} {section}"
        match = _match_score(corpus, query_terms)
        score = match

        name_l = str(name).lower()
        section_l = str(section).lower()
        is_ai_section = "artificial intelligence" in section_l or "machine learning" in section_l
        has_ai_name = any(k in name_l for k in AI_KEYWORDS)

        if ai_query and not (is_ai_section or has_ai_name):
            # For AI topic queries, keep communities tied to AI sections or AI terms.
            continue

        if ai_query and is_ai_section:
            score += 6
        if ai_query and has_ai_name:
            score += 3

        # Penalize generic/noisy subreddit names for research quality.
        if any(tok in name_l for tok in ["complaint", "jobs", "jobhub", "memes", "shitpost", "circlejerk"]):
            score -= 6

        visitors = int(item.get("weekly_visitors") or 0)
        score += min(6, visitors // 500_000)

        if score <= 0 and not ai_query:
            continue

        ranked_candidates.append(
            {
                **item,
                "query_match": match,
                "score": score,
                "subscribers": visitors,
                "search_hits": 0,
            }
        )

    ranked = sorted(
        ranked_candidates,
        key=lambda x: (int(x.get("score") or 0), int(x.get("weekly_visitors") or 0)),
        reverse=True,
    )
    unique = []
    seen = set()
    for item in ranked:
        key = item.get("name", "").lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= limit:
            break
    return unique


def _extract_first_json_object(text: str) -> dict | None:
    raw = str(text or "").strip()
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except Exception:
            return None
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(raw[start : end + 1])
        except Exception:
            return None
    return None


def _llm_pick_explore_domain_and_communities(
    query: str,
    domain_candidates: list[dict],
    community_candidates: list[dict],
    limit: int,
) -> tuple[str | None, list[str]]:
    client = _get_gemini_client()
    if client is None:
        return None, []

    compact_domains = [
        {"slug": d.get("slug"), "label": d.get("label")}
        for d in domain_candidates[:20]
    ]
    compact_communities = [
        {
            "name": c.get("name"),
            "section": c.get("section"),
            "weekly_visitors": c.get("weekly_visitors", 0),
        }
        for c in community_candidates[:120]
    ]

    prompt = (
        "You are selecting Reddit Explore domain and communities for a research query. "
        "Choose one best domain slug and top communities that are tightly relevant. "
        "Prefer mainstream, high-signal communities and avoid complaint, meme, or low-signal communities. "
        "Avoid unrelated communities. Return JSON only with keys: domain_slug, communities. "
        "communities must be an array of subreddit names from candidates only."
        f"\n\nQuery: {query}"
        f"\nDomain candidates: {json.dumps(compact_domains, ensure_ascii=True)}"
        f"\nCommunity candidates: {json.dumps(compact_communities, ensure_ascii=True)}"
        f"\nMax communities: {limit}"
    )

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
        )
        payload = _extract_first_json_object(getattr(response, "text", ""))
        if not payload:
            return None, []
        domain_slug = str(payload.get("domain_slug") or "").strip().lower() or None
        communities = payload.get("communities") or []
        if not isinstance(communities, list):
            communities = []
        communities = [str(name).strip() for name in communities if str(name).strip()]
        return domain_slug, communities[:limit]
    except Exception as exc:
        logger.warning(f"Gemini selection failed, using fallback ranking: {exc}")
        return None, []


async def _discover_top_communities_from_explore(query: str, limit: int = 10) -> list[dict]:
    domain_name, _ = _detect_explore_domain(query)
    domain_slug = EXPLORE_DOMAIN_SLUGS.get(domain_name, "technology")

    main_payload = await browser_scrape_service.scrape_url(
        url="https://www.reddit.com/explore/",
        output_format="markdown",
        max_chars=200_000,
    )
    main_text = main_payload.get("text") or ""
    domain_candidates = _extract_explore_domain_candidates(main_text)

    llm_domain_slug, _ = _llm_pick_explore_domain_and_communities(
        query=query,
        domain_candidates=domain_candidates,
        community_candidates=[],
        limit=limit,
    )
    if llm_domain_slug:
        domain_slug = llm_domain_slug

    domain_url = _extract_explore_domain_url(main_text=main_text, domain_slug=domain_slug)

    domain_payload = await browser_scrape_service.scrape_url(
        url=domain_url,
        output_format="markdown",
        max_chars=220_000,
    )
    domain_text = domain_payload.get("text") or ""

    candidates = _extract_communities_from_explore_text(domain_text)

    if not candidates or _is_blocked_explore_text(domain_text):
        if domain_slug == "technology":
            candidates = [dict(item) for item in EXPLORE_TECH_FALLBACK_CANDIDATES]


    section_selected = _select_section_communities(
        candidates=candidates,
        query=query,
        domain_slug=domain_slug,
        limit=max(limit * 2, 20),
    )
    if section_selected:
        candidates = section_selected

    _, llm_communities = _llm_pick_explore_domain_and_communities(
        query=query,
        domain_candidates=domain_candidates,
        community_candidates=candidates,
        limit=limit,
    )

    ranked = _rank_explore_communities_for_query(candidates, query=query, limit=max(limit * 3, 30))
    if llm_communities:
        ranked_map = {str(item.get("name", "")).lower(): item for item in ranked}
        curated = []
        for name in llm_communities:
            item = ranked_map.get(name.lower())
            if item:
                curated.append(item)
        if curated:
            ranked = curated + [item for item in ranked if item.get("name", "").lower() not in {n.lower() for n in llm_communities}]

    ranked = ranked[:limit]

    if _is_ai_query(query):
        blocked_tokens = ["complaint", "jobs", "job", "hiring", "career", "newsbot", "memes"]
        kept = []
        removed = []
        for item in ranked:
            name_l = str(item.get("name", "")).lower()
            if any(tok in name_l for tok in blocked_tokens):
                removed.append(item)
            else:
                kept.append(item)
        ranked = kept

        if len(ranked) < limit:
            pool = _discover_top_communities(query=query, limit=max(limit * 5, 50))
            existing = {str(item.get("name", "")).lower() for item in ranked}
            for item in pool:
                name_l = str(item.get("name", "")).lower()
                if name_l in existing:
                    continue
                if any(tok in name_l for tok in blocked_tokens):
                    continue
                ranked.append(item)
                existing.add(name_l)
                if len(ranked) >= limit:
                    break

    ranked = ranked[:limit]

    # Safety fallback: if Explore parsing is sparse, use API-discovered domain communities.
    # For AI queries, keep the selection strictly Explore-driven unless it is empty.
    if len(ranked) < max(3, limit // 2) and (not _is_ai_query(query) or len(ranked) == 0):
        fallback_pool = _discover_top_communities(query=query, limit=max(limit * 3, 30))
        existing = {str(item.get("name", "")).lower() for item in ranked}
        for item in fallback_pool:
            name_l = str(item.get("name", "")).lower()
            if name_l in existing:
                continue
            item["section"] = item.get("section") or "fallback"
            ranked.append(item)
            existing.add(name_l)
            if len(ranked) >= limit:
                break

    ranked = ranked[:limit]

    for item in ranked:
        item["explore_domain"] = domain_slug

    return ranked


def _fetch_subreddit_subscribers(name: str, headers: dict) -> int:
    try:
        resp = requests.get(
            f"https://www.reddit.com/r/{name}/about.json",
            headers=headers,
            timeout=12,
        )
        resp.raise_for_status()
        data = (resp.json() or {}).get("data") or {}
        return int(data.get("subscribers") or 0)
    except Exception:
        return 0


def _discover_top_communities(query: str, limit: int = 10) -> list[dict]:
    headers = {"User-Agent": "CurioBrowserResearch/1.0"}
    results: dict[str, dict] = {}

    ai_query = _is_ai_query(query)
    query_terms = _tokenize(query)
    domain_name, domain_terms = _detect_explore_domain(query)
    if ai_query:
        domain_terms = sorted(set(list(AI_KEYWORDS) + ["artificial intelligence", "machine learning"]))

    # 1) Discover communities from domain-level Explore-style phrases first.
    if ai_query:
        subreddit_queries = [
            "artificial intelligence machine learning",
            "ai llm openai chatgpt",
        ]
    else:
        subreddit_queries = [domain_name.replace("_", " ")]
        if domain_terms:
            subreddit_queries.append(" ".join(domain_terms[:6]))

    for sr_query in subreddit_queries:
        sr_resp = requests.get(
            "https://www.reddit.com/subreddits/search.json",
            params={"q": sr_query, "limit": 100},
            headers=headers,
            timeout=20,
        )
        sr_resp.raise_for_status()
        sr_data = (((sr_resp.json() or {}).get("data") or {}).get("children") or [])
        for child in sr_data:
            data = child.get("data") or {}
            name = data.get("display_name")
            if not name or _is_user_profile_community(name):
                continue
            description = data.get("public_description") or data.get("title") or ""
            corpus = f"{name} {description}"
            query_match = _match_score(corpus, query_terms)
            domain_match = _match_score(corpus, domain_terms)
            if name not in results:
                results[name] = {
                    "name": name,
                    "subscribers": int(data.get("subscribers") or 0),
                    "search_hits": 0,
                    "query_match": query_match,
                    "domain_match": domain_match,
                }
            else:
                results[name]["subscribers"] = max(
                    int(results[name].get("subscribers") or 0),
                    int(data.get("subscribers") or 0),
                )
                results[name]["query_match"] = max(int(results[name].get("query_match") or 0), query_match)
                results[name]["domain_match"] = max(int(results[name].get("domain_match") or 0), domain_match)

    # 2) Topic search to count relevance only for already discovered domain communities.
    topic_resp = requests.get(
        "https://www.reddit.com/search.json",
        params={"q": query, "sort": "relevance", "t": "year", "limit": 100},
        headers=headers,
        timeout=20,
    )
    topic_resp.raise_for_status()
    topic_data = (((topic_resp.json() or {}).get("data") or {}).get("children") or [])
    for child in topic_data:
        data = child.get("data") or {}
        name = data.get("subreddit")
        if not name or _is_user_profile_community(name):
            continue
        if name not in results:
            # Keep selection constrained to domain communities discovered above.
            continue
        title = data.get("title") or ""
        selftext = data.get("selftext") or ""
        post_corpus = f"{name} {title} {selftext}"[:4000]
        query_match = _match_score(post_corpus, query_terms)
        domain_match = _match_score(post_corpus, domain_terms)
        results[name]["search_hits"] += 1
        results[name]["query_match"] = max(int(results[name].get("query_match") or 0), query_match)
        results[name]["domain_match"] = max(int(results[name].get("domain_match") or 0), domain_match)

    # Hydrate missing subscribers for promising candidates discovered from topic search.
    candidates_for_hydration = sorted(
        [
            item for item in results.values()
            if int(item.get("subscribers") or 0) == 0 and int(item.get("search_hits") or 0) >= 2
        ],
        key=lambda x: int(x.get("search_hits") or 0),
        reverse=True,
    )[:25]
    for item in candidates_for_hydration:
        item["subscribers"] = _fetch_subreddit_subscribers(item.get("name", ""), headers=headers)

    # Filter out tiny/noisy communities and keep only domain/query-relevant ones.
    min_subscribers = 50_000 if ai_query else 5_000
    filtered = [
        item
        for item in results.values()
        if not _is_user_profile_community(item.get("name", ""))
        and (
            int(item.get("subscribers") or 0) >= min_subscribers
            or (
                int(item.get("search_hits") or 0) >= (2 if ai_query else 2)
                and int(item.get("query_match") or 0) >= 2
                and int(item.get("domain_match") or 0) >= 1
            )
        )
        and (
            int(item.get("domain_match") or 0) >= (1 if ai_query else 1)
            or int(item.get("query_match") or 0) >= 3
            or int(item.get("search_hits") or 0) >= (5 if ai_query else 3)
        )
    ]

    ranked = sorted(
        filtered,
        key=lambda x: (
            int(x.get("domain_match") or 0),
            int(x.get("query_match") or 0),
            int(x.get("search_hits") or 0),
            int(x.get("subscribers") or 0),
        ),
        reverse=True,
    )
    return ranked[:limit]


def _top_posts_for_subreddit(subreddit: str, query: str, post_limit: int = 10) -> list[dict]:
    headers = {"User-Agent": "CurioBrowserResearch/1.0"}
    resp = requests.get(
        f"https://www.reddit.com/r/{subreddit}/search.json",
        params={
            "q": query,
            "restrict_sr": "1",
            "sort": "top",
            "t": "year",
            "limit": 50,
        },
        headers=headers,
        timeout=20,
    )
    resp.raise_for_status()
    children = (((resp.json() or {}).get("data") or {}).get("children") or [])

    posts = []
    for child in children:
        data = child.get("data") or {}
        title = _clean_text(data.get("title") or "Untitled", 260)
        selftext = _clean_text(data.get("selftext") or "", 400)
        summary = selftext or "No body text; likely a link/discussion post."
        permalink = data.get("permalink") or ""
        post_url = f"https://www.reddit.com{permalink}" if permalink else (data.get("url") or "")

        posts.append(
            {
                "id": data.get("id") or "",
                "subreddit": subreddit,
                "title": title,
                "summary": summary,
                "score": int(data.get("score") or 0),
                "num_comments": int(data.get("num_comments") or 0),
                "author": data.get("author") or "unknown",
                "url": post_url,
            }
        )

    ranked = sorted(posts, key=lambda p: (p["score"], p["num_comments"]), reverse=True)
    return ranked[:post_limit]


def _global_topic_posts(query: str, limit: int = 150) -> list[dict]:
    headers = {"User-Agent": "CurioBrowserResearch/1.0"}
    resp = requests.get(
        "https://www.reddit.com/search.json",
        params={"q": query, "sort": "top", "t": "year", "limit": limit},
        headers=headers,
        timeout=25,
    )
    resp.raise_for_status()
    children = (((resp.json() or {}).get("data") or {}).get("children") or [])

    posts = []
    for child in children:
        data = child.get("data") or {}
        subreddit_name = data.get("subreddit") or "unknown"
        if _is_user_profile_community(subreddit_name):
            continue
        title = _clean_text(data.get("title") or "Untitled", 260)
        selftext = _clean_text(data.get("selftext") or "", 400)
        summary = selftext or "No body text; likely a link/discussion post."
        permalink = data.get("permalink") or ""
        post_url = f"https://www.reddit.com{permalink}" if permalink else (data.get("url") or "")
        posts.append(
            {
                "id": data.get("id") or "",
                "subreddit": subreddit_name,
                "title": title,
                "summary": summary,
                "score": int(data.get("score") or 0),
                "num_comments": int(data.get("num_comments") or 0),
                "author": data.get("author") or "unknown",
                "url": post_url,
            }
        )

    return sorted(posts, key=lambda p: (p["score"], p["num_comments"]), reverse=True)


def _reddit_topic_deep_research(query: str, max_chars: int) -> tuple[str, str, str]:
    community_count = 10
    posts_per_community = 10
    communities = _discover_top_communities(query=query, limit=community_count)

    lines = [
        f"Reddit deep research for query: {query}",
        f"Target: {community_count} communities x {posts_per_community} posts = {community_count * posts_per_community} posts",
        "",
    ]

    total_posts = 0
    seen_ids: set[str] = set()
    for idx, community in enumerate(communities, start=1):
        name = community["name"]
        hits = community.get("search_hits", 0)
        subs = community.get("subscribers", 0)
        lines.append(f"Community {idx}: r/{name} | search_hits={hits} | subscribers={subs}")

        try:
            posts = _top_posts_for_subreddit(name, query=query, post_limit=posts_per_community)
        except Exception as exc:
            lines.append(f"  Failed to fetch posts for r/{name}: {exc}")
            lines.append("")
            continue

        if not posts:
            lines.append(f"  No relevant posts found for r/{name}")
            lines.append("")
            continue

        for p_i, post in enumerate(posts, start=1):
            if post.get("id") and post["id"] in seen_ids:
                continue
            if post.get("id"):
                seen_ids.add(post["id"])
            total_posts += 1
            lines.append(
                f"  {p_i}. score={post['score']} comments={post['num_comments']} author={post['author']}"
            )
            lines.append(f"     Title: {post['title']}")
            lines.append(f"     Summary: {post['summary']}")
            if post.get("url"):
                lines.append(f"     URL: {post['url']}")
            lines.append("")

    target_total = community_count * posts_per_community
    if total_posts < target_total:
        missing = target_total - total_posts
        lines.append(f"Global fill for missing posts: {missing}")
        lines.append("")
        try:
            global_posts = _global_topic_posts(query=query, limit=200)
            fill_index = 1
            for post in global_posts:
                if total_posts >= target_total:
                    break
                post_id = post.get("id")
                if post_id and post_id in seen_ids:
                    continue
                if post_id:
                    seen_ids.add(post_id)
                total_posts += 1
                lines.append(
                    f"  F{fill_index}. r/{post['subreddit']} | score={post['score']} comments={post['num_comments']} author={post['author']}"
                )
                lines.append(f"     Title: {post['title']}")
                lines.append(f"     Summary: {post['summary']}")
                if post.get("url"):
                    lines.append(f"     URL: {post['url']}")
                lines.append("")
                fill_index += 1
        except Exception as exc:
            lines.append(f"  Global fill failed: {exc}")
            lines.append("")

    lines.insert(2, f"Collected posts: {total_posts}")
    text = "\n".join(lines).strip()[:max_chars]

    return (
        f"Reddit top communities and posts for '{query}'",
        f"https://www.reddit.com/search/?q={quote_plus(query)}&sort=relevance&t=year",
        text,
    )


async def _reddit_topic_deep_research_from_explore(query: str, max_chars: int) -> tuple[str, str, str]:
    community_count = 10
    posts_per_community = 10
    ai_query = _is_ai_query(query)

    communities = await _discover_top_communities_from_explore(query=query, limit=community_count)
    if len(communities) < community_count and (not ai_query or len(communities) == 0):
        fallback = await asyncio.to_thread(_discover_top_communities, query, community_count * 2)
        existing = {c.get("name", "").lower() for c in communities}
        for item in fallback:
            key = item.get("name", "").lower()
            if key in existing:
                continue
            item["section"] = item.get("section") or "fallback"
            communities.append(item)
            existing.add(key)
            if len(communities) >= community_count:
                break

    communities = communities[:community_count]

    lines = [
        f"Reddit deep research for query: {query}",
        f"Target: {community_count} communities x {posts_per_community} posts = {community_count * posts_per_community} posts",
        "Community source flow: Explore -> domain page -> subdomains -> matched communities",
        "",
    ]

    total_posts = 0
    seen_ids: set[str] = set()

    for idx, community in enumerate(communities, start=1):
        name = community.get("name", "unknown")
        hits = int(community.get("search_hits") or 0)
        subs = int(community.get("subscribers") or 0)
        section = community.get("section") or "General"
        lines.append(f"Community {idx}: r/{name} | section={section} | search_hits={hits} | subscribers={subs}")

        try:
            posts = await asyncio.to_thread(_top_posts_for_subreddit, name, query, posts_per_community)
        except Exception as exc:
            lines.append(f"  Failed to fetch posts for r/{name}: {exc}")
            lines.append("")
            continue

        if not posts:
            lines.append(f"  No relevant posts found for r/{name}")
            lines.append("")
            continue

        for p_i, post in enumerate(posts, start=1):
            if post.get("id") and post["id"] in seen_ids:
                continue
            if post.get("id"):
                seen_ids.add(post["id"])
            total_posts += 1
            lines.append(
                f"  {p_i}. score={post['score']} comments={post['num_comments']} author={post['author']}"
            )
            lines.append(f"     Title: {post['title']}")
            lines.append(f"     Summary: {post['summary']}")
            if post.get("url"):
                lines.append(f"     URL: {post['url']}")
            lines.append("")

    target_total = community_count * posts_per_community
    if total_posts < target_total:
        missing = target_total - total_posts
        lines.append(f"Global fill for missing posts: {missing}")
        lines.append("")
        try:
            global_posts = await asyncio.to_thread(_global_topic_posts, query, 200)
            fill_index = 1
            for post in global_posts:
                if total_posts >= target_total:
                    break
                post_id = post.get("id")
                if post_id and post_id in seen_ids:
                    continue
                if post_id:
                    seen_ids.add(post_id)
                total_posts += 1
                lines.append(
                    f"  F{fill_index}. r/{post['subreddit']} | score={post['score']} comments={post['num_comments']} author={post['author']}"
                )
                lines.append(f"     Title: {post['title']}")
                lines.append(f"     Summary: {post['summary']}")
                if post.get("url"):
                    lines.append(f"     URL: {post['url']}")
                lines.append("")
                fill_index += 1
        except Exception as exc:
            lines.append(f"  Global fill failed: {exc}")
            lines.append("")

    lines.insert(2, f"Collected posts: {total_posts}")
    text = "\n".join(lines).strip()[:max_chars]

    return (
        f"Reddit top communities and posts for '{query}'",
        "https://www.reddit.com/explore/",
        text,
    )


def _format_reddit_json_listing(payload: dict, max_chars: int) -> str:
    children = (((payload or {}).get("data") or {}).get("children") or [])[:12]
    lines = []
    for child in children:
        data = child.get("data") or {}
        title = (data.get("title") or "Untitled").strip()
        subreddit = (data.get("subreddit") or "unknown").strip()
        score = int(data.get("score") or 0)
        comments = int(data.get("num_comments") or 0)
        permalink = data.get("permalink") or ""
        post_url = f"https://www.reddit.com{permalink}" if permalink else (data.get("url") or "")
        lines.append(f"r/{subreddit} | score {score} | comments {comments}")
        lines.append(title)
        if post_url:
            lines.append(post_url)
        lines.append("")

    text = "\n".join(lines).strip()
    return text[:max_chars]


def _reddit_json_fallback(query: str, max_chars: int) -> tuple[str, str, str]:
    response = requests.get(
        "https://www.reddit.com/search.json",
        params={"q": query, "sort": "relevance", "t": "month", "limit": 20},
        headers={"User-Agent": "CurioBrowserResearch/1.0"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    text = _format_reddit_json_listing(payload, max_chars=max_chars)
    if not text:
        raise RuntimeError("Reddit JSON fallback returned no posts")
    return (
        "Reddit search results",
        f"https://www.reddit.com/search/?q={quote_plus(query)}&sort=relevance&t=month",
        text,
    )


async def _scrape_source_with_fallback(
    source: str,
    primary_url: str,
    query: str,
    output_format: str,
    max_chars: int,
) -> tuple[str, str, dict | None, str | None]:
    if source == "reddit":
        try:
            title, final_url, text = await _reddit_topic_deep_research_from_explore(query, max_chars)
            return (
                source,
                primary_url,
                {
                    "title": title,
                    "finalUrl": final_url,
                    "text": text,
                    "truncated": {"text": len(text) >= max_chars},
                },
                None,
            )
        except Exception:
            try:
                title, final_url, text = await asyncio.to_thread(_reddit_topic_deep_research, query, max_chars)
                return (
                    source,
                    primary_url,
                    {
                        "title": title,
                        "finalUrl": final_url,
                        "text": text,
                        "truncated": {"text": len(text) >= max_chars},
                    },
                    None,
                )
            except Exception:
                # Fall back to browser flow below when API-based deep research fails.
                pass

    candidate_urls = [primary_url, *_fallback_urls(source, query)]
    last_error = None

    for candidate_url in candidate_urls:
        try:
            payload = await browser_scrape_service.scrape_url(
                url=candidate_url,
                output_format=output_format,
                max_chars=max_chars,
            )
            text = (payload.get("text") or "").strip()
            # Retry alternate URL if extraction is blocked or too thin for useful research.
            if _is_unusable_text(text) and candidate_url != candidate_urls[-1]:
                continue
            return source, candidate_url, payload, None
        except Exception as exc:
            last_error = str(exc)

    return source, primary_url, None, last_error or "Unknown scrape error"


@router.post("/scrape", response_model=BrowserScrapeResponse)
async def scrape_url_with_browser(request: BrowserScrapeRequest, db: Session = Depends(get_db)):
    run_id = str(uuid4())

    try:
        result = await browser_scrape_service.scrape_url(
            url=request.url,
            output_format=request.format,
            max_chars=request.max_chars,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    row = BrowserScrapeRecord(
        id=str(uuid4()),
        run_id=run_id,
        requested_url=request.url[:1000],
        final_url=(result.get("finalUrl") or request.url)[:1000],
        title=(result.get("title") or None),
        extracted_text=(result.get("text") or "")[: request.max_chars],
        mode=str(result.get("mode") or "browser"),
        output_format=str(result.get("format") or request.format),
        scrape_source="browser_satya",
        truncated_text=1 if bool((result.get("truncated") or {}).get("text")) else 0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    item = BrowserScrapeItem(
        id=row.id,
        run_id=row.run_id,
        requested_url=row.requested_url,
        final_url=row.final_url,
        title=row.title,
        text=row.extracted_text,
        mode=row.mode,
        format=row.output_format,
        scrape_source=row.scrape_source,
        truncated_text=bool(row.truncated_text),
        scraped_at=row.scraped_at or datetime.now(),
    )

    return BrowserScrapeResponse(run_id=run_id, item=item)


@router.post("/research", response_model=BrowserResearchResponse)
async def run_query_research(request: BrowserResearchRequest, db: Session = Depends(get_db)):
    run_id = str(uuid4())
    query = request.query.strip()
    urls = _build_query_urls(query)

    tasks = [
        _scrape_source_with_fallback(
            source=source,
            primary_url=url,
            query=query,
            output_format=request.format,
            max_chars=request.max_chars_per_source,
        )
        for source, url in urls
    ]

    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    response_sources: list[BrowserResearchSourceResult] = []

    for (source, requested_url), result in zip(urls, raw_results):
        if isinstance(result, Exception):
            text = f"Failed to scrape {source}: {str(result)}"
            final_url = requested_url
            title = f"{source.title()} scrape failed"
            truncated = False
        else:
            _, attempted_url, payload, scrape_error = result
            if payload is None:
                if source == "reddit":
                    try:
                        title, final_url, text = await asyncio.to_thread(
                            _reddit_json_fallback,
                            query,
                            request.max_chars_per_source,
                        )
                        truncated = len(text) >= request.max_chars_per_source
                    except Exception as fallback_exc:
                        text = f"Failed to scrape {source}: {scrape_error or str(fallback_exc)}"
                        final_url = attempted_url
                        title = f"{source.title()} scrape failed"
                        truncated = False
                else:
                    text = f"Failed to scrape {source}: {scrape_error}"
                    final_url = attempted_url
                    title = f"{source.title()} scrape failed"
                    truncated = False
            else:
                text = (payload.get("text") or "")[: request.max_chars_per_source]
                final_url = (payload.get("finalUrl") or attempted_url)
                title = payload.get("title") or None
                truncated = bool((payload.get("truncated") or {}).get("text"))
                if source == "reddit" and _is_unusable_text(text):
                    try:
                        title, final_url, text = await asyncio.to_thread(
                            _reddit_json_fallback,
                            query,
                            request.max_chars_per_source,
                        )
                        truncated = len(text) >= request.max_chars_per_source
                    except Exception:
                        pass

        db.add(
            BrowserScrapeRecord(
                id=str(uuid4()),
                run_id=run_id,
                requested_url=requested_url[:1000],
                final_url=final_url[:1000],
                title=title,
                extracted_text=text,
                mode="browser",
                output_format=request.format,
                scrape_source=f"browser_{source}",
                truncated_text=1 if truncated else 0,
            )
        )

        response_sources.append(
            BrowserResearchSourceResult(
                source=source,
                requested_url=requested_url,
                final_url=final_url,
                title=title,
                text=text,
                truncated_text=truncated,
            )
        )

    db.commit()

    return BrowserResearchResponse(
        run_id=run_id,
        query=query,
        format=request.format,
        sources=response_sources,
    )


@router.get("/history", response_model=BrowserScrapeHistoryResponse)
async def get_browser_scrape_history(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = db.query(BrowserScrapeRecord).order_by(desc(BrowserScrapeRecord.scraped_at)).limit(limit).all()
    items = [
        BrowserScrapeItem(
            id=row.id,
            run_id=row.run_id,
            requested_url=row.requested_url,
            final_url=row.final_url,
            title=row.title,
            text=row.extracted_text,
            mode=row.mode,
            format=row.output_format,
            scrape_source=row.scrape_source,
            truncated_text=bool(row.truncated_text),
            scraped_at=row.scraped_at,
        )
        for row in rows
    ]

    return BrowserScrapeHistoryResponse(total_items=len(items), items=items)
