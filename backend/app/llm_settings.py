import json
import logging
from pathlib import Path
from typing import Any, Literal

from app.config import settings
from app.database import sqlite_file_path

logger = logging.getLogger(__name__)

ProviderId = Literal["claude", "openai", "ollama"]

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
    }


def load() -> dict[str, Any]:
    path = _settings_path()
    data = _defaults()
    if path.exists():
        try:
            stored = json.loads(path.read_text())
            if stored.get("provider") in {"claude", "openai", "ollama"}:
                data["provider"] = stored["provider"]
            models = stored.get("models") or {}
            for key in ("claude", "openai", "ollama"):
                if isinstance(models.get(key), str) and models[key].strip():
                    data["models"][key] = models[key].strip()
        except (OSError, json.JSONDecodeError):
            logger.warning("Could not read LLM settings file; using defaults")
    return data


def save(provider: ProviderId, model: str) -> dict[str, Any]:
    data = load()
    data["provider"] = provider
    data["models"][provider] = model.strip()
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    logger.info("LLM provider updated")
    return data


def current_provider() -> ProviderId:
    return load()["provider"]


def current_model(provider: str | None = None) -> str:
    data = load()
    name = provider or data["provider"]
    return data["models"].get(name) or _defaults()["models"][name]


def has_api_key(value: str) -> bool:
    text = (value or "").strip()
    return bool(text) and not text.endswith("...")
