import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Source(Base):
    __tablename__ = "sources"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    domain = Column(String(50), nullable=False, default="general")
    source_type = Column(String(20), nullable=False, default="web")  # web, youtube, twitter, reddit
    submitted_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    submitter = relationship("User", foreign_keys=[submitted_by])
    votes = relationship("SourceVote", back_populates="source", cascade="all, delete-orphan")


class SourceVote(Base):
    __tablename__ = "source_votes"
    __table_args__ = (
        UniqueConstraint("source_id", "user_id", name="uq_source_vote"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vote = Column(Integer, nullable=False)  # +1 or -1

    source = relationship("Source", back_populates="votes")
