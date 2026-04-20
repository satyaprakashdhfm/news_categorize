from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FeedCardCreate(BaseModel):
    type: str                        # 'domain' | 'custom'
    title: str
    domain: Optional[str] = None    # POL / ECO / BUS / TEC / OTH
    subdomain: Optional[str] = None
    description: Optional[str] = None
    run_id: Optional[str] = None    # required for type='custom'
    is_global: bool = False


class FeedCardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_global: Optional[bool] = None


class FeedCardResponse(BaseModel):
    id: str
    type: str
    title: str
    domain: Optional[str] = None
    subdomain: Optional[str] = None
    description: Optional[str] = None
    run_id: Optional[str] = None
    created_by: Optional[str] = None
    is_global: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FeedCardListResponse(BaseModel):
    cards: List[FeedCardResponse]
    total: int


class AttachRunRequest(BaseModel):
    run_id: str
    query: str
    title: Optional[str] = None
    domain: Optional[str] = None
    subdomain: Optional[str] = None


class AttachRunResponse(BaseModel):
    merged: bool
    card_id: str
    message: str


class PinCardRequest(BaseModel):
    position: int = 0


class UserFeedCardResponse(BaseModel):
    id: str
    card_id: str
    position: int
    added_at: datetime
    card: FeedCardResponse

    class Config:
        from_attributes = True
