from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class BrowserScrapeRecord(Base):
    __tablename__ = "browser_scrape_records"

    id = Column(String, primary_key=True)
    run_id = Column(String(64), nullable=False, index=True)
    requested_url = Column(String(1000), nullable=False, index=True)
    final_url = Column(String(1000), nullable=False)
    title = Column(String(500), nullable=True)
    extracted_text = Column(Text, nullable=False)
    mode = Column(String(32), nullable=False, default="browser")
    output_format = Column(String(32), nullable=False, default="text")
    scrape_source = Column(String(64), nullable=False, default="browser_satya", index=True)
    truncated_text = Column(Integer, nullable=False, default=0)
    scraped_at = Column("scrapedAt", DateTime, server_default=func.now(), nullable=False)
