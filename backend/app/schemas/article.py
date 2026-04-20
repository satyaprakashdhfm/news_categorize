from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CategoryEnum(str, Enum):
    POL = "POL"
    ECO = "ECO"
    BUS = "BUS"
    TEC = "TEC"


# Subcategory codes per domain
SUBCATEGORY_CODES = {
    "POL": ["EXE", "LEG", "JUD", "GEO"],
    "ECO": ["MAC", "MIC", "INV", "MON", "TRD"],
    "BUS": ["SCA", "MID"],
    "TEC": ["SAI", "PHY", "BIO", "ROB", "DEF", "SPC", "NMI", "EHW"],
}

SUBCATEGORY_LABELS = {
    "EXE": "Executive",
    "LEG": "Legislative",
    "JUD": "Judiciary",
    "GEO": "Geopolitics",
    "MAC": "Macroeconomics",
    "MIC": "Microeconomics",
    "INV": "Investments",
    "MON": "Monetary Policy",
    "TRD": "Trade & Global Economy",
    "SCA": "Startups & Corporate Activity",
    "MID": "Markets & Industry Dynamics",
    "SAI": "Software & AI",
    "PHY": "Science – Physics",
    "BIO": "Biotechnology",
    "ROB": "Robotics",
    "DEF": "Defence & Weapon Technologies",
    "SPC": "Space",
    "NMI": "Nano & Material Innovation",
    "EHW": "Electronics & Hardware",
    "OTH": "Others",
}


class ArticleBase(BaseModel):
    title: str
    content: Optional[str] = None
    summary: Optional[str] = None
    image_url: Optional[str] = None
    source_url: str
    published_at: datetime
    country: Optional[str] = None
    category: CategoryEnum
    subcategory: str = "OTH"


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
    country: Optional[str] = None
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


class SubcategoryCount(BaseModel):
    subcategory: str
    count: int


class StatsResponse(BaseModel):
    total_articles: int
    recent_articles: int
    active_threads: int
    country_counts: List[CountryCount]
    category_counts: List[CategoryCount]
