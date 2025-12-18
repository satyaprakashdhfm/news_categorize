from tavily import TavilyClient
from app.core.config import settings
from app.services.langgraph_processor import get_news_processor_graph
from sqlalchemy.orm import Session
from app.models import Article, StoryThread, CategoryEnum, CountryEnum
from datetime import datetime
import logging
import asyncio
from typing import List, Dict

logger = logging.getLogger(__name__)

tavily_client = TavilyClient(api_key=settings.TVLY_API_KEY)


class NewsScrapingService:
    """Service for scraping news using Tavily API and processing with LangGraph"""
    
    def __init__(self):
        self.is_running = False
        self.stats = {
            "total_articles_found": 0,
            "articles_processed": 0,
            "articles_skipped": 0,
            "errors": 0,
            "countries_processed": [],
            "categories_found": [],
            "status": "idle"
        }
    
    async def scrape_country_topic(
        self,
        db: Session,
        countries: List[str],
        topics: List[str],
        date: str
    ) -> Dict:
        """Scrape news for given countries and topics"""
        if self.is_running:
            raise Exception("Scraping is already running")
        
        self.is_running = True
        self.stats["status"] = "running"
        self.stats["countries_processed"] = []
        self.stats["categories_found"] = []
        
        logger.info(f"[SCRAPER] Starting scraping for {len(countries)} countries and {len(topics)} topics")
        
        try:
            for country in countries:
                country_name = self._get_country_name(country)
                self.stats["countries_processed"].append(country)
                
                for topic in topics:
                    logger.info(f"[SCRAPER] Searching: {country_name} - {topic}")
                    
                    # Use Tavily to search for news
                    query = f"{country_name} {topic} news {date}"
                    
                    try:
                        search_results = tavily_client.search(
                            query=query,
                            search_depth="advanced",
                            max_results=5,
                            include_domains=[],
                            exclude_domains=[]
                        )
                        
                        self.stats["total_articles_found"] += len(search_results.get("results", []))
                        
                        # Process each article
                        for result in search_results.get("results", []):
                            await self._process_article(
                                db=db,
                                title=result.get("title", ""),
                                content=result.get("content", ""),
                                url=result.get("url", ""),
                                country=country,
                                published_at=result.get("published_date", datetime.now().isoformat())
                            )
                        
                    except Exception as e:
                        logger.error(f"[SCRAPER] Error searching {country_name} - {topic}: {e}")
                        self.stats["errors"] += 1
            
            self.stats["status"] = "completed"
            logger.info("[SCRAPER] Scraping completed successfully")
            
        except Exception as e:
            logger.error(f"[SCRAPER] Fatal error: {e}")
            self.stats["status"] = "error"
            raise
        finally:
            self.is_running = False
        
        return self.stats
    
    async def _process_article(
        self,
        db: Session,
        title: str,
        content: str,
        url: str,
        country: str,
        published_at: str
    ):
        """Process a single article using LangGraph"""
        try:
            # Check if article already exists
            existing = db.query(Article).filter(Article.source_url == url).first()
            if existing:
                logger.info(f"[SCRAPER] Article already exists: {url}")
                self.stats["articles_skipped"] += 1
                return
            
            # Get existing articles for threading
            existing_articles = db.query(Article).filter(
                Article.country == country
            ).order_by(Article.published_at.desc()).limit(5).all()
            
            existing_articles_data = [
                {
                    "id": art.id,
                    "title": art.title,
                    "sourceUrl": art.source_url
                }
                for art in existing_articles
            ]
            
            # Process with LangGraph (create processor lazily)
            processor = get_news_processor_graph()
            result = await processor.process_article(
                title=title,
                content=content,
                url=url,
                country=country,
                existing_articles=existing_articles_data
            )
            
            # Generate DNA code
            year = datetime.now().year
            category = result["category"]
            
            # Get next sequence number
            last_article = db.query(Article).filter(
                Article.country == country,
                Article.category == category,
                Article.year == year
            ).order_by(Article.sequence_num.desc()).first()
            
            sequence_num = (last_article.sequence_num + 1) if last_article else 1
            dna_code = f"{country}-{category}-{year}-{sequence_num:04d}"
            
            # Determine threading
            parent_id = None
            thread_id = None
            
            if result["threading_decision"] != "NEW_THREAD":
                parent_article = db.query(Article).filter(
                    Article.id == result["threading_decision"]
                ).first()
                if parent_article:
                    parent_id = parent_article.id
                    thread_id = parent_article.thread_id or parent_article.id
            
            # Create new article
            from uuid import uuid4
            new_article = Article(
                id=str(uuid4()),
                dna_code=dna_code,
                title=title,
                content=content,
                summary=result["summary"],
                source_url=url,
                published_at=datetime.fromisoformat(published_at.replace('Z', '+00:00')) if 'T' in published_at else datetime.now(),
                country=CountryEnum[country],
                category=CategoryEnum[category],
                year=year,
                sequence_num=sequence_num,
                parent_id=parent_id,
                thread_id=thread_id
            )
            
            db.add(new_article)
            db.commit()
            
            self.stats["articles_processed"] += 1
            if category not in self.stats["categories_found"]:
                self.stats["categories_found"].append(category)
            
            logger.info(f"[SCRAPER] Article saved: {dna_code}")
            
        except Exception as e:
            logger.error(f"[SCRAPER] Error processing article: {e}")
            self.stats["errors"] += 1
            db.rollback()
    
    def _get_country_name(self, code: str) -> str:
        """Convert country code to name"""
        country_map = {
            "USA": "United States",
            "RUSSIA": "Russia",
            "INDIA": "India",
            "CHINA": "China",
            "JAPAN": "Japan"
        }
        return country_map.get(code, code)


# Singleton instance
news_scraping_service = NewsScrapingService()
