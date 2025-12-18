from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CountryEnum(str, Enum):
    USA = "USA"
    RUSSIA = "RUSSIA"
    INDIA = "INDIA"
    CHINA = "CHINA"
    JAPAN = "JAPAN"
    UK = "UK"
    GERMANY = "GERMANY"
    FRANCE = "FRANCE"
    BRAZIL = "BRAZIL"
    AUSTRALIA = "AUSTRALIA"


class CategoryEnum(str, Enum):
    POL = "POL"
    ECO = "ECO"
    SOC = "SOC"
    TEC = "TEC"
    ENV = "ENV"
    HEA = "HEA"
    SPO = "SPO"
    SEC = "SEC"


class ArticleBase(BaseModel):
    title: str
    content: Optional[str] = None
    summary: Optional[str] = None
    image_url: Optional[str] = None
    source_url: str
    published_at: datetime
    country: CountryEnum
    category: CategoryEnum


class ArticleCreate(ArticleBase):
    pass


class ArticleResponse(ArticleBase):
    id: str
    dna_code: str
    scraped_at: datetime
    year: int
    sequence_num: int
    thread_id: Optional[str] = None
    parent_id: Optional[str] = None

    class Config:
        from_attributes = True


class StoryThreadBase(BaseModel):
    title: str
    description: Optional[str] = None
    country: CountryEnum
    category: CategoryEnum


class StoryThreadResponse(StoryThreadBase):
    id: str
    start_date: datetime
    last_update: datetime
    article_count: int

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    articles: List[ArticleResponse]
    stats: Optional[dict] = None


class CountryCount(BaseModel):
    country: str
    count: int


class CategoryCount(BaseModel):
    category: str
    count: int


class StatsResponse(BaseModel):
    total_articles: int
    recent_articles: int
    active_threads: int
    country_counts: List[CountryCount]
    category_counts: List[CategoryCount]
