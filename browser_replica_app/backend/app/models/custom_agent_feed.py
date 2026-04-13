from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class CustomAgentFeedArticle(Base):
    __tablename__ = "custom_agent_feed_articles"

    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("custom_agents.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    url = Column(String(1000), nullable=False)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    image_url = Column(String(1000), nullable=True)
    published_at = Column(String(64), nullable=True)
    score = Column(Float, default=0)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column("createdAt", DateTime, server_default=func.now(), nullable=False)
