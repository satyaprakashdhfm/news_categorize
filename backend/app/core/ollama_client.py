import logging
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)


class _OllamaResponse:
    def __init__(self, text: str):
        self.text = text
        self.usage_metadata = None


class _OllamaModels:
    def __init__(self, base_url: str):
        self._base_url = base_url

    def generate_content(self, model: str, contents: str) -> _OllamaResponse:
        resp = requests.post(
            f"{self._base_url}/api/generate",
            json={"model": model, "prompt": contents, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()
        return _OllamaResponse(resp.json().get("response", ""))


class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.models = _OllamaModels(base_url)


def get_llm_client():
    """Return active LLM client — Ollama when USE_OLLAMA=true, else Gemini."""
    if settings.USE_OLLAMA:
        return OllamaClient(base_url=settings.OLLAMA_BASE_URL)
    from google import genai
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


def get_active_model() -> str:
    return settings.OLLAMA_MODEL if settings.USE_OLLAMA else settings.GEMINI_MODEL
