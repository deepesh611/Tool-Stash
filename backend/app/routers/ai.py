import asyncio
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
    create_custom,
    current_model,
    current_provider,
    custom_provider_id,
    delete_custom,
    get_custom,
    has_api_key,
    list_custom,
    normalize_base_url,
    save as save_llm_settings,
    update_custom,
)
from app.providers.custom import probe_endpoint, redact_error
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


def _provider_options(ollama_models: list[str]) -> list[dict]:
    options = [
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
    ]
    for item in list_custom():
        options.append({
            "id": custom_provider_id(item["id"]),
            "label": item["name"],
            "available": True,
            "model": item["model"],
            "models": [item["model"]],
        })
    return options


@router.get("/provider")
async def get_llm_settings():
    provider = current_provider()
    ollama_models = await _ollama_models()
    return {
        "provider": provider,
        "model": current_model(provider),
        "providers": _provider_options(ollama_models),
    }


@router.put("/provider")
async def update_llm_settings(body: schemas.LlmSettingsUpdate):
    model = body.model.strip()
    if not model:
        raise HTTPException(status_code=400, detail="Model is required")
    try:
        save_llm_settings(body.provider, model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await get_llm_settings()


def _settings_error(exc: ValueError) -> HTTPException:
    status = 404 if str(exc) == "Custom endpoint not found" else 400
    return HTTPException(status_code=status, detail=str(exc))


@router.get("/custom")
async def get_custom_endpoints():
    return list_custom()


@router.post("/custom")
async def add_custom_endpoint(body: schemas.CustomLlmCreate):
    try:
        return create_custom(body.name, body.base_url, body.model, body.api_key)
    except ValueError as exc:
        raise _settings_error(exc) from exc


@router.post("/custom/test")
async def test_custom_endpoint(body: schemas.CustomLlmTest):
    try:
        base_url = normalize_base_url(body.base_url)
        model = body.model.strip()
        if not model:
            raise ValueError("Model is required")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    api_key = body.api_key
    if api_key is None and body.id:
        stored = get_custom(body.id)
        if stored is None:
            raise HTTPException(status_code=404, detail="Custom endpoint not found")
        api_key = stored["api_key"]
    secret = (api_key or "").strip()

    try:
        await asyncio.to_thread(probe_endpoint, base_url, model, secret)
    except Exception as exc:
        return {"ok": False, "message": redact_error(str(exc), secret)}
    return {"ok": True, "message": "Reached the endpoint."}


@router.put("/custom/{endpoint_id}")
async def edit_custom_endpoint(endpoint_id: str, body: schemas.CustomLlmUpdate):
    try:
        return update_custom(endpoint_id, body.name, body.base_url, body.model, body.api_key)
    except ValueError as exc:
        raise _settings_error(exc) from exc


@router.delete("/custom/{endpoint_id}")
async def remove_custom_endpoint(endpoint_id: str):
    try:
        delete_custom(endpoint_id)
    except ValueError as exc:
        raise _settings_error(exc) from exc
    return {"ok": True}
