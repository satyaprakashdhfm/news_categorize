import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class FeedCard(Base):
    __tablename__ = "feed_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String(16), nullable=False)       # 'domain' | 'custom'
    title = Column(String(256), nullable=False)
    domain = Column(String(8), nullable=True)       # POL / ECO / BUS / TEC / OTH
    subdomain = Column(String(8), nullable=True)    # EXE / BIO / SAI … / OTH
    description = Column(Text, nullable=True)
    run_id = Column(String, ForeignKey("browser_research_runs.run_id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_global = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    pinned_count = Column(Integer, nullable=False, default=0, server_default="0")

    run = relationship("BrowserResearchRun", foreign_keys=[run_id])
    creator = relationship("User", back_populates="feed_cards", foreign_keys=[created_by])
    pinned_by = relationship("UserFeedCard", back_populates="card", cascade="all, delete-orphan")


class UserFeedCard(Base):
    __tablename__ = "user_feed_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    card_id = Column(String, ForeignKey("feed_cards.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    added_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", back_populates="pinned_cards")
    card = relationship("FeedCard", back_populates="pinned_by")
