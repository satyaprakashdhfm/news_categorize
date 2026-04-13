from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class BrowserScrapeRequest(BaseModel):
    url: str
    format: str = Field(default="text")
    max_chars: int = Field(default=20000, ge=500, le=2000000)


class BrowserResearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=500)
    format: str = Field(default="text")
    max_chars_per_source: int = Field(default=12000, ge=1000, le=2000000)


class BrowserScrapeItem(BaseModel):
    id: str
    run_id: str
    requested_url: str
    final_url: str
    title: Optional[str] = None
    text: str
    mode: str
    format: str
    scrape_source: str
    truncated_text: bool
    scraped_at: datetime


class BrowserScrapeResponse(BaseModel):
    run_id: str
    item: BrowserScrapeItem


class BrowserResearchSourceResult(BaseModel):
    source: str
    requested_url: str
    final_url: str
    title: Optional[str] = None
    text: str
    truncated_text: bool


class BrowserResearchResponse(BaseModel):
    run_id: str
    query: str
    format: str
    sources: List[BrowserResearchSourceResult]


class BrowserScrapeHistoryResponse(BaseModel):
    total_items: int
    items: List[BrowserScrapeItem]
