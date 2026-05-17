import asyncio
import base64
import json
import logging
import time
from typing import Iterable
from datetime import datetime
from urllib.parse import quote_plus
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.observability import get_langfuse
from app.core.security import get_optional_user
from app.models import Article, BrowserResearchItem, BrowserResearchRun, BrowserResearchRunMetric
from app.schemas.browser_research import (
    BlogItem,
    BrowserResearchHistoryResponse,
    LiveBrowserRequest,
    LLMUsageSummary,
    BrowserResearchRequest,
    BrowserResearchResponse,
    BrowserResearchRunSummary,
)
from app.services.youtube_scraping_service import youtube_scraping_service


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/browser-research", tags=["browser-research"])
from app.core.ollama_client import get_llm_client, get_active_model
GEMINI_MODEL = get_active_model()

# ── twscrape singleton — initialised once, cookies cached in SQLite ────────
_twscrape_api = None

async def _get_twscrape_api():
    """Return a ready twscrape API or None if credentials not set."""
    global _twscrape_api
    if _twscrape_api is not None:
        return _twscrape_api
    import os
    username = os.environ.get("TWITTER_USERNAME", "").strip()
    password = os.environ.get("TWITTER_PASSWORD", "").strip()
    email    = os.environ.get("TWITTER_EMAIL", "").strip()
    if not (username and password and email):
        return None
    try:
        from twscrape import API
        api = API("/tmp/twscrape_accounts.db")
        await api.pool.add_account(username, password, email, "")
        await api.pool.login_all()
        _twscrape_api = api
        logger.info("[TWSCRAPE] Authenticated OK")
        return api
    except Exception as exc:
        logger.warning(f"[TWSCRAPE] Init failed: {exc}")
        return None


AI_EXPLORE_COMMUNITIES = [
    {"name": "isthisAI", "weekly_visitors": 3_100_000},
    {"name": "ChatGPT", "weekly_visitors": 2_100_000},
    {"name": "ClaudeAI", "weekly_visitors": 2_500_000},
    {"name": "singularity", "weekly_visitors": 942_000},
    {"name": "LocalLLaMA", "weekly_visitors": 1_100_000},
    {"name": "ClaudeCode", "weekly_visitors": 895_000},
    {"name": "OpenAI", "weekly_visitors": 685_000},
    {"name": "antiai", "weekly_visitors": 696_000},
    {"name": "learnmachinelearning", "weekly_visitors": 700_000},
    {"name": "deeplearning", "weekly_visitors": 500_000},
    {"name": "reinforcementlearning", "weekly_visitors": 250_000},
    {"name": "agi", "weekly_visitors": 350_000},
]

# Topic-aware Reddit community fallback — used when LLM community picking fails.
# Keyed by keyword fragments that appear in the search query (lowercase).
TOPIC_COMMUNITY_MAP: dict[str, list[str]] = {
    # Technology / AI
    "ai": ["MachineLearning", "LocalLLaMA", "artificial", "singularity", "ChatGPT"],
    "machine learning": ["MachineLearning", "learnmachinelearning", "deeplearning", "datascience"],
    "llm": ["LocalLLaMA", "MachineLearning", "ChatGPT", "singularity"],
    "robot": ["robotics", "engineering", "technology", "Futurology"],
    "software": ["programming", "software", "learnprogramming", "technology"],
    "crypto": ["CryptoCurrency", "Bitcoin", "ethereum", "CryptoMarkets", "defi"],
    "bitcoin": ["Bitcoin", "CryptoCurrency", "CryptoMarkets"],
    "blockchain": ["ethereum", "CryptoCurrency", "Bitcoin", "defi"],
    "space": ["space", "spacex", "nasa", "astrophysics", "Astronomy"],
    "climate": ["climate", "environment", "sustainability", "renewableenergy", "energy"],
    "energy": ["energy", "renewableenergy", "solar", "climate", "sustainability"],
    "health": ["health", "medicine", "nutrition", "medical", "healthcare"],
    "covid": ["Coronavirus", "medicine", "health", "science"],
    "drug": ["medicine", "health", "science", "pharmacy"],
    "cancer": ["cancer", "oncology", "medicine", "science"],
    "gene": ["genetics", "biology", "science", "Bioinformatics"],
    "bio": ["biology", "Bioinformatics", "biotech", "science", "genetics"],
    "economy": ["economics", "economy", "finance", "investing", "worldnews"],
    "stock": ["investing", "stocks", "wallstreetbets", "finance", "economy"],
    "finance": ["finance", "investing", "personalfinance", "economics"],
    "startup": ["startups", "entrepreneur", "business", "investing", "venturecapital"],
    "politics": ["politics", "PoliticalDiscussion", "worldnews", "news"],
    "election": ["politics", "PoliticalDiscussion", "news", "worldnews"],
    "war": ["worldnews", "geopolitics", "news", "politics"],
    "science": ["science", "askscience", "EverythingScience", "Physics", "chemistry"],
    "physics": ["Physics", "science", "askscience", "astrophysics"],
    "quantum": ["quantum", "Physics", "science", "askscience"],
    "nuclear": ["nuclear", "energy", "science", "Physics"],
    "aviation": ["aviation", "flying", "aerospace", "airplanes"],
    "aircraft": ["aviation", "aerospace", "flying", "airplanes", "engineering"],
    "engine": ["aviation", "aerospace", "engineering", "IndiaDefence", "geopolitics"],
    "defense": ["geopolitics", "worldnews", "military", "CredibleDefense"],
    "defence": ["IndiaDefence", "geopolitics", "india", "military", "CredibleDefense"],
    "military": ["military", "geopolitics", "worldnews", "CredibleDefense"],
    "india": ["india", "IndiaDefence", "geopolitics", "IndiaSpeaks", "worldnews"],
    "drdo": ["IndiaDefence", "india", "aerospace", "geopolitics", "aviation"],
    "tejas": ["IndiaDefence", "india", "aviation", "aerospace", "geopolitics"],
    "kaveri": ["IndiaDefence", "india", "aviation", "aerospace", "geopolitics"],
    "missile": ["IndiaDefence", "military", "geopolitics", "worldnews", "CredibleDefense"],
    "fighter": ["IndiaDefence", "aviation", "aerospace", "military", "geopolitics"],
    "drone": ["IndiaDefence", "military", "aviation", "geopolitics", "technology"],
    "pakistan": ["india", "geopolitics", "worldnews", "IndiaDefence", "CredibleDefense"],
    "china": ["geopolitics", "worldnews", "China", "IndiaDefence", "ChinaPolicy"],
    "gaming": ["gaming", "Games", "pcgaming", "technology"],
    "game": ["gaming", "Games", "pcgaming", "boardgames"],
    "food": ["food", "cooking", "nutrition", "EatCheapAndHealthy"],
    "medicine": ["medicine", "health", "askdocs", "pharmacy"],
    "law": ["law", "legaladvice", "politics", "news"],
}

GENERIC_COMMUNITY_FALLBACK = ["worldnews", "science", "technology", "askscience", "todayilearned"]

# Subreddits that are almost always off-topic for news/research queries.
# These communities discuss personal life, relationship advice, and entertainment —
# they match topic keywords (e.g. "biotechnology AITA") but are never useful results.
_JUNK_SUBREDDITS = frozenset({
    "amitheasshole", "relationship_advice", "relationships", "dating_advice",
    "tifu", "confessions", "offmychest", "rant", "unpopularopinion",
    "raisedbynarcissists", "survivorsofabuse", "abusiverelationships",
    "casualconversation", "askwomenadvice", "askmenadvice", "pettyrevenge",
    "entitledparents", "choosingbeggars", "antiwork", "mildlyinfuriating",
})


def _parse_proxy(proxy_url: str):
    """Return (proxy_str, proxy_auth) for aiohttp — splits credentials out of the URL
    so aiohttp sends a proper Proxy-Authorization header (fixes 407 errors)."""
    import aiohttp
    if not proxy_url:
        return None, None
    from urllib.parse import urlparse
    p = urlparse(proxy_url)
    if p.username and p.password:
        clean = f"{p.scheme}://{p.hostname}:{p.port}"
        auth = aiohttp.BasicAuth(p.username, p.password)
        return clean, auth
    return proxy_url, None


def _clean_sub_name(name: str) -> str:
    """Strip r/ prefix, spaces, and invalid characters from LLM-returned subreddit names."""
    s = str(name or "").strip()
    if s.lower().startswith("r/"):
        s = s[2:]
    # Subreddit names can only contain letters, numbers, underscores
    s = "".join(ch for ch in s if ch.isalnum() or ch == "_")
    return s


def _topic_aware_communities(query: str, limit: int = 5) -> list[str]:
    """Pick subreddits based on keyword matching in the query when LLM is unavailable."""
    q = query.lower()
    scores: dict[str, int] = {}
    for keyword, subs in TOPIC_COMMUNITY_MAP.items():
        if keyword in q:
            for i, sub in enumerate(subs):
                scores[sub] = scores.get(sub, 0) + (len(subs) - i)
    if scores:
        ranked = sorted(scores, key=lambda s: scores[s], reverse=True)
        return ranked[:limit]
    return GENERIC_COMMUNITY_FALLBACK[:limit]

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it",
    "of", "on", "or", "that", "the", "to", "with", "about", "how", "what", "when", "where", "why",
    "top", "latest", "new", "news", "update", "updates", "own", "its", "has", "had",
    "can", "did", "get", "got", "let", "put", "set", "say", "said", "now", "also",
}

# Cost rates are approximate and intentionally configurable in code.
GEMINI_FLASH_INPUT_COST_PER_1M = 0.35
GEMINI_FLASH_OUTPUT_COST_PER_1M = 1.05


def _get_genai_client():
    try:
        return get_llm_client()
    except Exception:
        return None


def _extract_json(text: str):
    import re as _re
    raw = str(text or "").strip()
    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    code_match = _re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, _re.DOTALL)
    if code_match:
        try:
            return json.loads(code_match.group(1))
        except Exception:
            pass
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except Exception:
            pass
    start = raw.find("{")
    if start < 0:
        return None
    # Walk forward matching braces to find the first complete JSON object.
    # This avoids rfind("}") being fooled by text after the JSON.
    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(raw[start:], start):
        if esc:
            esc = False
            continue
        if ch == '\\' and in_str:
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(raw[start:i + 1])
                except Exception:
                    return None
    return None


def _extract_response_text(response) -> str:
    # Ollama client returns a response with a direct .text attribute
    direct = getattr(response, "text", None)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    # Gemini client returns response.candidates[].content.parts[].text
    texts: list[str] = []
    for candidate in (getattr(response, "candidates", None) or []):
        content = getattr(candidate, "content", None)
        for part in (getattr(content, "parts", None) or []):
            value = getattr(part, "text", None)
            if isinstance(value, str) and value.strip():
                texts.append(value.strip())
    return "\n".join(texts).strip()


def _empty_usage() -> dict[str, int]:
    return {
        "calls": 0,
        "prompt_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
    }


def _usage_from_response(response) -> dict[str, int]:
    usage = getattr(response, "usage_metadata", None)
    prompt = int(getattr(usage, "prompt_token_count", 0) or 0)
    output = int(getattr(usage, "candidates_token_count", 0) or 0)
    total = int(getattr(usage, "total_token_count", 0) or (prompt + output))
    return {
        "calls": 1,
        "prompt_tokens": max(prompt, 0),
        "output_tokens": max(output, 0),
        "total_tokens": max(total, 0),
    }


def _merge_usage(target: dict[str, int], delta: dict[str, int] | None) -> None:
    if not delta:
        return
    target["calls"] += int(delta.get("calls", 0) or 0)
    target["prompt_tokens"] += int(delta.get("prompt_tokens", 0) or 0)
    target["output_tokens"] += int(delta.get("output_tokens", 0) or 0)
    target["total_tokens"] += int(delta.get("total_tokens", 0) or 0)


def _estimate_cost_usd(prompt_tokens: int, output_tokens: int) -> float:
    prompt_cost = (max(prompt_tokens, 0) / 1_000_000) * GEMINI_FLASH_INPUT_COST_PER_1M
    output_cost = (max(output_tokens, 0) / 1_000_000) * GEMINI_FLASH_OUTPUT_COST_PER_1M
    return round(prompt_cost + output_cost, 6)


def _usage_to_schema(model: str | None, usage: dict[str, int], cost_usd: float) -> LLMUsageSummary:
    return LLMUsageSummary(
        model=model,
        calls=int(usage.get("calls", 0) or 0),
        prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
        output_tokens=int(usage.get("output_tokens", 0) or 0),
        total_tokens=int(usage.get("total_tokens", 0) or 0),
        estimated_cost_usd=float(cost_usd or 0.0),
    )


def _pick_reddit_communities_with_gemini(query: str, limit: int, trace_id: str = None) -> tuple[list[str], dict[str, int]]:
    client = _get_genai_client()
    if client is None:
        return _topic_aware_communities(query, limit), _empty_usage()

    prompt = (
        "Select the best Reddit communities for researching this specific query. "
        "Return JSON only: {\"communities\": [\"sub1\", \"sub2\", ...]}. "
        "Pick communities that are directly relevant to the query topic — not generic ones. "
        "You may suggest any real subreddit, not just from the candidate list.\n\n"
        f"Query: {query}\n"
        f"Max communities: {limit}"
    )

    try:
        t0 = time.time()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        latency_ms = int((time.time() - t0) * 1000)
        text = _extract_response_text(response)
        usage_counts = _usage_from_response(response)
        payload = _extract_json(text)
        
        # --- Langfuse ---
        lf = get_langfuse()
        if lf:
            usage = getattr(response, "usage_metadata", None)
            lf.generation(
                name="pick_reddit_communities",
                model=GEMINI_MODEL,
                input=prompt,
                output=text,
                trace_id=trace_id,
                usage={
                    "input": getattr(usage, "prompt_token_count", 0),
                    "output": getattr(usage, "candidates_token_count", 0),
                    "total": getattr(usage, "total_token_count", 0),
                    "unit": "TOKENS",
                },
                latency=latency_ms,
            )

        choices = payload.get("communities") if isinstance(payload, dict) else None
        if isinstance(choices, list):
            normalized = []
            for item in choices:
                name = _clean_sub_name(str(item))
                if name and name not in normalized:
                    normalized.append(name)
                if len(normalized) >= limit:
                    break
            if normalized:
                return normalized, usage_counts
    except Exception as exc:
        logger.warning(f"[BROWSER-RESEARCH] Gemini community pick failed: {exc}")

    return _topic_aware_communities(query, limit), _empty_usage()


def _summarize_text(title: str, body: str, client, trace_id: str = None) -> tuple[str, dict[str, int]]:
    fallback = (body or "").strip().replace("\n", " ")[:300] or f"Summary of: {title}"
    if client is None:
        return fallback, _empty_usage()

    prompt = (
        "Write a single flowing paragraph (3-5 sentences, no headings, no bullet points, no labels) "
        "that naturally weaves together: what happened, where, when, who was involved, why it happened, "
        "what the impact is, current status, and next steps — but only include the details that are "
        "actually present in the article. Write like a sharp news reporter: factual, specific, concise.\n\n"
        f"Title: {title}\nBody: {body or ''}"
    )
    try:
        t0 = time.time()
        response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        latency_ms = int((time.time() - t0) * 1000)
        text = _extract_response_text(response)
        usage_counts = _usage_from_response(response)
        
        # --- Langfuse ---
        lf = get_langfuse()
        if lf:
            usage = getattr(response, "usage_metadata", None)
            lf.generation(
                name="summarize_text",
                model=GEMINI_MODEL,
                input=prompt,
                output=text,
                trace_id=trace_id,
                usage={
                    "input": getattr(usage, "prompt_token_count", 0),
                    "output": getattr(usage, "candidates_token_count", 0),
                    "total": getattr(usage, "total_token_count", 0),
                    "unit": "TOKENS",
                },
                latency=latency_ms,
            )
            
        return text or fallback, usage_counts
    except Exception:
        return fallback, _empty_usage()


def _tokenize_meaningful(text: str) -> set[str]:
    parts = [x.strip().lower() for x in (text or "").split()]
    cleaned = set()
    for token in parts:
        # Strip possessive 's before removing non-alnum (india's → india)
        token = token.rstrip("'s").rstrip("'")
        token = "".join(ch for ch in token if ch.isalnum())
        if len(token) < 3 or token in STOPWORDS:
            continue
        cleaned.add(token)
    return cleaned


def _keyword_overlap_score(query: str, text: str) -> float:
    q_terms = _tokenize_meaningful(query)
    if not q_terms:
        return 0.0
    t_terms = _tokenize_meaningful(text)
    if not t_terms:
        return 0.0
    overlap = len(q_terms.intersection(t_terms))
    return overlap / max(len(q_terms), 1)


def _build_blog_context(blog: BlogItem) -> str:
    parts: Iterable[str] = [
        blog.title or "",
        blog.summary or "",
        blog.community or "",
        blog.channel or "",
    ]
    return "\n".join(p for p in parts if p).strip()


def _score_blog_relevance(query: str, blog: BlogItem, client, trace_id: str = None) -> tuple[float, dict[str, int]]:
    context = _build_blog_context(blog)
    lexical_score = _keyword_overlap_score(query, context)

    # Fast reject to keep quality high and reduce AI calls.
    if lexical_score < 0.2:
        return round(min(0.89, lexical_score), 4), _empty_usage()

    if client is None:
        return round(min(0.89, lexical_score), 4), _empty_usage()

    prompt = (
        "You are a strict relevance judge. Score how well this item matches the user query. "
        "Return JSON only: {\"score\": 0.0 to 1.0}. "
        "Use 0.90+ only when the item is strongly and directly about the same topic.\n\n"
        f"Query: {query}\n\n"
        f"Item:\n{context}"
    )

    try:
        t0 = time.time()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        latency_ms = int((time.time() - t0) * 1000)
        text = _extract_response_text(response)
        usage_counts = _usage_from_response(response)
        payload = _extract_json(text)
        
        # --- Langfuse ---
        lf = get_langfuse()
        if lf:
            usage = getattr(response, "usage_metadata", None)
            lf.generation(
                name="score_relevance",
                model=GEMINI_MODEL,
                input=prompt,
                output=text,
                trace_id=trace_id,
                usage={
                    "input": getattr(usage, "prompt_token_count", 0),
                    "output": getattr(usage, "candidates_token_count", 0),
                    "total": getattr(usage, "total_token_count", 0),
                    "unit": "TOKENS",
                },
                latency=latency_ms,
            )

        ai_score = float((payload or {}).get("score", 0.0)) if isinstance(payload, dict) else 0.0
        ai_score = max(0.0, min(1.0, ai_score))
        # Blend with lexical guardrail so off-topic generative drift stays controlled.
        blended = (0.75 * ai_score) + (0.25 * lexical_score)
        return round(max(0.0, min(1.0, blended)), 4), usage_counts
    except Exception:
        return round(min(0.89, lexical_score), 4), _empty_usage()


async def _detect_query_context(query: str) -> dict:
    """Ask Ollama whether to add time/region context to this query.
    Returns dict with keys: needs_time (bool), needs_region (bool), region (str|None).
    Falls back to safe defaults (time=True, region=False) on any error.
    """
    from app.core.ollama_client import get_llm_client, get_active_model
    try:
        _client = get_llm_client()
        _model = get_active_model()
    except Exception:
        return {"needs_time": True, "needs_region": False, "region": None}

    prompt = (
        f'Query: "{query}"\n\n'
        f'Answer about this news search query:\n'
        f'1. NEEDS_TIME: Will adding the current month and year make results more relevant? YES or NO\n'
        f'2. NEEDS_REGION: Does this query refer to a specific country or region? YES or NO\n'
        f'3. REGION: If YES for region, name it (e.g. India, US, Europe, China). Otherwise write NONE\n\n'
        f'Reply ONLY in this exact format (one line):\n'
        f'NEEDS_TIME:YES NEEDS_REGION:YES REGION:India'
    )
    try:
        resp = await asyncio.to_thread(
            _client.models.generate_content,
            model=_model,
            contents=prompt,
        )
        text = _extract_response_text(resp).strip()
        needs_time = "NEEDS_TIME:YES" in text.upper()
        needs_region = "NEEDS_REGION:YES" in text.upper()
        region_match = _re.search(r'REGION:(\w[\w\s]*)', text, _re.IGNORECASE)
        region = region_match.group(1).strip() if region_match else None
        if region and region.upper() in ("NONE", "N/A", ""):
            region = None
        return {"needs_time": needs_time, "needs_region": needs_region, "region": region}
    except Exception as _e:
        logger.warning(f"[BROWSER] query context detection failed: {_e}")
        return {"needs_time": True, "needs_region": False, "region": None}


async def _batch_title_filter(
    items: list[BlogItem],
    query: str,
) -> tuple[list[BlogItem], str]:
    """One LLM call — sends only titles, gets back which ones are relevant.
    Falls back to keeping all items if the model output can't be parsed."""
    import re as _re
    if not items:
        return items, "0 items"

    from app.core.ollama_client import get_llm_client, get_active_model
    try:
        _client = get_llm_client()
        _model = get_active_model()
    except Exception:
        return items, "skipped (no client)"

    # Only titles, truncated to keep the prompt short
    lines = [f"{i+1}. [{it.source}] {it.title[:120]}" for i, it in enumerate(items)]
    numbered = "\n".join(lines)

    # Simple YES/NO format — small models (llama3.2:1b) handle this more reliably
    # than JSON. Each item gets YES (on-topic) or NO (off-topic).
    prompt = (
        f'A user searched for: "{query}"\n\n'
        f'For each item below, answer YES if it is a useful result for that search, '
        f'NO if it does not match what the user was looking for.\n'
        f'Reply ONLY with: 1:YES 2:NO 3:YES ... (number colon YES or NO for every item)\n\n'
        f'{numbered}'
    )

    try:
        resp = await asyncio.to_thread(
            _client.models.generate_content,
            model=_model,
            contents=prompt,
        )
        text = _extract_response_text(resp)

        # Parse "1:YES 2:NO 3:YES" format
        pairs = _re.findall(r'(\d+)\s*[:.\-]\s*(YES|NO|yes|no|Yes|No)', text)
        if pairs:
            keep_nums = {int(n) for n, verdict in pairs if verdict.upper() == "YES"}
        else:
            # Fallback: bare numbers in the response = kept items
            keep_nums = {int(n) for n in _re.findall(r'\b(\d+)\b', text)
                         if 1 <= int(n) <= len(items)}

        if keep_nums:
            kept = [it for i, it in enumerate(items) if (i + 1) in keep_nums]
            # Trust the AI as long as it kept at least 3 items.
            # Old 25%-threshold was wrong: a specific query like "India aircraft engine"
            # legitimately has only 4-6 relevant posts out of 35 — filtering to 5 is correct,
            # not a misfire. Only truly misfired if AI says <3 items are relevant.
            if len(kept) >= 3:
                dropped = len(items) - len(kept)
                return kept, f"AI kept {len(kept)}/{len(items)}, dropped {dropped} off-topic"
    except Exception as _e:
        logger.warning(f"[BROWSER] batch title filter failed: {_e}")

    return items, f"AI filter skipped, kept all {len(items)}"


async def _filter_by_relevance(
    blogs: list[BlogItem],
    query: str,
    threshold: float,
    client,
    trace_id: str = None,
) -> tuple[list[BlogItem], dict[str, int]]:
    if threshold <= 0:
        # Filtering disabled: keep all collected items and skip relevance-scoring LLM calls.
        return blogs, _empty_usage()

    semaphore = asyncio.Semaphore(8)

    async def evaluate(blog: BlogItem):
        async with semaphore:
            score, usage_counts = await asyncio.to_thread(_score_blog_relevance, query, blog, client, trace_id)
            return blog, score, usage_counts

    scored = await asyncio.gather(*[evaluate(blog) for blog in blogs]) if blogs else []
    usage_totals = _empty_usage()

    kept = []
    for blog, score, usage_counts in scored:
        _merge_usage(usage_totals, usage_counts)
        if score < threshold:
            continue
        if hasattr(blog, "model_dump"):
            payload = blog.model_dump()
        else:
            payload = blog.dict()
        payload["relevance_score"] = score
        kept.append(BlogItem(**payload))

    # Keep UX stable: if strict filtering removes everything, return top scored items.
    if not kept and scored:
        fallback = sorted(scored, key=lambda x: x[1], reverse=True)[:8]
        for blog, score, _ in fallback:
            if hasattr(blog, "model_dump"):
                payload = blog.model_dump()
            else:
                payload = blog.dict()
            payload["relevance_score"] = score
            kept.append(BlogItem(**payload))

    kept.sort(key=lambda x: x.relevance_score or 0.0, reverse=True)
    return kept, usage_totals


async def _fetch_reddit_posts_for_community(
    community: str,
    query: str,
    posts_per_community: int,
    client,
    trace_id: str = None,
) -> tuple[list[BlogItem], dict[str, int], str]:
    import aiohttp

    safe_limit = max(1, min(int(posts_per_community or 1), 50))
    _proxy, _proxy_auth = _parse_proxy(settings.REDDIT_PROXY_URL)
    proxy_label = "proxy" if _proxy else "no-proxy"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

    # Use meaningful keywords (strip stop words) so subreddit search gets real terms
    meaningful_terms = _tokenize_meaningful(query)
    short_query = " ".join(list(meaningful_terms)[:6]) if meaningful_terms else " ".join(query.split()[:4])
    diag: list[str] = []
    used_hot_fallback = False

    posts_data: list[dict] = []
    async with aiohttp.ClientSession(headers=headers) as session:
        # ── Try subreddit search (past week) ──────────────────────────
        try:
            search_url = f"https://www.reddit.com/r/{community}/search.json"
            async with session.get(
                search_url,
                params={"q": short_query, "restrict_sr": "1", "sort": "top", "t": "week", "limit": str(safe_limit * 2)},
                timeout=aiohttp.ClientTimeout(total=15),
                proxy=_proxy, proxy_auth=_proxy_auth,
            ) as resp:
                diag.append(f"search HTTP {resp.status} ({proxy_label})")
                if resp.status == 200:
                    payload = await resp.json()
                    posts_data = [n["data"] for n in ((payload.get("data") or {}).get("children") or []) if n.get("data")]
                    diag.append(f"search returned {len(posts_data)} posts")
                else:
                    body_preview = (await resp.text())[:120]
                    logger.warning(f"[REDDIT] r/{community} search HTTP {resp.status} ({proxy_label}): {body_preview}")
        except Exception as exc:
            diag.append(f"search error: {exc}")
            logger.warning(f"[REDDIT] r/{community} search exception ({proxy_label}): {exc}")

        # ── Fallback: subreddit hot posts if search empty ──────────────
        if not posts_data:
            used_hot_fallback = True
            try:
                hot_url = f"https://www.reddit.com/r/{community}/hot.json"
                async with session.get(
                    hot_url,
                    params={"limit": str(safe_limit * 3)},
                    timeout=aiohttp.ClientTimeout(total=15),
                    proxy=_proxy, proxy_auth=_proxy_auth,
                ) as resp:
                    diag.append(f"hot HTTP {resp.status} ({proxy_label})")
                    if resp.status == 200:
                        payload = await resp.json()
                        posts_data = [n["data"] for n in ((payload.get("data") or {}).get("children") or []) if n.get("data")]
                        diag.append(f"hot returned {len(posts_data)} posts")
                    else:
                        body_preview = (await resp.text())[:120]
                        logger.warning(f"[REDDIT] r/{community} hot HTTP {resp.status} ({proxy_label}): {body_preview}")
            except Exception as exc:
                diag.append(f"hot error: {exc}")
                logger.warning(f"[REDDIT] r/{community} hot exception ({proxy_label}): {exc}")

    diag_str = " | ".join(diag)
    if not posts_data:
        logger.warning(f"[REDDIT] r/{community} — 0 posts. Diagnostics: {diag_str}")
        return [], _empty_usage(), diag_str

    # When we fell back to hot posts (not a topic search), keyword-filter before summarising
    # so we don't spend LLM calls on off-topic posts
    if used_hot_fallback and meaningful_terms:
        posts_data = [
            d for d in posts_data
            if meaningful_terms.intersection(_tokenize_meaningful(d.get("title", "") + " " + (d.get("selftext") or "")))
        ]

    usage_totals = _empty_usage()
    posts = []
    for data in posts_data[:safe_limit]:
        title = (data.get("title") or "Untitled").strip()
        selftext = data.get("selftext") or ""
        summary, usage_counts = await asyncio.to_thread(_summarize_text, title, selftext, client, trace_id)
        _merge_usage(usage_totals, usage_counts)
        permalink = data.get("permalink") or ""
        post_url = f"https://www.reddit.com{permalink}" if permalink else (data.get("url") or "")
        posts.append(
            BlogItem(
                source="reddit",
                title=title,
                summary=summary,
                url=post_url,
                community=community,
                author=data.get("author") or None,
                score=int(data.get("score") or 0),
                comments=int(data.get("num_comments") or 0),
                published_at=None,
            )
        )

    posts.sort(key=lambda p: ((p.score or 0), (p.comments or 0)), reverse=True)
    return posts[:safe_limit], usage_totals, ""


async def _fetch_reddit_global_search(
    query: str,
    limit: int = 25,
    client=None,
    trace_id: str = None,
    search_query: str = None,
) -> tuple[list[BlogItem], dict[str, int]]:
    """Search all of Reddit by query — relevant for any topic, no subreddit selection needed."""
    import aiohttp
    safe_limit = min(max(limit, 1), 30)
    _proxy, _proxy_auth = _parse_proxy(settings.REDDIT_PROXY_URL or "")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    kw = list(_tokenize_meaningful(query))
    # Use caller-supplied search_query if given (pre-built with year/context)
    short_query = search_query if search_query else (" ".join(kw[:6]) if kw else " ".join(query.split()[:6]))

    posts_data: list[dict] = []
    async with aiohttp.ClientSession(headers=headers) as session:
        # Primary: relevance sort past week — ranks by how well the post matches the query,
        # not by how many upvotes it got. This is the most important fix for accuracy:
        # "top" returns popular posts that mention a keyword; "relevance" returns posts
        # that are actually ABOUT the topic.
        try:
            async with session.get(
                "https://www.reddit.com/search.json",
                params={"q": short_query, "sort": "relevance", "t": "week", "limit": str(safe_limit * 2)},
                timeout=aiohttp.ClientTimeout(total=20),
                proxy=_proxy,
                proxy_auth=_proxy_auth,
            ) as resp:
                if resp.status == 200:
                    payload = await resp.json()
                    posts_data = [n["data"] for n in ((payload.get("data") or {}).get("children") or []) if n.get("data")]
        except Exception:
            pass

        # Fallback: top posts past week
        if not posts_data:
            try:
                async with session.get(
                    "https://www.reddit.com/search.json",
                    params={"q": short_query, "sort": "top", "t": "week", "limit": str(safe_limit * 2)},
                    timeout=aiohttp.ClientTimeout(total=20),
                    proxy=_proxy,
                    proxy_auth=_proxy_auth,
                ) as resp:
                    if resp.status == 200:
                        payload = await resp.json()
                        posts_data = [n["data"] for n in ((payload.get("data") or {}).get("children") or []) if n.get("data")]
            except Exception:
                pass

        # Last resort: newest posts past month
        if not posts_data:
            try:
                async with session.get(
                    "https://www.reddit.com/search.json",
                    params={"q": short_query, "sort": "new", "t": "month", "limit": str(safe_limit * 2)},
                    timeout=aiohttp.ClientTimeout(total=20),
                    proxy=_proxy,
                    proxy_auth=_proxy_auth,
                ) as resp:
                    if resp.status == 200:
                        payload = await resp.json()
                        posts_data = [n["data"] for n in ((payload.get("data") or {}).get("children") or []) if n.get("data")]
            except Exception:
                pass

    if not posts_data:
        return [], _empty_usage()

    # ── Dedup by URL/permalink AND by title (catches crossposts) ──────────
    _seen_urls: set[str] = set()
    _seen_titles: set[str] = set()
    deduped: list[dict] = []
    for d in posts_data:
        _url_key = d.get("permalink") or d.get("url") or d.get("id") or ""
        _title_key = " ".join((d.get("title") or "").lower().split()[:8])  # first 8 words
        if (_url_key and _url_key in _seen_urls) or (_title_key and _title_key in _seen_titles):
            continue
        if _url_key:
            _seen_urls.add(_url_key)
        if _title_key:
            _seen_titles.add(_title_key)
        deduped.append(d)
    posts_data = deduped

    # ── Junk subreddit filter ────────────────────────────────────────────
    # Strip known off-topic communities (AITA, relationships, etc.) before
    # spending any LLM calls — these always pass keyword filters but are useless.
    posts_data = [d for d in posts_data if (d.get("subreddit") or "").lower() not in _JUNK_SUBREDDITS]

    # ── Title keyword filter ─────────────────────────────────────────────
    # Rule: at least one NON-LOCATION keyword must appear in the post title.
    # We never use the subreddit name as a match — that's how r/india posts
    # about relationships/AITA slip through even for aircraft-engine queries.
    _LOCATION_WORDS = {"india", "indian", "pakistan", "china", "chinese", "us", "usa", "american", "uk", "british", "russia", "russian"}
    meaningful_kw = set(kw)
    non_loc_kw = meaningful_kw - _LOCATION_WORDS  # keywords that actually describe the topic

    if meaningful_kw:
        filtered: list[dict] = []
        for d in posts_data:
            title_kw = _tokenize_meaningful(d.get("title", ""))
            if non_loc_kw:
                # Topic has specific non-location keywords (e.g. "aircraft", "engine")
                # → title must contain at least one of them
                if not non_loc_kw.intersection(title_kw):
                    continue
            else:
                # Query is only location words (e.g. "india news") — fall back to
                # requiring any meaningful keyword at all in the title
                if not meaningful_kw.intersection(title_kw):
                    continue
            filtered.append(d)
        # Never fall back to unfiltered — empty is better than 30 junk posts
        posts_data = filtered

    usage_totals = _empty_usage()
    posts = []
    for data in posts_data[:safe_limit]:
        title = (data.get("title") or "Untitled").strip()
        selftext = data.get("selftext") or ""
        summary, usage_counts = await asyncio.to_thread(_summarize_text, title, selftext, client, trace_id)
        _merge_usage(usage_totals, usage_counts)
        permalink = data.get("permalink") or ""
        post_url = f"https://www.reddit.com{permalink}" if permalink else (data.get("url") or "")
        community = (data.get("subreddit") or "").strip()
        posts.append(
            BlogItem(
                source="reddit",
                title=title,
                summary=summary,
                url=post_url,
                community=community,
                author=data.get("author") or None,
                score=int(data.get("score") or 0),
                comments=int(data.get("num_comments") or 0),
                published_at=None,
            )
        )

    posts.sort(key=lambda p: ((p.score or 0), (p.comments or 0)), reverse=True)
    return posts[:safe_limit], usage_totals


@router.post("/run", response_model=BrowserResearchResponse)
async def run_browser_research(request: BrowserResearchRequest, db: Session = Depends(get_db)):
    query = request.query.strip()
    if not request.youtube_channels:
        raise HTTPException(status_code=400, detail="At least one YouTube channel is required")

    lf = get_langfuse()
    trace = None
    if lf:
        trace = lf.trace(
            name="browser_research",
            input={"query": query, "youtube_channels": request.youtube_channels},
            tags=["research"],
        )

    t_start = time.time()
    client = _get_genai_client()
    run_id = str(uuid4())
    trace_id = trace.id if trace else None
    llm_model = GEMINI_MODEL if client else None
    usage_totals = _empty_usage()

    selected_communities, communities_usage = _pick_reddit_communities_with_gemini(query, request.reddit_communities_limit, trace_id)
    _merge_usage(usage_totals, communities_usage)

    reddit_tasks = [
        _fetch_reddit_posts_for_community(
            community=c,
            query=query,
            posts_per_community=request.reddit_posts_per_community,
            client=client,
            trace_id=trace_id,
        )
        for c in selected_communities
    ]
    reddit_batches = await asyncio.gather(*reddit_tasks)
    reddit_blogs = [item for batch, _, _d in reddit_batches for item in batch]
    for _, usage_counts, _ in reddit_batches:
        _merge_usage(usage_totals, usage_counts)

    yt_payload = await youtube_scraping_service.scrape_channels(
        channels=request.youtube_channels,
        videos_per_channel=request.youtube_videos_per_channel,
        summarize=True,
        trace_id=trace_id,
        return_usage=True,
    )
    yt_results = yt_payload.get("channel_results", []) if isinstance(yt_payload, dict) else []
    _merge_usage(usage_totals, yt_payload.get("usage") if isinstance(yt_payload, dict) else None)
    youtube_blogs = []
    for channel_result in yt_results:
        channel_name = channel_result.get("channel_title") or channel_result.get("channel_input") or "channel"
        for video in channel_result.get("videos", []):
            youtube_blogs.append(
                BlogItem(
                    source="youtube",
                    title=(video.get("title") or "Untitled").strip(),
                    summary=(video.get("summary") or "").strip() or "No summary available",
                    url=(video.get("video_url") or "").strip(),
                    channel=channel_name,
                    published_at=video.get("published_at"),
                )
            )

    news_blogs = []
    if request.news_count > 0:
        rows = db.query(Article).order_by(func.random()).limit(request.news_count).all()
        for row in rows:
            news_blogs.append(
                BlogItem(
                    source="news",
                    title=row.title,
                    summary=(row.summary or row.content or "").strip()[:500] or "No summary available",
                    url=row.source_url,
                    published_at=row.published_at.isoformat() if row.published_at else None,
                )
            )

    blogs = reddit_blogs + youtube_blogs + news_blogs
    blogs, relevance_usage = await _filter_by_relevance(
        blogs=blogs,
        query=query,
        threshold=request.relevance_threshold,
        client=client,
        trace_id=trace_id,
    )
    _merge_usage(usage_totals, relevance_usage)

    estimated_cost_usd = _estimate_cost_usd(
        usage_totals["prompt_tokens"],
        usage_totals["output_tokens"],
    )
    usage_schema = _usage_to_schema(llm_model, usage_totals, estimated_cost_usd)

    run_row = BrowserResearchRun(
        run_id=run_id,
        query=query,
        selected_reddit_communities=json.dumps(selected_communities, ensure_ascii=True),
        youtube_channels_used=json.dumps(request.youtube_channels, ensure_ascii=True),
        total_blogs=len(blogs),
    )
    db.add(run_row)
    db.add(
        BrowserResearchRunMetric(
            run_id=run_id,
            llm_model=llm_model,
            llm_calls=usage_schema.calls,
            prompt_tokens=usage_schema.prompt_tokens,
            output_tokens=usage_schema.output_tokens,
            total_tokens=usage_schema.total_tokens,
            estimated_cost_usd=f"{usage_schema.estimated_cost_usd:.6f}",
        )
    )
    for blog in blogs:
        db.add(
            BrowserResearchItem(
                run_id=run_id,
                source=blog.source,
                title=blog.title,
                summary=blog.summary,
                url=blog.url,
                community=blog.community,
                channel=blog.channel,
                author=blog.author,
                score=blog.score,
                comments=blog.comments,
                published_at=blog.published_at,
            )
        )
    db.commit()

    result = BrowserResearchResponse(
        run_id=run_id,
        query=query,
        selected_reddit_communities=selected_communities,
        youtube_channels_used=request.youtube_channels,
        total_blogs=len(blogs),
        generated_at=datetime.now(),
        llm_usage=usage_schema,
        blogs=blogs,
    )

    if trace:
        try:
            trace.update(
                output=result.model_dump() if hasattr(result, "model_dump") else result.dict(),
                metadata={"latency_ms": int((time.time() - t_start) * 1000)},
            )
            lf.flush()
        except Exception as e:
            logger.warning(f"[LANGFUSE] Failed to update trace: {e}")

    return result


@router.post("/run-stream")
async def run_browser_research_stream(request: BrowserResearchRequest, db: Session = Depends(get_db)):
    async def event_generator():
        def emit(msg_type: str, payload) -> str:
            return f"data: {json.dumps({'type': msg_type, 'payload': payload})}\n\n"

        try:
            query = request.query.strip()
            client = _get_genai_client()
            run_id = str(uuid4())
            usage_totals = _empty_usage()

            yield emit("step", "Asking Gemini AI to select best Reddit communities for your query...")
            selected_communities, communities_usage = await asyncio.to_thread(
                _pick_reddit_communities_with_gemini, query, request.reddit_communities_limit
            )
            _merge_usage(usage_totals, communities_usage)
            yield emit("step", f"Selected {len(selected_communities)} communities: {', '.join(f'r/{c}' for c in selected_communities)}")

            reddit_blogs = []
            for community in selected_communities:
                yield emit("step", f"Fetching posts from r/{community}...")
                posts, usage_counts, _diag = await _fetch_reddit_posts_for_community(
                    community=community,
                    query=query,
                    posts_per_community=request.reddit_posts_per_community,
                    client=client,
                )
                _merge_usage(usage_totals, usage_counts)
                reddit_blogs.extend(posts)
                yield emit("step", f"  → Got {len(posts)} posts from r/{community}")

            yield emit("step", f"Collected {len(reddit_blogs)} Reddit posts total")

            youtube_blogs = []
            for channel in request.youtube_channels:
                yield emit("step", f"Scraping YouTube channel: {channel}...")
                yt_payload = await youtube_scraping_service.scrape_channels(
                    channels=[channel],
                    videos_per_channel=request.youtube_videos_per_channel,
                    summarize=True,
                    return_usage=True,
                )
                yt_results = yt_payload.get("channel_results", []) if isinstance(yt_payload, dict) else []
                _merge_usage(usage_totals, yt_payload.get("usage") if isinstance(yt_payload, dict) else None)
                for channel_result in yt_results:
                    channel_name = channel_result.get("channel_title") or channel_result.get("channel_input") or channel
                    for video in channel_result.get("videos", []):
                        youtube_blogs.append(BlogItem(
                            source="youtube",
                            title=(video.get("title") or "Untitled").strip(),
                            summary=(video.get("summary") or "").strip() or "No summary available",
                            url=(video.get("video_url") or "").strip(),
                            channel=channel_name,
                            published_at=video.get("published_at"),
                        ))
                yield emit("step", f"  → Got {len(yt_results[0].get('videos', [])) if yt_results else 0} video(s) from {channel}")

            yield emit("step", f"Collected {len(youtube_blogs)} YouTube videos total")

            news_blogs = []
            if request.news_count > 0:
                yield emit("step", f"Loading {request.news_count} news articles from database...")
                rows = db.query(Article).order_by(func.random()).limit(request.news_count).all()
                for row in rows:
                    news_blogs.append(BlogItem(
                        source="news",
                        title=row.title,
                        summary=(row.summary or row.content or "").strip()[:500] or "No summary available",
                        url=row.source_url,
                        published_at=row.published_at.isoformat() if row.published_at else None,
                    ))
                yield emit("step", f"  → Loaded {len(news_blogs)} news articles")

            all_blogs = reddit_blogs + youtube_blogs + news_blogs
            yield emit("step", f"Scoring relevance for {len(all_blogs)} total items (threshold: {request.relevance_threshold})...")
            blogs, relevance_usage = await _filter_by_relevance(
                blogs=all_blogs, query=query, threshold=request.relevance_threshold, client=client
            )
            _merge_usage(usage_totals, relevance_usage)
            yield emit("step", f"  → Kept {len(blogs)} items after relevance filtering")

            estimated_cost_usd = _estimate_cost_usd(usage_totals["prompt_tokens"], usage_totals["output_tokens"])
            usage_schema = _usage_to_schema(GEMINI_MODEL if client else None, usage_totals, estimated_cost_usd)

            yield emit("step", "Saving run to database...")
            run_row = BrowserResearchRun(
                run_id=run_id,
                query=query,
                selected_reddit_communities=json.dumps(selected_communities, ensure_ascii=True),
                youtube_channels_used=json.dumps(request.youtube_channels, ensure_ascii=True),
                total_blogs=len(blogs),
            )
            db.add(run_row)
            db.add(BrowserResearchRunMetric(
                run_id=run_id,
                llm_model=usage_schema.model,
                llm_calls=usage_schema.calls,
                prompt_tokens=usage_schema.prompt_tokens,
                output_tokens=usage_schema.output_tokens,
                total_tokens=usage_schema.total_tokens,
                estimated_cost_usd=f"{usage_schema.estimated_cost_usd:.6f}",
            ))
            for blog in blogs:
                db.add(BrowserResearchItem(
                    run_id=run_id, source=blog.source, title=blog.title, summary=blog.summary,
                    url=blog.url, community=blog.community, channel=blog.channel,
                    author=blog.author, score=blog.score, comments=blog.comments, published_at=blog.published_at,
                ))
            db.commit()
            yield emit("step", f"Done! Research complete — {len(blogs)} items found")

            result = BrowserResearchResponse(
                run_id=run_id,
                query=query,
                selected_reddit_communities=selected_communities,
                youtube_channels_used=request.youtube_channels,
                total_blogs=len(blogs),
                generated_at=datetime.now(),
                llm_usage=usage_schema,
                blogs=blogs,
            )
            yield emit("result", json.loads(result.model_dump_json()))

        except asyncio.InvalidStateError:
            logger.debug("[BROWSER-RESEARCH-STREAM] Playwright cleanup InvalidStateError suppressed")
        except Exception as exc:
            logger.exception("[BROWSER-RESEARCH-STREAM] Unexpected error")
            yield emit("error", str(exc))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/live-browser-stream")
async def run_live_browser_stream(
    request: LiveBrowserRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    async def event_generator():
        def emit(t: str, p) -> str:
            return f"data: {json.dumps({'type': t, 'payload': p})}\n\n"

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            yield emit("error", "playwright not installed — run: pip install playwright && playwright install chromium")
            return

        query = request.query.strip()
        client = _get_genai_client()
        # With Ollama on a small VM each summarization call takes 15-25s.
        # Skip per-item summarization (30-40 calls = 10-20 min) and use
        # raw text fallback instead. Keep only the 2 fast planning calls.
        _sum_client = None if settings.USE_OLLAMA else client
        run_id = str(uuid4())
        usage_totals = _empty_usage()
        all_raw: list[dict] = []

        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(
                    headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
                )
                _ctx_kwargs = dict(
                    viewport={"width": 1280, "height": 760},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )

                # Build search string: strip leading question phrases that add no
                # search value, keep all intent words ("updates", "latest", etc.)
                yield emit("step", "Analysing query context...")
                import re as _re2
                _cleaned = query.strip().rstrip("?").strip()
                _cleaned = _re2.sub(
                    r'^(what (is|are|was|were|will|would|about)|how (do|does|did|can|to)|'
                    r'why (is|are|did|does)|where (is|are)|when (did|is|will)|'
                    r'tell me about|give me|show me|find me|search for)\s+',
                    '', _cleaned, flags=_re2.IGNORECASE,
                )
                _search_str = " ".join(_cleaned.split()[:12])  # cap at 12 words

                # Tokenized keywords — stopwords stripped, used for Reddit/Twitter
                # so common words like "new", "updates", "on" don't pollute the query
                # and Reddit doesn't return random popular posts matching "new" or "on"
                _kw = list(_tokenize_meaningful(query))
                _kw_str = " ".join(_kw[:6]) if _kw else _search_str

                _news_intent = {"update", "updates", "news", "latest", "recent", "current", "today"}
                _query_words = set(query.lower().split())
                _has_news_intent = bool(_query_words & _news_intent)
                _now = datetime.now()
                _year = _now.year
                _month = _now.strftime("%B")

                # Ask AI whether to attach time/region context for this query
                _ctx = await _detect_query_context(query)
                _time_suffix = f"{_month} {_year}" if _ctx["needs_time"] else ""
                _region_suffix = _ctx["region"] if _ctx["needs_region"] and _ctx["region"] else ""
                _context_suffix = " ".join(filter(None, [_region_suffix, _time_suffix]))

                yield emit("step", (
                    f"Query: '{_search_str}'"
                    + (f" | region: {_region_suffix}" if _region_suffix else "")
                    + (f" | time: {_time_suffix}" if _time_suffix else "")
                ))

                # ── Per-source queries ─────────────────────────────────────
                # YouTube/News: use natural language (search engines handle it well)
                _yt_ctx = " ".join(filter(None, [_region_suffix, str(_year)]))
                if _has_news_intent:
                    yt_query: str = f"{_search_str} {_yt_ctx}".strip()
                else:
                    yt_query: str = f"{_search_str} news {_yt_ctx}".strip()

                # Reddit / Twitter: use ONLY tokenized keywords (not natural language).
                # Sending "new updates on biotechnology" to Reddit makes it return any
                # popular post with "new" or "on" — which is everything. Strip to core.
                reddit_query: str = f"{_kw_str} {_context_suffix}".strip()
                twitter_query: str = f"{_kw_str} {_context_suffix}".strip()

                # News RSS (Bing/Google): already date-filtered at source —
                # only add region if AI detected one.
                news_query: str = f"{_search_str} {_region_suffix}".strip() if _region_suffix else _search_str

                sem = asyncio.Semaphore(5)

                # ── PHASE 1: Reddit direct search (no community selection) ──
                yield emit("step", f"Searching Reddit: '{reddit_query}'...")
                reddit_blogs, reddit_usage = await _fetch_reddit_global_search(
                    query, limit=5, client=_sum_client, search_query=reddit_query
                )
                # Keep only the top 2 by score — Reddit is opinion/community, not primary source
                reddit_blogs = sorted(reddit_blogs, key=lambda p: p.score or 0, reverse=True)[:2]
                _merge_usage(usage_totals, reddit_usage)
                yield emit("step", f"  → {len(reddit_blogs)} Reddit posts (top 2 by score)")

                # Launch browser for YouTube + News phases
                yield emit("step", "Launching browser for YouTube + News...")
                _clean_ctx = await browser.new_context(**_ctx_kwargs)
                page = await _clean_ctx.new_page()

                async def snap() -> str:
                    png = await page.screenshot(type="jpeg", quality=55, full_page=False)
                    return base64.b64encode(png).decode()

                async def nav(url: str, wait: str = "domcontentloaded", t: int = 30000) -> list[str]:
                    events = [emit("url", url)]
                    try:
                        await page.goto(url, wait_until=wait, timeout=t)
                        await asyncio.sleep(2)
                        events.append(emit("screenshot", await snap()))
                    except Exception as e:
                        logger.warning(f"[BROWSER] nav failed {url}: {e}")
                    return events

                # ── PHASE 2: YouTube search ────────────────────────────────
                youtube_blogs: list[BlogItem] = []
                try:
                    yt_url = f"https://www.youtube.com/results?search_query={quote_plus(yt_query)}&sp=CAI%3D"
                    yield emit("step", f"YouTube search (newest first): '{yt_query}'")
                    for ev in await nav(yt_url, t=40000):
                        yield ev
                    yield emit("step", "YouTube page loaded, extracting videos...")
                    await asyncio.sleep(3)
                    await page.evaluate("window.scrollBy(0, 800)")
                    await asyncio.sleep(1)

                    videos_raw = await page.evaluate("""
                        () => {
                            // Tier 0: today/hours/1-2 days ago (fresh)
                            const FRESH = /\\d+ (second|minute|hour)s? ago|^1 day ago|^2 days? ago/i;
                            // Tier 1: this week (3-7 days)
                            const THIS_WEEK = /[3-7] days? ago/i;
                            // Tier 3: old (weeks/months/years) — kept as last-resort fallback
                            const OLD = /\\d+ (week|month|year)s? ago/i;

                            const all = [];
                            document.querySelectorAll('ytd-video-renderer').forEach(el => {
                                const titleEl = el.querySelector('a#video-title');
                                const channelEl = el.querySelector('ytd-channel-name a, #channel-name a');
                                const spans = el.querySelectorAll('#metadata-line span');
                                if (!titleEl) return;
                                const href = titleEl.getAttribute('href') || '';
                                const title = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
                                const metaText = [...spans].map(s=>s.textContent.trim()).join(' | ');
                                if (!title || !href.includes('watch')) return;
                                // Tier: 0=fresh, 1=this week, 2=unclassified, 3=old
                                const tier = FRESH.test(metaText) ? 0
                                           : THIS_WEEK.test(metaText) ? 1
                                           : OLD.test(metaText) ? 3 : 2;
                                all.push({
                                    title,
                                    url: href.startsWith('http') ? href : 'https://www.youtube.com' + href,
                                    channel: channelEl?.textContent.trim() || '',
                                    description: el.querySelector('#description-text')?.textContent.trim() || '',
                                    meta: metaText,
                                    tier,
                                });
                            });

                            all.sort((a, b) => a.tier - b.tier);
                            const primary = all.filter(v => v.tier <= 1);   // fresh + this week
                            const fallback = all.filter(v => v.tier > 1);   // unclassified or old
                            // Always return something — fill with older content if <4 fresh
                            const fill = primary.length < 4 ? fallback.slice(0, 5 - primary.length) : [];
                            return [...primary, ...fill].slice(0, 8);
                        }
                    """)
                    yield emit("step", f"  → {len(videos_raw)} YouTube videos found")

                    if videos_raw:
                        yield emit("step", f"Summarizing {len(videos_raw)} YouTube videos with LLM...")
                        async def summarize_video(v: dict) -> BlogItem:
                            async with sem:
                                body = f"{v.get('description','')} {v.get('meta','')}".strip()
                                summary, u = await asyncio.to_thread(_summarize_text, v["title"], body, _sum_client)
                                _merge_usage(usage_totals, u)
                                return BlogItem(source="youtube", title=v["title"], summary=summary,
                                                url=v["url"], channel=v.get("channel",""))
                        youtube_blogs = list(await asyncio.gather(*[summarize_video(v) for v in videos_raw]))
                        yield emit("step", f"  → {len(youtube_blogs)} YouTube videos summarized")
                except Exception as _yt_err:
                    logger.warning(f"[BROWSER] YouTube phase failed: {_yt_err}")
                    yield emit("step", f"  → YouTube failed ({type(_yt_err).__name__}: {str(_yt_err)[:120]})")

                # ── PHASE 3: Bing News RSS (no browser — more reliable than HTML scraping) ──
                news_blogs: list[BlogItem] = []
                try:
                    import aiohttp as _aiohttp_bing
                    import xml.etree.ElementTree as _ET_bing
                    import email.utils as _eutils
                    from datetime import timezone as _tz, timedelta as _td
                    _two_days_ago = datetime.now(_tz.utc) - _td(days=2)
                    bing_rss_url = f"https://www.bing.com/news/search?q={quote_plus(news_query)}&format=RSS"
                    yield emit("step", f"Bing News RSS (past 2d): '{news_query}'")
                    async with _aiohttp_bing.ClientSession(headers={"User-Agent": "Mozilla/5.0"}) as _bsess:
                        async with _bsess.get(bing_rss_url, timeout=_aiohttp_bing.ClientTimeout(total=15)) as _bresp:
                            if _bresp.status == 200:
                                _brss = await _bresp.text()
                                _broot = _ET_bing.fromstring(_brss)
                                bing_raw = []
                                for _item in _broot.findall(".//item")[:15]:
                                    _btitle = (_item.findtext("title") or "").strip()
                                    _blink = (_item.findtext("link") or "").strip()
                                    _bdesc = (_item.findtext("description") or "")[:300].strip()
                                    _bpub = (_item.findtext("pubDate") or "").strip()
                                    if not _btitle or not _blink:
                                        continue
                                    # Date filter: skip if older than 2 days
                                    try:
                                        _bdt = _eutils.parsedate_to_datetime(_bpub).astimezone(_tz.utc)
                                        if _bdt < _two_days_ago:
                                            continue
                                    except Exception:
                                        pass  # keep if unparseable
                                    bing_raw.append({"title": _btitle, "url": _blink, "snippet": _bdesc})
                                yield emit("step", f"  → {len(bing_raw)} Bing News articles found")
                                if bing_raw:
                                    async def _sum_bing(a: dict) -> BlogItem:
                                        async with sem:
                                            summary, u = await asyncio.to_thread(_summarize_text, a["title"], a.get("snippet", ""), _sum_client)
                                            _merge_usage(usage_totals, u)
                                            return BlogItem(source="news", title=a["title"], summary=summary, url=a["url"])
                                    news_blogs = list(await asyncio.gather(*[_sum_bing(a) for a in bing_raw]))
                except Exception as _bing_err:
                    logger.warning(f"[BROWSER] Bing News RSS failed: {_bing_err}")
                    yield emit("step", f"  → Bing News RSS failed ({type(_bing_err).__name__}: {str(_bing_err)[:120]})")

                # ── PHASE 3b: Google News RSS ──────────────────────────────
                try:
                    import aiohttp as _aiohttp
                    import xml.etree.ElementTree as _ET
                    import re as _re
                    gnews_rss = f"https://news.google.com/rss/search?q={quote_plus(news_query)}+when:2d&hl=en-US&gl=US&ceid=US:en"
                    yield emit("step", f"Google News RSS: '{news_query}'")
                    async with _aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0"}) as _sess:
                        async with _sess.get(gnews_rss, timeout=_aiohttp.ClientTimeout(total=15)) as _resp:
                            if _resp.status == 200:
                                rss_text = await _resp.text()
                                root = _ET.fromstring(rss_text)
                                gnews_raw = []
                                for item in root.findall(".//item")[:12]:
                                    title = (item.findtext("title") or "").strip()
                                    link = (item.findtext("link") or "").strip()
                                    desc = _re.sub(r"<[^>]+>", "", item.findtext("description") or "")[:300].strip()
                                    if title and link and link.startswith("http"):
                                        gnews_raw.append({"title": title, "url": link, "snippet": desc})
                                yield emit("step", f"  → {len(gnews_raw)} Google News articles found")
                                if gnews_raw:
                                    async def _sum_gnews(a: dict) -> BlogItem:
                                        async with sem:
                                            summary, u = await asyncio.to_thread(_summarize_text, a["title"], a.get("snippet", ""), _sum_client)
                                            _merge_usage(usage_totals, u)
                                            return BlogItem(source="news", title=a["title"], summary=summary, url=a["url"])
                                    gnews_blogs = list(await asyncio.gather(*[_sum_gnews(a) for a in gnews_raw]))
                                    news_blogs.extend(gnews_blogs)
                except Exception as _e:
                    logger.warning(f"[BROWSER] Google News RSS failed: {_e}")

                yield emit("step", f"  → {len(news_blogs)} total news articles (Bing + Google)")

                # ── PHASE 3c: Hacker News (Algolia API — no browser needed) ──
                hn_blogs: list[BlogItem] = []
                try:
                    import aiohttp as _aiohttp_hn
                    import time as _time_hn
                    _hn_week_ago = int(_time_hn.time()) - 7 * 86400
                    _hn_q = _kw_str if _kw_str else _search_str
                    _hn_api = (
                        f"https://hn.algolia.com/api/v1/search_by_date"
                        f"?query={quote_plus(_hn_q)}&tags=story"
                        f"&hitsPerPage=10&numericFilters=created_at_i>{_hn_week_ago}"
                    )
                    yield emit("step", f"Hacker News (past week): '{_hn_q}'")
                    async with _aiohttp_hn.ClientSession(headers={"User-Agent": "Mozilla/5.0"}) as _hn_s:
                        async with _hn_s.get(_hn_api, timeout=_aiohttp_hn.ClientTimeout(total=10)) as _hn_r:
                            if _hn_r.status == 200:
                                _hn_data = await _hn_r.json()
                                _hn_hits = _hn_data.get("hits", [])
                                yield emit("step", f"  → {len(_hn_hits)} HN stories found")
                                for hit in _hn_hits:
                                    _hn_title = (hit.get("title") or "").strip()
                                    _hn_url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID','')}"
                                    _hn_text = (hit.get("story_text") or "")[:300]
                                    if not _hn_title:
                                        continue
                                    hn_blogs.append(BlogItem(
                                        source="hn",
                                        title=_hn_title,
                                        summary=_hn_text or f"Hacker News: {_hn_title}",
                                        url=_hn_url,
                                        channel="Hacker News",
                                        score=hit.get("points") or 0,
                                        comments=hit.get("num_comments") or 0,
                                    ))
                except Exception as _hn_err:
                    logger.warning(f"[BROWSER] HN phase failed: {_hn_err}")
                    yield emit("step", f"  → HN failed ({str(_hn_err)[:80]})")

                # ── PHASE 3d: Twitter/X ───────────────────────────────────────────────
                # Primary (no login): Bing web search site:twitter.com
                # Upgrade (optional): twscrape if TWITTER_* env vars are set
                # Last resort: Bing News RSS site:x.com
                twitter_blogs: list[BlogItem] = []
                try:
                    tw_raw = []
                    yield emit("step", f"Twitter/X search: '{twitter_query}'...")

                    # --- Attempt 1: Bing web search site:twitter.com (no login needed) ---
                    _tw_bing_q = f"site:twitter.com OR site:x.com {twitter_query}"
                    _tw_bing_url = f"https://www.bing.com/search?q={quote_plus(_tw_bing_q)}&freshness=Week"
                    for ev in await nav(_tw_bing_url, t=20000):
                        yield ev
                    await asyncio.sleep(2)
                    tw_raw = await page.evaluate("""
                        () => {
                            const items = [];
                            document.querySelectorAll('#b_results li.b_algo').forEach(el => {
                                const a = el.querySelector('h2 a');
                                const snippet = el.querySelector('.b_caption .b_snippet, .b_caption p, .b_dList dd');
                                if (!a) return;
                                const url = a.href || '';
                                const title = a.textContent.trim();
                                const text = (snippet?.textContent || '').trim();
                                if (!url.includes('twitter.com') && !url.includes('x.com')) return;
                                if (!title) return;
                                items.push({ title: (text || title).slice(0, 280), url, author: '' });
                            });
                            return items.slice(0, 12);
                        }
                    """)
                    if tw_raw:
                        yield emit("step", f"  → {len(tw_raw)} tweets via Bing web search")

                    # --- Attempt 2: twscrape (only if credentials set — full tweet text) ---
                    if not tw_raw:
                        _tw_api = await _get_twscrape_api()
                        if _tw_api:
                            try:
                                from twscrape import gather as _tw_gather
                                yield emit("step", "  → twscrape: authenticated search...")
                                _tweets = await _tw_gather(_tw_api.search(twitter_query, limit=12))
                                for t in _tweets:
                                    _text = (getattr(t, "rawContent", None) or "").strip()
                                    if len(_text) < 10:
                                        continue
                                    _uname = getattr(getattr(t, "user", None), "username", "") or ""
                                    _tid   = getattr(t, "id", "")
                                    _url   = f"https://twitter.com/{_uname}/status/{_tid}" if _uname and _tid else ""
                                    tw_raw.append({"title": _text[:280], "url": _url, "author": f"@{_uname}"})
                                if tw_raw:
                                    yield emit("step", f"  → {len(tw_raw)} tweets via twscrape")
                            except Exception as _tws_err:
                                logger.warning(f"[TWSCRAPE] Search failed: {_tws_err}")
                                yield emit("step", f"  → twscrape failed ({str(_tws_err)[:60]})")
                                global _twscrape_api
                                _twscrape_api = None

                    # --- Attempt 3: Bing News RSS (last resort) ---
                    if not tw_raw:
                        yield emit("step", "  → trying Bing News RSS fallback...")
                        try:
                            import aiohttp as _aiohttp_tw
                            import xml.etree.ElementTree as _ET_tw
                            _bing_tw_url = f"https://www.bing.com/news/search?q={quote_plus('site:x.com ' + twitter_query)}&format=RSS"
                            async with _aiohttp_tw.ClientSession(headers={"User-Agent": "Mozilla/5.0"}) as _tw_s:
                                async with _tw_s.get(_bing_tw_url, timeout=_aiohttp_tw.ClientTimeout(total=10)) as _tw_r:
                                    _tw_xml = await _tw_r.text()
                            _tw_root = _ET_tw.fromstring(_tw_xml)
                            for _item in _tw_root.findall(".//item")[:10]:
                                _t = (_item.findtext("title") or "").strip()
                                _link = (_item.findtext("link") or "").strip()
                                if _t and _link and ("x.com" in _link or "twitter.com" in _link):
                                    tw_raw.append({"title": _t[:200], "url": _link, "author": ""})
                            if tw_raw:
                                yield emit("step", f"  → {len(tw_raw)} tweets via Bing News RSS")
                            else:
                                yield emit("step", "  → Twitter: no results from any source")
                        except Exception as _fb_err:
                            yield emit("step", f"  → all Twitter sources failed ({str(_fb_err)[:60]})")

                    if tw_raw:
                        async def _sum_tweet(a: dict) -> BlogItem:
                            async with sem:
                                summary, u = await asyncio.to_thread(_summarize_text, a["title"], "", _sum_client)
                                _merge_usage(usage_totals, u)
                                return BlogItem(source="twitter", title=a["title"], summary=summary,
                                                url=a["url"], author=a.get("author"))
                        twitter_blogs = list(await asyncio.gather(*[_sum_tweet(a) for a in tw_raw]))
                except Exception as _tw_err:
                    logger.warning(f"[BROWSER] Twitter phase failed: {_tw_err}")
                    yield emit("step", f"  → Twitter failed ({type(_tw_err).__name__}: {str(_tw_err)[:80]})")

                # ── PHASE 3e: Blog / Opinion (DuckDuckGo Lite via Playwright) ────
                # Finds personal blog posts, expert analysis, and opinion pieces that
                # news aggregators miss. DuckDuckGo Lite is scraper-friendly and
                # doesn't require JavaScript to render results.
                blog_blogs: list[BlogItem] = []
                try:
                    _blog_q = f"{_search_str} analysis opinion blog expert"
                    _ddg_url = f"https://html.duckduckgo.com/html/?q={quote_plus(_blog_q)}"
                    yield emit("step", f"Blog/Opinion search: '{_blog_q}'")
                    for ev in await nav(_ddg_url, t=15000):
                        yield ev
                    await asyncio.sleep(1)
                    _blog_raw = await page.evaluate("""
                        () => {
                            const SKIP = ['reddit.com','twitter.com','x.com','youtube.com',
                                          'google.com','bing.com','facebook.com','instagram.com','tiktok.com'];
                            const items = [];
                            document.querySelectorAll('.result__body, .result').forEach(el => {
                                const a = el.querySelector('.result__a, h2.result__title a, a.result__a');
                                const snip = el.querySelector('.result__snippet');
                                if (!a) return;
                                const rawHref = a.href || '';
                                let url = rawHref;
                                if (rawHref.includes('uddg=')) {
                                    try { url = decodeURIComponent(rawHref.split('uddg=')[1].split('&')[0]); } catch(e){}
                                }
                                const title = a.textContent.trim();
                                const text = (snip?.textContent || '').trim();
                                if (!url.startsWith('http') || !title) return;
                                if (SKIP.some(d => url.includes(d))) return;
                                items.push({ title, url, snippet: text });
                            });
                            return items.slice(0, 8);
                        }
                    """)
                    yield emit("step", f"  → {len(_blog_raw or [])} blog/opinion results")
                    for _ba in (_blog_raw or []):
                        _ba_title = (_ba.get("title") or "").strip()
                        _ba_url = (_ba.get("url") or "").strip()
                        _ba_snip = (_ba.get("snippet") or "").strip()
                        if not _ba_title or not _ba_url:
                            continue
                        blog_blogs.append(BlogItem(
                            source="blog",
                            title=_ba_title,
                            summary=_ba_snip or f"Blog post: {_ba_title}",
                            url=_ba_url,
                        ))
                except Exception as _blog_err:
                    logger.warning(f"[BROWSER] Blog phase failed: {_blog_err}")
                    yield emit("step", f"  → Blog search failed ({str(_blog_err)[:80]})")

                yield emit("step", f"Closing browser... (reddit={len(reddit_blogs)}, yt={len(youtube_blogs)}, news={len(news_blogs)}, twitter={len(twitter_blogs)}, hn={len(hn_blogs)}, blogs={len(blog_blogs)})")
                await browser.close()

                # ── Combine ────────────────────────────────────────────────
                # Order: primary sources first (news, video, HN, blogs, twitter), Reddit last
                all_blogs: list[BlogItem] = youtube_blogs + news_blogs + hn_blogs + blog_blogs + twitter_blogs + reddit_blogs
                yield emit("step", f"Total collected: {len(all_blogs)} items. Running AI relevance check...")

                # ── AI title filter (1 LLM call, titles only) ──────────────
                all_blogs, filter_msg = await _batch_title_filter(all_blogs, query)
                yield emit("step", f"  → {filter_msg}")

                blogs = all_blogs

                # ── Save ───────────────────────────────────────────────────
                yield emit("step", f"Saving {len(blogs)} results to database...")
                estimated_cost = _estimate_cost_usd(usage_totals["prompt_tokens"], usage_totals["output_tokens"])
                usage_schema = _usage_to_schema(GEMINI_MODEL if client else None, usage_totals, estimated_cost)

                run_row = BrowserResearchRun(
                    run_id=run_id, query=query,
                    selected_reddit_communities=json.dumps([], ensure_ascii=True),
                    youtube_channels_used=json.dumps(request.hint_channels, ensure_ascii=True),
                    total_blogs=len(blogs),
                    created_by=current_user.id if current_user else None,
                )
                db.add(run_row)
                db.add(BrowserResearchRunMetric(
                    run_id=run_id, llm_model=usage_schema.model,
                    llm_calls=usage_schema.calls, prompt_tokens=usage_schema.prompt_tokens,
                    output_tokens=usage_schema.output_tokens, total_tokens=usage_schema.total_tokens,
                    estimated_cost_usd=f"{usage_schema.estimated_cost_usd:.6f}",
                ))
                for blog in blogs:
                    db.add(BrowserResearchItem(
                        run_id=run_id, source=blog.source, title=blog.title, summary=blog.summary,
                        url=blog.url, community=blog.community, channel=blog.channel,
                        score=blog.score, comments=blog.comments,
                    ))
                db.commit()
                yield emit("step", f"Done! {len(blogs)} results | {usage_schema.calls} LLM calls | ${usage_schema.estimated_cost_usd:.5f}")
                result = BrowserResearchResponse(
                    run_id=run_id, query=query,
                    selected_reddit_communities=[],
                    youtube_channels_used=request.hint_channels,
                    total_blogs=len(blogs), generated_at=datetime.now(),
                    llm_usage=usage_schema, blogs=blogs,
                )
                yield emit("result", json.loads(result.model_dump_json()))

        except asyncio.InvalidStateError:
            # Playwright background-task cleanup noise on Python ≤3.10 — safe to ignore.
            # Research already completed and result was yielded before this fires.
            logger.debug("[LIVE-BROWSER] Playwright cleanup InvalidStateError suppressed")
        except Exception as exc:
            logger.exception("[LIVE-BROWSER] Unexpected error")
            yield emit("error", str(exc))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/history", response_model=BrowserResearchHistoryResponse)
def get_browser_research_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    safe_limit = min(max(limit, 1), 100)
    q = db.query(BrowserResearchRun).order_by(BrowserResearchRun.generated_at.desc())
    if current_user:
        q = q.filter(BrowserResearchRun.created_by == current_user.id)
    rows = q.limit(safe_limit).all()

    run_ids = [r.run_id for r in rows]
    metric_rows = db.query(BrowserResearchRunMetric).filter(BrowserResearchRunMetric.run_id.in_(run_ids)).all() if run_ids else []
    metric_by_run_id = {m.run_id: m for m in metric_rows}

    total_usage = _empty_usage()
    total_estimated_cost_usd = 0.0
    llm_model = GEMINI_MODEL
    for metric in metric_rows:
        total_usage["calls"] += int(metric.llm_calls or 0)
        total_usage["prompt_tokens"] += int(metric.prompt_tokens or 0)
        total_usage["output_tokens"] += int(metric.output_tokens or 0)
        total_usage["total_tokens"] += int(metric.total_tokens or 0)
        try:
            total_estimated_cost_usd += float(metric.estimated_cost_usd or 0)
        except Exception:
            pass

    return BrowserResearchHistoryResponse(
        runs=[
            BrowserResearchRunSummary(
                run_id=row.run_id,
                query=row.query,
                total_blogs=row.total_blogs,
                generated_at=row.generated_at,
                llm_usage=_usage_to_schema(
                    metric_by_run_id[row.run_id].llm_model,
                    {
                        "calls": int(metric_by_run_id[row.run_id].llm_calls or 0),
                        "prompt_tokens": int(metric_by_run_id[row.run_id].prompt_tokens or 0),
                        "output_tokens": int(metric_by_run_id[row.run_id].output_tokens or 0),
                        "total_tokens": int(metric_by_run_id[row.run_id].total_tokens or 0),
                    },
                    float(metric_by_run_id[row.run_id].estimated_cost_usd or 0),
                ) if row.run_id in metric_by_run_id else None,
            )
            for row in rows
        ],
        totals=_usage_to_schema(llm_model, total_usage, round(total_estimated_cost_usd, 6)),
    )


@router.get("/card/{card_id}/items")
def get_card_all_items(card_id: str, db: Session = Depends(get_db)):
    """Return all items across all runs for a card, deduped by URL, newest runs first.
    Uses raw SQL for the card_id lookup so it degrades gracefully before migration_v4 runs."""
    from sqlalchemy import text
    try:
        run_rows = db.execute(
            text("SELECT run_id, generated_at FROM browser_research_runs WHERE card_id = :cid ORDER BY generated_at DESC"),
            {"cid": card_id},
        ).fetchall()
    except Exception:
        # Column doesn't exist yet (migration pending) — return empty so frontend falls back to getRun
        return {"items": [], "total": 0, "run_count": 0}

    if not run_rows:
        return {"items": [], "total": 0, "run_count": 0}

    seen_urls: set[str] = set()
    items_out = []
    for run_row in run_rows:
        run_id = run_row[0]
        run_date = run_row[1]
        rows = (
            db.query(BrowserResearchItem)
            .filter(BrowserResearchItem.run_id == run_id)
            .all()
        )
        for row in rows:
            if row.url and row.url in seen_urls:
                continue
            if row.url:
                seen_urls.add(row.url)
            items_out.append({
                "source": row.source,
                "title": row.title,
                "summary": row.summary,
                "url": row.url,
                "community": row.community,
                "channel": row.channel,
                "author": row.author,
                "score": row.score,
                "comments": row.comments,
                "published_at": row.published_at,
                "run_id": run_id,
                "run_date": run_date.isoformat() if run_date else None,
            })

    return {"items": items_out, "total": len(items_out), "run_count": len(run_rows)}


@router.get("/card/{card_id}/runs")
def get_card_runs(card_id: str, db: Session = Depends(get_db)):
    """Return all runs for a card, newest first, each with its complete item list (no cross-run dedup)."""
    from sqlalchemy import text
    try:
        run_rows = db.execute(
            text("SELECT run_id, generated_at, query FROM browser_research_runs WHERE card_id = :cid ORDER BY generated_at DESC"),
            {"cid": card_id},
        ).fetchall()
    except Exception:
        return {"runs": []}

    runs_out = []
    for rr in run_rows:
        run_id, generated_at, query = rr[0], rr[1], rr[2]
        item_rows = db.query(BrowserResearchItem).filter(BrowserResearchItem.run_id == run_id).all()
        runs_out.append({
            "run_id": run_id,
            "generated_at": generated_at.isoformat() if generated_at else None,
            "query": query or "",
            "item_count": len(item_rows),
            "items": [
                {
                    "source": i.source, "title": i.title, "summary": i.summary, "url": i.url,
                    "community": i.community, "channel": i.channel, "author": i.author,
                    "score": i.score, "comments": i.comments, "published_at": i.published_at,
                }
                for i in item_rows
            ],
        })
    return {"runs": runs_out}


@router.get("/history/{run_id}", response_model=BrowserResearchResponse)
def get_browser_research_run(run_id: str, db: Session = Depends(get_db)):
    run_row = db.query(BrowserResearchRun).filter(BrowserResearchRun.run_id == run_id).first()
    if not run_row:
        raise HTTPException(status_code=404, detail="Run not found")

    metric_row = db.query(BrowserResearchRunMetric).filter(BrowserResearchRunMetric.run_id == run_id).first()

    item_rows = (
        db.query(BrowserResearchItem)
        .filter(BrowserResearchItem.run_id == run_id)
        .order_by(BrowserResearchItem.id.asc())
        .all()
    )

    try:
        selected_communities = json.loads(run_row.selected_reddit_communities or "[]")
    except Exception:
        selected_communities = []
    try:
        youtube_channels_used = json.loads(run_row.youtube_channels_used or "[]")
    except Exception:
        youtube_channels_used = []

    blogs = [
        BlogItem(
            source=item.source,
            title=item.title,
            summary=item.summary,
            url=item.url,
            community=item.community,
            channel=item.channel,
            author=item.author,
            score=item.score,
            comments=item.comments,
            published_at=item.published_at,
        )
        for item in item_rows
    ]

    return BrowserResearchResponse(
        run_id=run_row.run_id,
        query=run_row.query,
        selected_reddit_communities=selected_communities,
        youtube_channels_used=youtube_channels_used,
        total_blogs=run_row.total_blogs,
        generated_at=run_row.generated_at,
        llm_usage=_usage_to_schema(
            metric_row.llm_model,
            {
                "calls": int(metric_row.llm_calls or 0),
                "prompt_tokens": int(metric_row.prompt_tokens or 0),
                "output_tokens": int(metric_row.output_tokens or 0),
                "total_tokens": int(metric_row.total_tokens or 0),
            },
            float(metric_row.estimated_cost_usd or 0),
        ) if metric_row else None,
        blogs=blogs,
    )
