import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_langfuse = None

def get_langfuse():
    """Lazily initialize and return the Langfuse client."""
    global _langfuse
    if _langfuse is not None:
        return _langfuse
    
    if not settings.LANGFUSE_SECRET_KEY or not settings.LANGFUSE_PUBLIC_KEY:
        return None
        
    try:
        from langfuse import Langfuse
        _langfuse = Langfuse(
            secret_key=settings.LANGFUSE_SECRET_KEY,
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            host=settings.LANGFUSE_BASE_URL,
        )
        logger.info("[OBSERVABILITY] Langfuse client initialized")
    except Exception as e:
        logger.warning(f"[OBSERVABILITY] Could not initialize Langfuse: {e}")
        _langfuse = None
        
    return _langfuse
