from app.llm_settings import current_provider, custom_id_from_provider, get_custom
from app.providers.base import LLMProvider


def get_provider() -> LLMProvider:
    provider = current_provider()
    endpoint_id = custom_id_from_provider(provider)
    if endpoint_id:
        endpoint = get_custom(endpoint_id)
        if endpoint is None:
            raise ValueError(f"Unknown custom LLM endpoint: {endpoint_id}")
        from app.providers.custom import CustomProvider
        return CustomProvider(endpoint)

    if provider == "claude":
        from app.providers.claude import ClaudeProvider
        return ClaudeProvider()
    if provider == "openai":
        from app.providers.openai import OpenAIProvider
        return OpenAIProvider()
    if provider == "ollama":
        from app.providers.ollama import OllamaProvider
        return OllamaProvider()
    raise ValueError(f"Unknown LLM provider: {provider}. Must be one of: claude, openai, ollama, or a saved custom endpoint")
