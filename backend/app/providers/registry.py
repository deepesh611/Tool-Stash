from app.llm_settings import current_provider
from app.providers.base import LLMProvider


def get_provider() -> LLMProvider:
    provider = current_provider()

    if provider == "claude":
        from app.providers.claude import ClaudeProvider
        return ClaudeProvider()
    if provider == "openai":
        from app.providers.openai import OpenAIProvider
        return OpenAIProvider()
    if provider == "ollama":
        from app.providers.ollama import OllamaProvider
        return OllamaProvider()
    raise ValueError(f"Unknown LLM provider: {provider}. Must be one of: claude, openai, ollama")
