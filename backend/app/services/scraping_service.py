from tavily import TavilyClient
from app.core.config import settings
from app.services.langgraph_processor import get_news_processor_graph
from sqlalchemy.orm import Session
from app.models import Article, StoryThread, CategoryEnum, CountryEnum
from datetime import datetime
import logging
import asyncio
from typing import List, Dict
import time

logger = logging.getLogger(__name__)

tavily_client = TavilyClient(api_key=settings.TVLY_API_KEY)


class NewsScrapingService:
    """Service for scraping news using Tavily API and processing with LangGraph"""
    
    def __init__(self):
        self.is_running = False
        self.should_stop = False  # Flag to stop scraping gracefully
        self.stats = {
            "total_articles_found": 0,
            "articles_processed": 0,
            "articles_skipped": 0,
            "errors": 0,
            "countries_processed": [],
            "categories_found": [],
            "status": "idle"
        }
        # Rate limiting settings
        self.request_delay = 1.0  # 1 second between Tavily API calls
        self.processing_delay = 0.5  # 0.5 seconds between article processing
        self.max_retries = 3  # Maximum retry attempts for failed requests
        self.retry_delay = 2.0  # Delay between retries (exponential backoff)
    
    async def scrape_country_topic(
        self,
        db: Session,
        countries: List[str],
        topics: List[str],
        date: str
    ) -> Dict:
        """Scrape news for given countries and topics with rate limiting and safety"""
        if self.is_running:
            raise Exception("Scraping is already running")
        
        self.is_running = True
        self.should_stop = False
        self.stats["status"] = "running"
        self.stats["countries_processed"] = []
        self.stats["categories_found"] = []
        self.stats["total_articles_found"] = 0
        self.stats["articles_processed"] = 0
        self.stats["articles_skipped"] = 0
        self.stats["errors"] = 0
        
        logger.info(f"[SCRAPER] Starting scraping for {len(countries)} countries and {len(topics)} topics")
        logger.info(f"[SCRAPER] Rate limiting: {self.request_delay}s between API calls, {self.processing_delay}s between articles")
        
        try:
            for country_idx, country in enumerate(countries):
                # Check if stop was requested
                if self.should_stop:
                    logger.info("[SCRAPER] Stop requested, terminating scraping")
                    self.stats["status"] = "stopped"
                    break
                
                country_name = self._get_country_name(country)
                self.stats["countries_processed"].append(country)
                
                for topic_idx, topic in enumerate(topics):
                    # Check if stop was requested
                    if self.should_stop:
                        logger.info("[SCRAPER] Stop requested, terminating scraping")
                        self.stats["status"] = "stopped"
                        break
                        
                    logger.info(f"[SCRAPER] Searching: {country_name} - {topic}")
                    
                    # Rate limit: Wait before making API call (except first request)
                    if country_idx > 0 or topic_idx > 0:
                        logger.debug(f"[SCRAPER] Rate limiting: waiting {self.request_delay}s before next API call")
                        await asyncio.sleep(self.request_delay)
                    
                    # Use Tavily to search for news with retry logic
                    query = f"{country_name} {topic} news {date}"
                    search_results = await self._search_with_retry(query)
                    
                    if search_results:
                        self.stats["total_articles_found"] += len(search_results.get("results", []))
                        
                        # Process each article with delay between them
                        for idx, result in enumerate(search_results.get("results", [])):
                            # Rate limit between article processing
                            if idx > 0:
                                await asyncio.sleep(self.processing_delay)
                            
                            await self._process_article(
                                db=db,
                                title=result.get("title", ""),
                                content=result.get("content", ""),
                                url=result.get("url", ""),
                                country=country,
                                published_at=result.get("published_date", datetime.now().isoformat())
                            )
            
            self.stats["status"] = "completed"
            logger.info("[SCRAPER] Scraping completed successfully")
            logger.info(f"[SCRAPER] Final stats: {self.stats['articles_processed']} processed, {self.stats['articles_skipped']} skipped, {self.stats['errors']} errors")
            
        except Exception as e:
            logger.error(f"[SCRAPER] Fatal error: {e}")
            self.stats["status"] = "error"
            raise
        finally:
            self.is_running = False
        
        return self.stats
    
    async def _search_with_retry(self, query: str) -> dict:
        """Search with exponential backoff retry logic"""
        for attempt in range(self.max_retries):
            try:
                logger.debug(f"[SCRAPER] Tavily search attempt {attempt + 1}/{self.max_retries}: {query}")
                
                # Make the search call (note: tavily_client.search is sync, so we run it in executor)
                search_results = await asyncio.to_thread(
                    tavily_client.search,
                    query=query,
                    search_depth="advanced",
                    max_results=5,
                    include_domains=[],
                    exclude_domains=[]
                )
                
                logger.info(f"[SCRAPER] Tavily returned {len(search_results.get('results', []))} results")
                return search_results
                
            except Exception as e:
                logger.warning(f"[SCRAPER] Search attempt {attempt + 1} failed: {e}")
                
                if attempt < self.max_retries - 1:
                    # Exponential backoff: 2s, 4s, 8s
                    backoff_time = self.retry_delay * (2 ** attempt)
                    logger.info(f"[SCRAPER] Retrying in {backoff_time}s...")
                    await asyncio.sleep(backoff_time)
                else:
                    logger.error(f"[SCRAPER] All {self.max_retries} attempts failed for query: {query}")
                    self.stats["errors"] += 1
                    return None
        
        return None
    
    async def _process_article(
        self,
        db: Session,
        title: str,
        content: str,
        url: str,
        country: str,
        published_at: str
    ):
        """Process a single article using LangGraph with safety checks"""
        try:
            # Safety check: Validate required fields
            if not title or not url:
                logger.warning(f"[SCRAPER] Skipping article with missing title or URL")
                self.stats["articles_skipped"] += 1
                return
            
            # Safety check: URL validation (basic)
            if not url.startswith(('http://', 'https://')):
                logger.warning(f"[SCRAPER] Skipping article with invalid URL: {url}")
                self.stats["articles_skipped"] += 1
                return
            
            # Safety check: Title length validation
            if len(title) < 10 or len(title) > 500:
                logger.warning(f"[SCRAPER] Skipping article with unusual title length ({len(title)} chars): {title[:50]}")
                self.stats["articles_skipped"] += 1
                return
            
            # Check if article already exists (duplicate detection)
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
            
            # Safety: Wrap AI processing in try-catch
            try:
                result = await processor.process_article(
                    title=title,
                    content=content or title,  # Fallback to title if no content
                    url=url,
                    country=country,
                    existing_articles=existing_articles_data
                )
            except Exception as ai_error:
                logger.error(f"[SCRAPER] AI processing failed for {url}: {ai_error}")
                # Use defaults if AI fails
                result = {
                    "category": "ECO",  # Default category
                    "summary": title,   # Use title as summary
                    "threading_decision": "NEW_THREAD"
                }
                self.stats["errors"] += 1
            
            # Generate DNA code
            year = datetime.now().year
            category = result["category"]
            
            # Safety: Validate category
            if category not in [c.value for c in CategoryEnum]:
                logger.warning(f"[SCRAPER] Invalid category '{category}', defaulting to ECO")
                category = "ECO"
            
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
                title=title[:500],  # Safety: Truncate if too long
                content=content[:50000] if content else None,  # Safety: Limit content size
                summary=result["summary"][:1000] if result.get("summary") else title[:500],
                source_url=url[:1000],  # Safety: Truncate URL
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
            "CHINA": "China",
            "GERMANY": "Germany",
            "INDIA": "India",
            "JAPAN": "Japan",
            "UK": "United Kingdom",
            "FRANCE": "France",
            "ITALY": "Italy"
        }
        return country_map.get(code, code)


# Singleton instance
news_scraping_service = NewsScrapingService()
