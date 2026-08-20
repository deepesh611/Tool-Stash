import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app import models, schemas
from app.llm_settings import (
    CLAUDE_MODELS,
    OPENAI_MODELS,
    current_model,
    current_provider,
    has_api_key,
    save as save_llm_settings,
)
from app.providers.registry import get_provider

logger = logging.getLogger(__name__)

router = APIRouter()

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


@router.post("/research")
async def research_tool(request: schemas.ResearchRequest):
    provider = get_provider()
    return StreamingResponse(
        provider.research_stream(request.query),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/suggest")
async def suggest_tools(request: schemas.SuggestRequest, db: Session = Depends(get_db)):
    tools = db.query(models.Tool).order_by(models.Tool.created_at.desc()).all()
    provider = get_provider()
    return StreamingResponse(
        provider.suggest_stream(request.description, tools),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


def _with_current(options: list[str], selected: str) -> list[str]:
    names = [selected] + [item for item in options if item != selected]
    seen: set[str] = set()
    unique: list[str] = []
    for name in names:
        if name and name not in seen:
            seen.add(name)
            unique.append(name)
    return unique


async def _ollama_models() -> list[str]:
    selected = current_model("ollama")
    names: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ollama_base_url.rstrip('/')}/api/tags")
            response.raise_for_status()
            payload = response.json()
        for item in payload.get("models") or []:
            name = (item.get("name") or item.get("model") or "").strip()
            if name:
                names.append(name)
    except Exception:
        logger.warning("Could not list Ollama models")
    return _with_current(names, selected)


@router.get("/provider")
async def get_llm_settings():
    provider = current_provider()
    ollama_models = await _ollama_models()
    return {
        "provider": provider,
        "model": current_model(provider),
        "providers": [
            {
                "id": "claude",
                "label": "Claude",
                "available": has_api_key(settings.anthropic_api_key),
                "model": current_model("claude"),
                "models": _with_current(CLAUDE_MODELS, current_model("claude")),
            },
            {
                "id": "openai",
                "label": "OpenAI",
                "available": has_api_key(settings.openai_api_key),
                "model": current_model("openai"),
                "models": _with_current(OPENAI_MODELS, current_model("openai")),
            },
            {
                "id": "ollama",
                "label": "Ollama",
                "available": True,
                "model": current_model("ollama"),
                "models": ollama_models,
            },
        ],
    }


@router.put("/provider")
async def update_llm_settings(body: schemas.LlmSettingsUpdate):
    model = body.model.strip()
    if not model:
        raise HTTPException(status_code=400, detail="Model is required")
    save_llm_settings(body.provider, model)
    return await get_llm_settings()
