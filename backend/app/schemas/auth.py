from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    interests: Optional[list[str]] = None
    timezone: Optional[str] = "UTC"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    interests: Optional[list[str]] = None
    timezone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateInterestsRequest(BaseModel):
    interests: list[str]  # e.g. ["POL", "TEC", "ECO"]


class UpdateProfileRequest(BaseModel):
    timezone: Optional[str] = None
