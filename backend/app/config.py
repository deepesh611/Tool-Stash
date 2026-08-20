from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    llm_provider: Literal["claude", "openai", "ollama"] = "claude"

    # Claude
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    ollama_api_key: str = ""

    database_url: str = "sqlite:///./data/toolstash.db"
    app_version: str = "dev"

    class Config:
        env_file = ".env"


settings = Settings()
