import asyncio
import json
import logging
from typing import Iterable
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from google import genai
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Article, BrowserResearchItem, BrowserResearchRun
from app.schemas.browser_research import (
    BlogItem,
    BrowserResearchHistoryResponse,
    BrowserResearchRequest,
    BrowserResearchResponse,
    BrowserResearchRunSummary,
)
from app.services.youtube_scraping_service import youtube_scraping_service


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/browser-research", tags=["browser-research"])


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

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it",
    "of", "on", "or", "that", "the", "to", "with", "about", "how", "what", "when", "where", "why",
    "top", "latest", "new", "news", "update", "updates",
}


def _get_genai_client():
    if not settings.GOOGLE_API_KEY:
        return None
    try:
        return genai.Client(api_key=settings.GOOGLE_API_KEY)
    except Exception:
        return None


def _extract_json(text: str):
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
            return json.loads(raw[start:end + 1])
        except Exception:
            return None
    return None


def _pick_reddit_communities_with_gemini(query: str, limit: int) -> list[str]:
    client = _get_genai_client()
    if client is None:
        return [x["name"] for x in sorted(AI_EXPLORE_COMMUNITIES, key=lambda c: c["weekly_visitors"], reverse=True)[:limit]]

    prompt = (
        "Select best Reddit communities for this query from the provided list. "
        "Return JSON only: {\"communities\": [..]}. "
        "Focus on high-signal communities for startup funding and open-source AI model discussion.\n\n"
        f"Query: {query}\n"
        f"Candidates: {json.dumps(AI_EXPLORE_COMMUNITIES, ensure_ascii=True)}\n"
        f"Max communities: {limit}"
    )

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
        )
        payload = _extract_json(getattr(response, "text", ""))
        choices = payload.get("communities") if isinstance(payload, dict) else None
        if isinstance(choices, list):
            normalized = []
            valid = {c["name"].lower(): c["name"] for c in AI_EXPLORE_COMMUNITIES}
            for item in choices:
                key = str(item).strip().lower()
                if key in valid and valid[key] not in normalized:
                    normalized.append(valid[key])
                if len(normalized) >= limit:
                    break
            if normalized:
                return normalized
    except Exception as exc:
        logger.warning(f"[BROWSER-RESEARCH] Gemini community pick failed: {exc}")

    return [x["name"] for x in sorted(AI_EXPLORE_COMMUNITIES, key=lambda c: c["weekly_visitors"], reverse=True)[:limit]]


def _summarize_text(title: str, body: str, client) -> str:
    fallback = (body or "").strip().replace("\n", " ")[:300] or f"Summary of: {title}"
    if client is None:
        return fallback

    prompt = (
        "Write a concise blog-style summary in 3 to 4 sentences, factual and clear. "
        "Highlight what happened, key points, and why it matters.\n\n"
        f"Title: {title}\nBody: {body or ''}"
    )
    try:
        response = client.models.generate_content(model="gemini-3-flash-preview", contents=prompt)
        text = (response.text or "").strip()
        return text or fallback
    except Exception:
        return fallback


def _tokenize_meaningful(text: str) -> set[str]:
    parts = [x.strip().lower() for x in (text or "").split()]
    cleaned = set()
    for token in parts:
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


def _score_blog_relevance(query: str, blog: BlogItem, client) -> float:
    context = _build_blog_context(blog)
    lexical_score = _keyword_overlap_score(query, context)

    # Fast reject to keep quality high and reduce AI calls.
    if lexical_score < 0.2:
        return round(min(0.89, lexical_score), 4)

    if client is None:
        return round(min(0.89, lexical_score), 4)

    prompt = (
        "You are a strict relevance judge. Score how well this item matches the user query. "
        "Return JSON only: {\"score\": 0.0 to 1.0}. "
        "Use 0.90+ only when the item is strongly and directly about the same topic.\n\n"
        f"Query: {query}\n\n"
        f"Item:\n{context}"
    )

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
        )
        payload = _extract_json(getattr(response, "text", ""))
        ai_score = float((payload or {}).get("score", 0.0)) if isinstance(payload, dict) else 0.0
        ai_score = max(0.0, min(1.0, ai_score))
        # Blend with lexical guardrail so off-topic generative drift stays controlled.
        blended = (0.75 * ai_score) + (0.25 * lexical_score)
        return round(max(0.0, min(1.0, blended)), 4)
    except Exception:
        return round(min(0.89, lexical_score), 4)


async def _filter_by_relevance(
    blogs: list[BlogItem],
    query: str,
    threshold: float,
    client,
) -> list[BlogItem]:
    semaphore = asyncio.Semaphore(8)

    async def evaluate(blog: BlogItem):
        async with semaphore:
            score = await asyncio.to_thread(_score_blog_relevance, query, blog, client)
            return blog, score

    scored = await asyncio.gather(*[evaluate(blog) for blog in blogs]) if blogs else []

    kept = []
    for blog, score in scored:
        if score < threshold:
            continue
        if hasattr(blog, "model_dump"):
            payload = blog.model_dump()
        else:
            payload = blog.dict()
        payload["relevance_score"] = score
        kept.append(BlogItem(**payload))

    kept.sort(key=lambda x: x.relevance_score or 0.0, reverse=True)
    return kept


async def _fetch_reddit_posts_for_community(
    community: str,
    query: str,
    posts_per_community: int,
    client,
) -> list[BlogItem]:
    import aiohttp

    url = f"https://www.reddit.com/r/{community}/search.json"
    params = {
        "q": query,
        "restrict_sr": "1",
        "sort": "top",
        "t": "year",
        "limit": "50",
    }
    headers = {"User-Agent": "CurioBrowserMain/1.0"}

    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            async with session.get(url, params=params, timeout=30) as resp:
                if resp.status != 200:
                    return []
                payload = await resp.json()
        except Exception:
            return []

    children = (((payload or {}).get("data") or {}).get("children") or [])
    posts = []
    for node in children:
        data = node.get("data") or {}
        title = (data.get("title") or "Untitled").strip()
        selftext = data.get("selftext") or ""
        summary = await asyncio.to_thread(_summarize_text, title, selftext, client)
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
    return posts[:posts_per_community]


@router.post("/run", response_model=BrowserResearchResponse)
async def run_browser_research(request: BrowserResearchRequest, db: Session = Depends(get_db)):
    query = request.query.strip()
    if not request.youtube_channels:
        raise HTTPException(status_code=400, detail="At least one YouTube channel is required")

    client = _get_genai_client()
    run_id = str(uuid4())

    selected_communities = _pick_reddit_communities_with_gemini(query, request.reddit_communities_limit)

    reddit_tasks = [
        _fetch_reddit_posts_for_community(
            community=c,
            query=query,
            posts_per_community=request.reddit_posts_per_community,
            client=client,
        )
        for c in selected_communities
    ]
    reddit_batches = await asyncio.gather(*reddit_tasks)
    reddit_blogs = [item for batch in reddit_batches for item in batch]

    yt_results = await youtube_scraping_service.scrape_channels(
        channels=request.youtube_channels,
        videos_per_channel=request.youtube_videos_per_channel,
        summarize=True,
    )
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
    blogs = await _filter_by_relevance(
        blogs=blogs,
        query=query,
        threshold=request.relevance_threshold,
        client=client,
    )

    run_row = BrowserResearchRun(
        run_id=run_id,
        query=query,
        selected_reddit_communities=json.dumps(selected_communities, ensure_ascii=True),
        youtube_channels_used=json.dumps(request.youtube_channels, ensure_ascii=True),
        total_blogs=len(blogs),
    )
    db.add(run_row)
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

    return BrowserResearchResponse(
        run_id=run_id,
        query=query,
        selected_reddit_communities=selected_communities,
        youtube_channels_used=request.youtube_channels,
        total_blogs=len(blogs),
        generated_at=datetime.now(),
        blogs=blogs,
    )


@router.get("/history", response_model=BrowserResearchHistoryResponse)
def get_browser_research_history(limit: int = 20, db: Session = Depends(get_db)):
    safe_limit = min(max(limit, 1), 100)
    rows = (
        db.query(BrowserResearchRun)
        .order_by(BrowserResearchRun.generated_at.desc())
        .limit(safe_limit)
        .all()
    )
    return BrowserResearchHistoryResponse(
        runs=[
            BrowserResearchRunSummary(
                run_id=row.run_id,
                query=row.query,
                total_blogs=row.total_blogs,
                generated_at=row.generated_at,
            )
            for row in rows
        ]
    )


@router.get("/history/{run_id}", response_model=BrowserResearchResponse)
def get_browser_research_run(run_id: str, db: Session = Depends(get_db)):
    run_row = db.query(BrowserResearchRun).filter(BrowserResearchRun.run_id == run_id).first()
    if not run_row:
        raise HTTPException(status_code=404, detail="Run not found")

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
        blogs=blogs,
    )
