from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


class ToolBase(BaseModel):
    name: str
    url: Optional[str] = None
    description: str
    category: str
    homepage: Optional[str] = None
    github_url: Optional[str] = None
    docs_url: Optional[str] = None
    what_it_is: Optional[str] = None
    why_it_exists: Optional[str] = None
    features: list[str] = []
    when_to_use: list[str] = []
    when_not_to_use: list[str] = []
    tags: list[str] = []
    personal_notes: Optional[str] = ""


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    personal_notes: Optional[str] = None
    tags: Optional[list[str]] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    homepage: Optional[str] = None
    github_url: Optional[str] = None
    docs_url: Optional[str] = None
    what_it_is: Optional[str] = None
    why_it_exists: Optional[str] = None
    features: Optional[list[str]] = None
    when_to_use: Optional[list[str]] = None
    when_not_to_use: Optional[list[str]] = None


class ToolResponse(ToolBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ResearchRequest(BaseModel):
    query: str


class SuggestRequest(BaseModel):
    description: str


class LlmSettingsUpdate(BaseModel):
    provider: Literal["claude", "openai", "ollama"]
    model: str
