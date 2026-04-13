from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class CustomRedditPost(Base):
    __tablename__ = "custom_reddit_posts"

    id = Column(String, primary_key=True)
    run_id = Column(String(64), nullable=False, index=True)
    subreddit = Column(String(128), nullable=False, index=True)
    mode = Column(String(32), nullable=False, index=True)
    post_id = Column(String(64), nullable=True, index=True)
    post_url = Column(String(1000), nullable=False)
    title = Column(String(500), nullable=False)
    selftext = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    author = Column(String(128), nullable=True)
    score = Column(Float, default=0)
    num_comments = Column(Integer, default=0)
    published_at = Column(String(64), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    scraped_at = Column("scrapedAt", DateTime, server_default=func.now(), nullable=False)
