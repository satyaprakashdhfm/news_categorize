from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class CustomYouTubeVideo(Base):
    __tablename__ = "custom_youtube_videos"

    id = Column(String, primary_key=True)
    run_id = Column(String(64), nullable=False, index=True)
    channel_input = Column(String(500), nullable=False, index=True)
    channel_title = Column(String(500), nullable=True)
    video_id = Column(String(64), nullable=True, index=True)
    video_url = Column(String(1000), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    published_at = Column(String(64), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    score = Column(Float, default=0)
    scraped_at = Column("scrapedAt", DateTime, server_default=func.now(), nullable=False)
