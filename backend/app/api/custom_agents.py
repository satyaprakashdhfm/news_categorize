from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import CustomAgent, CustomAgentFeedArticle
from app.schemas import (
    CustomFeedResponse,
    CustomAgentCreate,
    CustomAgentListResponse,
    CustomAgentResponse,
    CustomSearchRequest,
    CustomSearchResponse,
)
from app.services.custom_agent_service import build_title_from_prompt, search_prompt_articles


router = APIRouter(prefix="/api/custom-agents", tags=["custom-agents"])


@router.get("", response_model=CustomAgentListResponse)
async def list_custom_agents(db: Session = Depends(get_db)):
    agents = db.query(CustomAgent).order_by(desc(CustomAgent.created_at)).all()
    return CustomAgentListResponse(agents=[CustomAgentResponse.model_validate(a) for a in agents])


@router.post("", response_model=CustomAgentResponse)
async def create_custom_agent(payload: CustomAgentCreate, db: Session = Depends(get_db)):
    prompt = payload.prompt.strip()
    title = (payload.title or "").strip() or build_title_from_prompt(prompt)

    agent = CustomAgent(
        id=str(uuid4()),
        title=title,
        prompt=prompt,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return CustomAgentResponse.model_validate(agent)


@router.get("/{agent_id}", response_model=CustomAgentResponse)
async def get_custom_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(CustomAgent).filter(CustomAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Custom agent not found")
    return CustomAgentResponse.model_validate(agent)


@router.delete("/{agent_id}")
async def delete_custom_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(CustomAgent).filter(CustomAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Custom agent not found")

    db.query(CustomAgentFeedArticle).filter(CustomAgentFeedArticle.agent_id == agent_id).delete()
    db.delete(agent)
    db.commit()
    return {"message": "Custom agent deleted"}


@router.get("/{agent_id}/latest-feed", response_model=CustomFeedResponse)
async def get_latest_custom_feed(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(CustomAgent).filter(CustomAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Custom agent not found")

    rows = (
        db.query(CustomAgentFeedArticle)
        .filter(CustomAgentFeedArticle.agent_id == agent_id)
        .order_by(CustomAgentFeedArticle.created_at.desc())
        .all()
    )

    if not rows:
        return CustomFeedResponse(
            agent=CustomAgentResponse.model_validate(agent),
            total_found=0,
            limit=5,
            country="USA",
            date=datetime.now().strftime("%Y-%m-%d"),
            articles=[],
        )

    articles = [
        {
            "title": row.title,
            "url": row.url,
            "summary": row.summary,
            "content": row.content,
            "image_url": row.image_url,
            "published_at": row.published_at,
            "score": int(row.score or 0),
        }
        for row in rows
    ]

    return CustomFeedResponse(
        agent=CustomAgentResponse.model_validate(agent),
        total_found=len(articles),
        limit=len(articles),
        country="USA",
        date=datetime.now().strftime("%Y-%m-%d"),
        articles=articles,
    )


@router.post("/{agent_id}/search", response_model=CustomSearchResponse)
async def search_custom_agent_feed(
    agent_id: str,
    request: CustomSearchRequest,
    db: Session = Depends(get_db),
):
    agent = db.query(CustomAgent).filter(CustomAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Custom agent not found")

    # Default limit is 5 for concise, high-relevance custom feed results.
    articles = await search_prompt_articles(
        prompt=agent.prompt,
        country=request.country,
        date=request.date,
        limit=request.limit,
    )

    # Append this run into persistent custom feed history.
    for idx, article in enumerate(articles):
        db.add(
            CustomAgentFeedArticle(
                id=str(uuid4()),
                agent_id=agent_id,
                title=(article.get("title") or "Untitled")[:500],
                url=(article.get("url") or "")[:1000],
                summary=(article.get("summary") or None),
                content=(article.get("content") or None),
                image_url=(article.get("image_url") or None),
                published_at=(article.get("published_at") or None),
                score=float(article.get("score") or 0),
                position=idx,
            )
        )
    db.commit()

    query_date = request.date or datetime.now().strftime("%Y-%m-%d")
    return CustomSearchResponse(
        agent=CustomAgentResponse.model_validate(agent),
        total_found=len(articles),
        limit=request.limit,
        country=request.country,
        date=query_date,
        articles=articles,
    )
