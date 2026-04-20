import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(256), unique=True, nullable=False)
    name = Column(String(256), nullable=False)
    password_hash = Column(String(512), nullable=False)
    role = Column(String(16), nullable=False, default="user")  # 'user' | 'admin'
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    feed_cards = relationship("FeedCard", back_populates="creator", foreign_keys="FeedCard.created_by")
    pinned_cards = relationship("UserFeedCard", back_populates="user", cascade="all, delete-orphan")
