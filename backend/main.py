import warnings
warnings.filterwarnings("ignore", message="Field name .* shadows an attribute in parent", category=UserWarning)

from dotenv import load_dotenv
from pathlib import Path

# Load .env early so environment variables are available to imported modules
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import articles, scraping, custom_agents, custom_youtube, custom_reddit, browser_research, debug
from app.api import auth, feed_cards
from app.core.database import Base, engine
import app.models  # noqa: F401 - ensure models are registered before create_all
from app.core.config import settings
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(name)s - %(message)s'
)

# Suppress noisy third-party loggers
logging.getLogger("google_genai.models").setLevel(logging.WARNING)
logging.getLogger("google_genai.types").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Curio API",
    description="Global News Intelligence Platform with AI-powered analysis",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(feed_cards.router)
app.include_router(articles.router)
app.include_router(scraping.router)
app.include_router(custom_agents.router)
app.include_router(custom_youtube.router)
app.include_router(custom_reddit.router)
app.include_router(browser_research.router)
app.include_router(debug.router)


@app.on_event("startup")
async def startup_event():
    # Auto-create missing tables (including custom_agents) for this project setup.
    Base.metadata.create_all(bind=engine)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Curio API",
        "version": "2.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
