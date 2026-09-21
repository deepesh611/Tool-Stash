import json
import logging
import uuid
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

from app.config import settings
from app.database import sqlite_file_path

logger = logging.getLogger(__name__)

ProviderId = Literal["claude", "openai", "ollama"]
BUILTIN_PROVIDERS = ("claude", "openai", "ollama")
CUSTOM_PREFIX = "custom:"

CLAUDE_MODELS = [
    "claude-sonnet-5",
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
]

OPENAI_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "o3",
    "o4-mini",
]


def _settings_path() -> Path:
    db_path = sqlite_file_path(settings.database_url)
    if db_path is None:
        return Path("data/llm-settings.json")
    return db_path.parent / "llm-settings.json"


def _defaults() -> dict[str, Any]:
    return {
        "provider": settings.llm_provider,
        "models": {
            "claude": settings.anthropic_model,
            "openai": settings.openai_model,
            "ollama": settings.ollama_model,
        },
        "custom": [],
    }


def custom_provider_id(endpoint_id: str) -> str:
    return f"{CUSTOM_PREFIX}{endpoint_id}"


def custom_id_from_provider(provider: str) -> str | None:
    if not provider.startswith(CUSTOM_PREFIX):
        return None
    endpoint_id = provider[len(CUSTOM_PREFIX):].strip()
    return endpoint_id or None


def normalize_base_url(url: str) -> str:
    text = (url or "").strip().rstrip("/")
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Base URL must start with http:// or https://")
    if len(text) > 500:
        raise ValueError("Base URL is too long")
    return text


def _clean_custom(item: Any) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    endpoint_id = str(item.get("id") or "").strip()
    name = str(item.get("name") or "").strip()
    model = str(item.get("model") or "").strip()
    api_key = str(item.get("api_key") or "").strip()
    if not endpoint_id or not name or not model:
        return None
    try:
        base_url = normalize_base_url(str(item.get("base_url") or ""))
    except ValueError:
        return None
    return {
        "id": endpoint_id,
        "name": name[:80],
        "base_url": base_url[:500],
        "model": model[:200],
        "api_key": api_key,
    }


def _public(item: dict[str, str]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "name": item["name"],
        "base_url": item["base_url"],
        "model": item["model"],
        "has_key": bool(item.get("api_key")),
    }


def _write(data: dict[str, Any]) -> None:
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def load() -> dict[str, Any]:
    path = _settings_path()
    data = _defaults()
    if path.exists():
        try:
            stored = json.loads(path.read_text())
            models = stored.get("models") or {}
            for key in BUILTIN_PROVIDERS:
                if isinstance(models.get(key), str) and models[key].strip():
                    data["models"][key] = models[key].strip()
            custom: list[dict[str, str]] = []
            seen: set[str] = set()
            for item in stored.get("custom") or []:
                cleaned = _clean_custom(item)
                if cleaned is None or cleaned["id"] in seen:
                    continue
                seen.add(cleaned["id"])
                custom.append(cleaned)
            data["custom"] = custom
            provider = stored.get("provider")
            if provider in BUILTIN_PROVIDERS:
                data["provider"] = provider
            elif isinstance(provider, str):
                endpoint_id = custom_id_from_provider(provider)
                if endpoint_id and endpoint_id in seen:
                    data["provider"] = custom_provider_id(endpoint_id)
        except (OSError, json.JSONDecodeError):
            logger.warning("Could not read LLM settings file; using defaults")
    return data


def _require_text(value: str, label: str, limit: int) -> str:
    text = (value or "").strip()
    if not text:
        raise ValueError(f"{label} is required")
    return text[:limit]


def save(provider: str, model: str) -> dict[str, Any]:
    model_name = _require_text(model, "Model", 200)
    data = load()
    endpoint_id = custom_id_from_provider(provider)
    if endpoint_id:
        match = next((item for item in data["custom"] if item["id"] == endpoint_id), None)
        if match is None:
            raise ValueError("Custom endpoint not found")
        match["model"] = model_name
        data["provider"] = custom_provider_id(endpoint_id)
    elif provider in BUILTIN_PROVIDERS:
        data["provider"] = provider
        data["models"][provider] = model_name
    else:
        raise ValueError("Unknown LLM provider")
    _write(data)
    logger.info("LLM provider updated")
    return data


def current_provider() -> str:
    return load()["provider"]


def current_model(provider: str | None = None) -> str:
    data = load()
    name = provider or data["provider"]
    endpoint_id = custom_id_from_provider(name)
    if endpoint_id:
        match = next((item for item in data["custom"] if item["id"] == endpoint_id), None)
        if match:
            return match["model"]
        name = _defaults()["provider"]
    return data["models"].get(name) or _defaults()["models"][name]


def get_custom(endpoint_id: str) -> dict[str, str] | None:
    data = load()
    return next((item for item in data["custom"] if item["id"] == endpoint_id), None)


def list_custom() -> list[dict[str, Any]]:
    return [_public(item) for item in load()["custom"]]


def create_custom(name: str, base_url: str, model: str, api_key: str) -> dict[str, Any]:
    item = {
        "id": uuid.uuid4().hex,
        "name": _require_text(name, "Name", 80),
        "base_url": normalize_base_url(base_url),
        "model": _require_text(model, "Model", 200),
        "api_key": (api_key or "").strip(),
    }
    data = load()
    data["custom"].append(item)
    _write(data)
    logger.info("Custom LLM endpoint created")
    return _public(item)


def update_custom(
    endpoint_id: str,
    name: str,
    base_url: str,
    model: str,
    api_key: str | None,
) -> dict[str, Any]:
    data = load()
    match = next((item for item in data["custom"] if item["id"] == endpoint_id), None)
    if match is None:
        raise ValueError("Custom endpoint not found")
    match["name"] = _require_text(name, "Name", 80)
    match["base_url"] = normalize_base_url(base_url)
    match["model"] = _require_text(model, "Model", 200)
    if api_key is not None:
        match["api_key"] = api_key.strip()
    _write(data)
    logger.info("Custom LLM endpoint updated")
    return _public(match)


def delete_custom(endpoint_id: str) -> None:
    data = load()
    remaining = [item for item in data["custom"] if item["id"] != endpoint_id]
    if len(remaining) == len(data["custom"]):
        raise ValueError("Custom endpoint not found")
    data["custom"] = remaining
    if data["provider"] == custom_provider_id(endpoint_id):
        data["provider"] = _defaults()["provider"]
    _write(data)
    logger.info("Custom LLM endpoint deleted")


def has_api_key(value: str) -> bool:
    text = (value or "").strip()
    return bool(text) and not text.endswith("...")
