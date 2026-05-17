import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from app.core.database import Base


class UserInteraction(Base):
    __tablename__ = "user_interactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rec_id = Column(String, ForeignKey("user_recommendations.id", ondelete="SET NULL"), nullable=True)
    source_url = Column(String(1024), nullable=True)
    domain = Column(String(8), nullable=True)
    subdomain = Column(String(8), nullable=True)
    source_type = Column(String(16), nullable=True)
    action = Column(String(16), nullable=False)  # 'click', 'dismiss', 'save'
    dwell_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
