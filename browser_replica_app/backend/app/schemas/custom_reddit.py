from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RedditScrapeRequest(BaseModel):
    communities: List[str] = Field(..., min_length=1)
    mode: str = Field(default="top_today")  # top_today | hot | new
    posts_per_community: int = Field(default=10, ge=1, le=25)
    summarize: bool = True


class RedditPostItem(BaseModel):
    post_id: Optional[str] = None
    subreddit: str
    title: str
    post_url: str
    selftext: Optional[str] = None
    summary: Optional[str] = None
    author: Optional[str] = None
    score: int
    num_comments: int
    published_at: Optional[str] = None


class RedditCommunityResult(BaseModel):
    community: str
    mode: str
    posts_found: int
    posts: List[RedditPostItem]


class RedditScrapeResponse(BaseModel):
    run_id: str
    total_posts: int
    created_at: datetime
    communities: List[RedditCommunityResult]


class RedditHistoryResponse(BaseModel):
    total_posts: int
    posts: List[RedditPostItem]
