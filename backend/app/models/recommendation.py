import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class UserRecommendation(Base):
    __tablename__ = "user_recommendations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    card_id = Column(String, ForeignKey("feed_cards.id", ondelete="SET NULL"), nullable=True)
    domain = Column(String(8), nullable=True)
    subdomain = Column(String(8), nullable=True)
    reason = Column(String(256), nullable=True)
    is_seen = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    batch_label = Column(String(32), nullable=True)  # "morning", "afternoon", "evening"

    # Self-contained article data from search (Google News / Reddit / YouTube)
    title = Column(String(512), nullable=True)
    summary = Column(Text, nullable=True)
    source_url = Column(String(1024), nullable=True)
    source_type = Column(String(16), nullable=True)  # "google_news", "reddit", "youtube"
    image_url = Column(String(1024), nullable=True)
    score = Column(Integer, nullable=True)  # reddit score or youtube views

    user = relationship("User", foreign_keys=[user_id])
    card = relationship("FeedCard", foreign_keys=[card_id])
