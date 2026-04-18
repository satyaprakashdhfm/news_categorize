from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RedditScrapeRequest(BaseModel):
    communities: List[str] = Field(..., min_length=1)
    mode: str = Field(default="top_today")  # top_today | hot | new
    posts_per_community: int = Field(default=10, ge=1, le=25)
    summarize: bool = True


class RedditPostItem(BaseModel):
    run_id: Optional[str] = None
    mode: Optional[str] = None
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
    scraped_at: Optional[datetime] = None


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
    total_runs: int = 0
    runs_today: int = 0
    posts: List[RedditPostItem]
