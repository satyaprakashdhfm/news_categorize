import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class BrowserResearchRun(Base):
    __tablename__ = "browser_research_runs"

    run_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    query = Column(String, nullable=False)
    selected_reddit_communities = Column(Text, nullable=False, default="[]")
    youtube_channels_used = Column(Text, nullable=False, default="[]")
    total_blogs = Column(Integer, nullable=False, default=0)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)

    items = relationship(
        "BrowserResearchItem",
        back_populates="run",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class BrowserResearchItem(Base):
    __tablename__ = "browser_research_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("browser_research_runs.run_id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String, nullable=False)
    title = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    community = Column(String, nullable=True)
    channel = Column(String, nullable=True)
    author = Column(String, nullable=True)
    score = Column(Integer, nullable=True)
    comments = Column(Integer, nullable=True)
    published_at = Column(String, nullable=True)

    run = relationship("BrowserResearchRun", back_populates="items")