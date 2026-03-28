from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional


class CustomAgentCreate(BaseModel):
    title: Optional[str] = None
    prompt: str = Field(..., min_length=3, max_length=4000)


class CustomAgentResponse(BaseModel):
    id: str
    title: str
    prompt: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class CustomAgentListResponse(BaseModel):
    agents: List[CustomAgentResponse]


class CustomSearchRequest(BaseModel):
    date: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=50)


class CustomSearchArticle(BaseModel):
    title: str
    url: str
    summary: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    published_at: Optional[str] = None
    score: int


class CustomSearchResponse(BaseModel):
    agent: CustomAgentResponse
    total_found: int
    limit: int
    date: str
    articles: List[CustomSearchArticle]


class CustomFeedResponse(BaseModel):
    agent: CustomAgentResponse
    total_found: int
    limit: int
    date: str
    articles: List[CustomSearchArticle]
