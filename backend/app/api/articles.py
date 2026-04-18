from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.core.database import get_db
from app.models import Article, StoryThread, CategoryEnum, CountryEnum
from app.schemas import ArticleResponse, ArticleListResponse, StatsResponse, CountryCount, CategoryCount
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.get("", response_model=ArticleListResponse)
async def get_articles(
    country: Optional[str] = Query(None),
    categories: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    day: Optional[str] = Query(None),
    hours_back: Optional[int] = Query(None, ge=1, le=240),
    limit: int = Query(20, ge=1, le=100),
    stats: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Get articles with optional filtering
    
    - **country**: Filter by country code (e.g., USA, INDIA)
    - **categories**: Comma-separated category codes (e.g., POL,ECO)
    - **domain**: Filter source URL by domain keyword
    - **day**: Filter by date (YYYY-MM-DD)
    - **hours_back**: Filter to recent N hours
    - **limit**: Maximum number of articles to return
    - **stats**: Include statistics in response
    """
    try:
        # Build query
        query = db.query(Article)

        day_value: date | None = None
        if day:
            try:
                day_value = datetime.strptime(day, "%Y-%m-%d").date()
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="day must be YYYY-MM-DD") from exc
        
        if country:
            query = query.filter(Article.country == country)
        
        if categories:
            category_list = [cat.strip() for cat in categories.split(',') if cat.strip()]
            if category_list:
                query = query.filter(Article.category.in_(category_list))

        if domain:
            query = query.filter(Article.source_url.ilike(f"%{domain.strip()}%"))

        if day_value:
            query = query.filter(func.date(Article.published_at) == day_value)
        elif hours_back:
            since = datetime.now() - timedelta(hours=int(hours_back))
            query = query.filter(Article.published_at >= since)
        
        # Fetch articles
        articles = query.order_by(desc(Article.published_at)).limit(limit).all()
        
        # Get stats if requested
        stats_data = None
        if stats:
            # Total articles
            total_articles = db.query(Article).count()
            
            # Recent articles (last 24 hours)
            yesterday = datetime.now() - timedelta(hours=24)
            recent_articles = db.query(Article).filter(
                Article.scraped_at >= yesterday
            ).count()
            
            # Active threads
            active_threads = db.query(Article.thread_id).filter(
                Article.thread_id.isnot(None)
            ).distinct().count()
            
            # Country counts
            country_counts_raw = db.query(
                Article.country,
                func.count(Article.country).label('count')
            ).group_by(Article.country).all()
            
            country_counts = [
                CountryCount(country=str(c[0].value), count=c[1])
                for c in country_counts_raw
            ]
            
            # Category counts
            category_counts_raw = db.query(
                Article.category,
                func.count(Article.category).label('count')
            ).group_by(Article.category).all()
            
            category_counts = [
                CategoryCount(category=str(c[0].value), count=c[1])
                for c in category_counts_raw
            ]
            
            stats_data = StatsResponse(
                total_articles=total_articles,
                recent_articles=recent_articles,
                active_threads=active_threads,
                country_counts=country_counts,
                category_counts=category_counts
            )
        
        return ArticleListResponse(
            articles=[ArticleResponse.from_orm(art) for art in articles],
            stats=stats_data.dict() if stats_data else None
        )
        
    except Exception as e:
        logger.error(f"Error fetching articles: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch articles")


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: str,
    db: Session = Depends(get_db)
):
    """Get a single article by ID"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return ArticleResponse.from_orm(article)
