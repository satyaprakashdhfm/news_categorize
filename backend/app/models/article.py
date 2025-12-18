from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class CountryEnum(str, enum.Enum):
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


class CategoryEnum(str, enum.Enum):
    POL = "POL"  # Politics & Governance
    ECO = "ECO"  # Economy & Business
    SOC = "SOC"  # Society & Culture
    TEC = "TEC"  # Technology & Science
    ENV = "ENV"  # Environment & Climate
    HEA = "HEA"  # Health & Medicine
    SPO = "SPO"  # Sports & Entertainment
    SEC = "SEC"  # Security & Conflict


class Article(Base):
    __tablename__ = "articles"

    id = Column(String, primary_key=True)
    dna_code = Column("dnaCode", String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    image_url = Column("imageUrl", String, nullable=True)
    source_url = Column("sourceUrl", String, nullable=False)
    published_at = Column("publishedAt", DateTime, nullable=False)
    scraped_at = Column("scrapedAt", DateTime, server_default=func.now())
    country = Column(SQLEnum(CountryEnum), nullable=False)
    category = Column(SQLEnum(CategoryEnum), nullable=False)
    year = Column(Integer, nullable=False)
    sequence_num = Column("sequenceNum", Integer, nullable=False)
    
    # Story threading
    thread_id = Column("threadId", String, ForeignKey("story_threads.id"), nullable=True)
    parent_id = Column("parentId", String, ForeignKey("articles.id"), nullable=True)
    
    # Relationships
    thread = relationship("StoryThread", back_populates="articles")
    parent = relationship("Article", remote_side=[id], backref="children")


class StoryThread(Base):
    __tablename__ = "story_threads"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    country = Column(SQLEnum(CountryEnum), nullable=False)
    category = Column(SQLEnum(CategoryEnum), nullable=False)
    start_date = Column("startDate", DateTime, nullable=False)
    last_update = Column("lastUpdate", DateTime, server_default=func.now(), onupdate=func.now())
    article_count = Column("articleCount", Integer, default=0)
    
    # Relationships
    articles = relationship("Article", back_populates="thread")
