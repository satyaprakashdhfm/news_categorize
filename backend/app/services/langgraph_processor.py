from typing import Optional, TypedDict
from google import genai
from langgraph.graph import StateGraph, END
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


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
        """Initialize the news processor with Gemini LLM"""
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        self.model = "gemini-3-flash-preview"
        self.graph = self._build_graph()
        logger.info("[LANGGRAPH] NewsProcessor initialized with Gemini")
    
    def _classify_category_node(self, state: NewsProcessingState) -> NewsProcessingState:
        """Node: Classify article category using LLM"""
        logger.info(f"[LANGGRAPH] Classifying category for: {state['title'][:50]}...")

        prompt = (
            "You are a news categorization expert. Classify articles into exactly one of these categories: "
            "POL (Politics), ECO (Economy), SOC (Society), TEC (Technology), ENV (Environment), "
            "HEA (Health), SPO (Sports), SEC (Security). Return ONLY the 3-letter code.\n\n"
            f"Title: {state['title']}\n\nContent: {state['content'][:2000]}"
        )

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            category = response.text.strip().upper()

            valid_categories = ['POL', 'ECO', 'SOC', 'TEC', 'ENV', 'HEA', 'SPO', 'SEC']
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
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            state['summary'] = response.text.strip()
            logger.info(f"[LANGGRAPH] Summary generated: {len(state['summary'])} chars")

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
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            decision = response.text.strip()
            state['decision'] = decision
            logger.info(f"[LANGGRAPH] Threading decision: {decision}")

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
        
        logger.info(f"[LANGGRAPH] Article processing complete")
        
        return {
            "category": final_state.get("category"),
            "summary": final_state.get("summary"),
            "threading_decision": final_state.get("decision"),
        }


_news_processor_graph = None


def get_news_processor_graph():
    """Lazily create and return a shared NewsProcessorGraph instance."""
    global _news_processor_graph
    if _news_processor_graph is None:
        _news_processor_graph = NewsProcessorGraph()
    return _news_processor_graph
