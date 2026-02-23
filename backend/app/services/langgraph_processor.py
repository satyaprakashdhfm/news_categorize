from typing import Optional, TypedDict
from google import genai
from langgraph.graph import StateGraph, END
from app.core.config import settings
import logging
import time

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Langfuse client — initialised once, optional (gracefully skipped if keys missing)
# ---------------------------------------------------------------------------
_langfuse = None

def _get_langfuse():
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
        logger.info("[LANGFUSE] Client initialised — observability active")
    except Exception as e:
        logger.warning(f"[LANGFUSE] Could not initialise client: {e}")
        _langfuse = None
    return _langfuse


class NewsProcessingState(TypedDict):
    """State for news processing workflow"""
    title: str
    content: str
    url: str
    country: str
    category: Optional[str]
    summary: Optional[str]
    thread_id: Optional[str]
    parent_id: Optional[str]
    existing_articles: list
    decision: Optional[str]


class NewsProcessorGraph:
    """LangGraph-based news processor using Google Gemini"""
    
    def __init__(self):
        """Initialize the news processor with Gemini and optional Langfuse tracing"""
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        self.model = "gemini-3-flash-preview"
        self.graph = self._build_graph()
        logger.info("[LANGGRAPH] NewsProcessor initialized with Gemini")
        # ensure Langfuse is reachable at startup
        _get_langfuse()
    
    def _classify_category_node(self, state: NewsProcessingState) -> NewsProcessingState:
        """Node: Classify article category using LLM"""
        logger.info(f"[LANGGRAPH] Classifying category for: {state['title'][:50]}...")

        prompt = (
            "You are a news categorization expert. Classify articles into exactly one of these categories: "
            "POL (Politics & Governance), ECO (Economy & Finance), BUS (Business & Markets), TEC (Science & Technology). "
            "Return ONLY the 3-letter code: POL, ECO, BUS, or TEC.\n\n"
            f"Title: {state['title']}\n\nContent: {state['content'][:2000]}"
        )

        try:
            t0 = time.time()
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            latency_ms = int((time.time() - t0) * 1000)
            category = response.text.strip().upper()

            # --- Langfuse: log generation ---
            lf = _get_langfuse()
            if lf:
                usage = getattr(response, "usage_metadata", None)
                lf.generation(
                    name="classify_category",
                    model=self.model,
                    input=prompt,
                    output=category,
                    metadata={"country": state.get("country"), "title": state["title"][:80]},
                    usage={
                        "input": getattr(usage, "prompt_token_count", 0),
                        "output": getattr(usage, "candidates_token_count", 0),
                        "total": getattr(usage, "total_token_count", 0),
                        "unit": "TOKENS",
                    },
                    latency=latency_ms,
                )

            valid_categories = ['POL', 'ECO', 'BUS', 'TEC']
            if category not in valid_categories:
                logger.warning(f"[LANGGRAPH] Invalid category '{category}', defaulting to ECO")
                category = 'ECO'

            state['category'] = category
            logger.info(f"[LANGGRAPH] Category classified: {category}")

        except Exception as e:
            logger.error(f"[LANGGRAPH] Error in category classification: {e}")
            state['category'] = 'ECO'

        return state

    def _generate_summary_node(self, state: NewsProcessingState) -> NewsProcessingState:
        """Node: Generate article summary using LLM"""
        logger.info(f"[LANGGRAPH] Generating summary for: {state['title'][:50]}...")

        prompt = (
            "You are a news summarization expert. Create a concise 2-3 sentence summary of the article. "
            "Be factual and objective.\n\n"
            f"Title: {state['title']}\n\nContent: {state['content'][:3000]}"
        )

        try:
            t0 = time.time()
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            latency_ms = int((time.time() - t0) * 1000)
            state['summary'] = response.text.strip()
            logger.info(f"[LANGGRAPH] Summary generated: {len(state['summary'])} chars")

            # --- Langfuse: log generation ---
            lf = _get_langfuse()
            if lf:
                usage = getattr(response, "usage_metadata", None)
                lf.generation(
                    name="generate_summary",
                    model=self.model,
                    input=prompt,
                    output=state['summary'],
                    metadata={"country": state.get("country"), "title": state["title"][:80]},
                    usage={
                        "input": getattr(usage, "prompt_token_count", 0),
                        "output": getattr(usage, "candidates_token_count", 0),
                        "total": getattr(usage, "total_token_count", 0),
                        "unit": "TOKENS",
                    },
                    latency=latency_ms,
                )

        except Exception as e:
            logger.error(f"[LANGGRAPH] Error generating summary: {e}")
            state['summary'] = state['title']

        return state

    def _find_threading_node(self, state: NewsProcessingState) -> NewsProcessingState:
        """Node: Find if article should be threaded with existing articles"""
        if not state.get('existing_articles'):
            logger.info("[LANGGRAPH] No existing articles, creating new thread")
            state['decision'] = 'NEW_THREAD'
            return state

        logger.info(f"[LANGGRAPH] Analyzing threading for: {state['title'][:50]}...")

        articles_text = "\n".join([
            f"{art['id']} | {art['title']} | {art.get('sourceUrl', 'N/A')}"
            for art in state['existing_articles'][:5]
        ])

        prompt = (
            "Decide if the NEW article should be threaded with one of the EXISTING articles. "
            "Choose the SINGLE most relevant existing article if related. "
            "Return EXACTLY the chosen article's ID string. "
            "If none are related, return 'NEW_THREAD'. "
            "Return only a bare ID or NEW_THREAD with no extra text.\n\n"
            f"New Article:\nTitle: {state['title']}\nURL: {state['url']}\n\n"
            f"Existing Articles (ID | Title | URL):\n{articles_text}\n\n"
            f"Return ONLY one of: {', '.join([art['id'] for art in state['existing_articles'][:5]])}, or NEW_THREAD."
        )

        try:
            t0 = time.time()
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            latency_ms = int((time.time() - t0) * 1000)
            decision = response.text.strip()
            state['decision'] = decision
            logger.info(f"[LANGGRAPH] Threading decision: {decision}")

            # --- Langfuse: log generation ---
            lf = _get_langfuse()
            if lf:
                usage = getattr(response, "usage_metadata", None)
                lf.generation(
                    name="find_threading",
                    model=self.model,
                    input=prompt,
                    output=decision,
                    metadata={"country": state.get("country"), "title": state["title"][:80]},
                    usage={
                        "input": getattr(usage, "prompt_token_count", 0),
                        "output": getattr(usage, "candidates_token_count", 0),
                        "total": getattr(usage, "total_token_count", 0),
                        "unit": "TOKENS",
                    },
                    latency=latency_ms,
                )

        except Exception as e:
            logger.error(f"[LANGGRAPH] Error in threading analysis: {e}")
            state['decision'] = 'NEW_THREAD'

        return state
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""
        workflow = StateGraph(NewsProcessingState)
        
        # Add nodes
        workflow.add_node("classify_category", self._classify_category_node)
        workflow.add_node("generate_summary", self._generate_summary_node)
        workflow.add_node("find_threading", self._find_threading_node)
        
        # Define the flow
        workflow.set_entry_point("classify_category")
        workflow.add_edge("classify_category", "generate_summary")
        workflow.add_edge("generate_summary", "find_threading")
        workflow.add_edge("find_threading", END)
        
        return workflow.compile()
    
    async def process_article(
        self,
        title: str,
        content: str,
        url: str,
        country: str,
        existing_articles: list = None
    ) -> dict:
        """Process a single article through the LangGraph workflow"""
        logger.info(f"[LANGGRAPH] Starting article processing: {title[:50]}...")

        # --- Langfuse: open a trace for this article ---
        lf = _get_langfuse()
        trace = None
        if lf:
            trace = lf.trace(
                name="process_article",
                input={"title": title, "url": url, "country": country},
                metadata={"country": country},
                tags=[country],
            )

        t_start = time.time()
        
        initial_state = NewsProcessingState(
            title=title,
            content=content,
            url=url,
            country=country,
            category=None,
            summary=None,
            thread_id=None,
            parent_id=None,
            existing_articles=existing_articles or [],
            decision=None
        )
        
        # Run the graph
        final_state = await self.graph.ainvoke(initial_state)
        
        result = {
            "category": final_state.get("category"),
            "summary": final_state.get("summary"),
            "threading_decision": final_state.get("decision"),
        }

        # --- Langfuse: close the trace with output ---
        if trace:
            try:
                trace.update(
                    output=result,
                    metadata={
                        "country": country,
                        "total_latency_ms": int((time.time() - t_start) * 1000),
                    },
                )
                lf.flush()
            except Exception as e:
                logger.warning(f"[LANGFUSE] Failed to update trace: {e}")

        logger.info(f"[LANGGRAPH] Article processing complete")
        return result


_news_processor_graph = None


def get_news_processor_graph():
    """Lazily create and return a shared NewsProcessorGraph instance."""
    global _news_processor_graph
    if _news_processor_graph is None:
        _news_processor_graph = NewsProcessorGraph()
    return _news_processor_graph
