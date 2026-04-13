from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import CustomRedditPost
from app.schemas import (
    RedditHistoryResponse,
    RedditScrapeRequest,
    RedditScrapeResponse,
)
from app.services.reddit_scraping_service import reddit_scraping_service


router = APIRouter(prefix="/api/custom-reddit", tags=["custom-reddit"])


@router.post("/scrape", response_model=RedditScrapeResponse)
async def scrape_custom_reddit(request: RedditScrapeRequest, db: Session = Depends(get_db)):
    run_id = str(uuid4())
    created_at = datetime.now()

    community_results = await reddit_scraping_service.scrape_communities(
        communities=request.communities,
        mode=request.mode,
        posts_per_community=request.posts_per_community,
        summarize=request.summarize,
    )

    total = 0
    response_communities = []

    for community_result in community_results:
        posts = community_result.get("posts", [])
        for idx, post in enumerate(posts):
            db.add(
                CustomRedditPost(
                    id=str(uuid4()),
                    run_id=run_id,
                    subreddit=community_result.get("community") or "",
                    mode=community_result.get("mode") or request.mode,
                    post_id=post.get("post_id"),
                    post_url=(post.get("post_url") or "")[:1000],
                    title=(post.get("title") or "Untitled")[:500],
                    selftext=post.get("selftext"),
                    summary=post.get("summary"),
                    author=post.get("author"),
                    score=float(post.get("score") or 0),
                    num_comments=int(post.get("num_comments") or 0),
                    published_at=post.get("published_at"),
                    position=idx,
                )
            )

        total += len(posts)
        response_communities.append(
            {
                "community": community_result.get("community"),
                "mode": community_result.get("mode"),
                "posts_found": len(posts),
                "posts": posts,
            }
        )

    db.commit()

    return RedditScrapeResponse(
        run_id=run_id,
        total_posts=total,
        created_at=created_at,
        communities=response_communities,
    )


@router.get("/history", response_model=RedditHistoryResponse)
async def get_reddit_history(
    community: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(CustomRedditPost)
    if community:
        query = query.filter(CustomRedditPost.subreddit == community)

    rows = query.order_by(desc(CustomRedditPost.scraped_at)).limit(limit).all()
    posts = [
        {
            "post_id": row.post_id,
            "subreddit": row.subreddit,
            "title": row.title,
            "post_url": row.post_url,
            "selftext": row.selftext,
            "summary": row.summary,
            "author": row.author,
            "score": int(row.score or 0),
            "num_comments": int(row.num_comments or 0),
            "published_at": row.published_at,
        }
        for row in rows
    ]

    return RedditHistoryResponse(total_posts=len(posts), posts=posts)
