from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class YouTubeScrapeRequest(BaseModel):
    channels: List[str] = Field(..., min_length=1)
    videos_per_channel: int = Field(default=10, ge=1, le=20)
    summarize: bool = True


class YouTubeVideoItem(BaseModel):
    run_id: Optional[str] = None
    video_id: Optional[str] = None
    channel_input: Optional[str] = None
    video_url: str
    title: str
    description: Optional[str] = None
    summary: Optional[str] = None
    published_at: Optional[str] = None
    channel_title: Optional[str] = None
    scraped_at: Optional[datetime] = None


class YouTubeChannelResult(BaseModel):
    channel_input: str
    channel_title: Optional[str] = None
    videos_found: int
    videos: List[YouTubeVideoItem]


class YouTubeScrapeResponse(BaseModel):
    run_id: str
    total_videos: int
    created_at: datetime
    channels: List[YouTubeChannelResult]


class YouTubeHistoryResponse(BaseModel):
    total_videos: int
    total_runs: int = 0
    runs_today: int = 0
    videos: List[YouTubeVideoItem]
