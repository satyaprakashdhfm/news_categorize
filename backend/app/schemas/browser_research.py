from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class BrowserResearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=500)
    youtube_channels: List[str] = Field(min_length=1)
    youtube_videos_per_channel: int = Field(default=5, ge=1, le=10)
    reddit_communities_limit: int = Field(default=5, ge=1, le=20)
    reddit_posts_per_community: int = Field(default=5, ge=1, le=15)
    news_count: int = Field(default=8, ge=0, le=20)
    relevance_threshold: float = Field(default=0.0, ge=0.0, le=1.0)


class LiveBrowserRequest(BaseModel):
    query: str = Field(min_length=3, max_length=500)
    hint_channels: List[str] = Field(default=[])  # optional YouTube channel hints


class BlogItem(BaseModel):
    source: str
    title: str
    summary: str
    url: str
    relevance_score: Optional[float] = None
    community: Optional[str] = None
    channel: Optional[str] = None
    author: Optional[str] = None
    score: Optional[int] = None
    comments: Optional[int] = None
    published_at: Optional[str] = None


class LLMUsageSummary(BaseModel):
    model: Optional[str] = None
    calls: int = 0
    prompt_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class BrowserResearchResponse(BaseModel):
    run_id: str
    query: str
    selected_reddit_communities: List[str]
    youtube_channels_used: List[str]
    total_blogs: int
    generated_at: datetime
    llm_usage: Optional[LLMUsageSummary] = None
    blogs: List[BlogItem]


class BrowserResearchRunSummary(BaseModel):
    run_id: str
    query: str
    total_blogs: int
    generated_at: datetime
    llm_usage: Optional[LLMUsageSummary] = None


class BrowserResearchHistoryResponse(BaseModel):
    runs: List[BrowserResearchRunSummary]
    totals: LLMUsageSummary
