from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta
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
    limit: int = Query(20, ge=1, le=100),
    stats: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Get articles with optional filtering
    
    - **country**: Filter by country code (e.g., USA, INDIA)
    - **categories**: Comma-separated category codes (e.g., POL,ECO)
    - **limit**: Maximum number of articles to return
    - **stats**: Include statistics in response
    """
    try:
        # Build query
        query = db.query(Article)
        
        if country:
            query = query.filter(Article.country == country)
        
        if categories:
            category_list = [cat.strip() for cat in categories.split(',') if cat.strip()]
            if category_list:
                query = query.filter(Article.category.in_(category_list))
        
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
