from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.scraping_service import news_scraping_service
from pydantic import BaseModel
from typing import List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/scraping", tags=["admin"])


class ScrapingRequest(BaseModel):
    countries: List[str]
    topics: List[str]
    date: str


class ScrapingResponse(BaseModel):
    message: str
    status: str


@router.post("/start", response_model=ScrapingResponse)
async def start_scraping(
    request: ScrapingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start news scraping in the background"""
    try:
        if news_scraping_service.is_running:
            raise HTTPException(status_code=400, detail="Scraping is already running")
        
        # Run scraping in background
        background_tasks.add_task(
            news_scraping_service.scrape_country_topic,
            db,
            request.countries,
            request.topics,
            request.date
        )
        
        return ScrapingResponse(
            message="Scraping started successfully",
            status="running"
        )
        
    except Exception as e:
        logger.error(f"Error starting scraping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress")
async def get_scraping_progress():
    """Get current scraping progress"""
    return {
        "status": news_scraping_service.stats["status"],
        "stats": news_scraping_service.stats
    }


@router.get("/status")
async def get_scraping_status():
    """Get scraping service status"""
    return {
        "is_running": news_scraping_service.is_running,
        "status": news_scraping_service.stats["status"]
    }
