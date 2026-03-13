from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.sql import func
from app.core.database import Base


class CustomAgent(Base):
    __tablename__ = "custom_agents"

    id = Column(String, primary_key=True)
    title = Column(String(160), nullable=False)
    prompt = Column(Text, nullable=False)
    created_at = Column("createdAt", DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        "updatedAt",
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
