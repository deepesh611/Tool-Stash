from typing import AsyncGenerator

from openai import OpenAI

from app.providers.base import LLMProvider, RESEARCH_SYSTEM_PROMPT, SUGGEST_SYSTEM_TEMPLATE
from app.providers.live_sources import LiveResearch
from app.providers.result import as_text, emit_research_result, sse


def redact_error(message: str, api_key: str) -> str:
    text = message or "Request failed"
    secret = (api_key or "").strip()
    if secret and secret != "local":
        text = text.replace(secret, "***")
    return text[:500]


def probe_endpoint(base_url: str, model: str, api_key: str) -> None:
    secret = (api_key or "").strip()
    client = OpenAI(api_key=secret or "local", base_url=base_url, timeout=20.0)
    client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Reply with ok"}],
        max_tokens=8,
    )


class CustomProvider(LLMProvider):
    def __init__(self, endpoint: dict):
        stored_key = (endpoint.get("api_key") or "").strip()
        self._api_key = stored_key
        self._client = OpenAI(
            api_key=stored_key or "local",
            base_url=endpoint["base_url"],
        )
        self._model = endpoint["model"]
        self._name = endpoint["name"]

    def _error(self, exc: Exception) -> str:
        return redact_error(str(exc), self._api_key)

    async def research_stream(self, query: str) -> AsyncGenerator[str, None]:
        yield sse({"type": "status", "message": f"Researching with {self._name} ({self._model})..."})

        live = LiveResearch(query)
        async for event in live.stream():
            yield event

        try:
            completion = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
                    {"role": "user", "content": live.user_content},
                ],
                max_tokens=4096,
            )
            final_text = as_text(completion.choices[0].message.content)
        except Exception as exc:
            for chunk in emit_research_result(
                "",
                query,
                search_hits=live.hits,
                error_message=f"{self._name} error: {self._error(exc)}",
            ):
                yield chunk
            return

        for chunk in emit_research_result(final_text, query, search_hits=live.hits):
            yield chunk

    async def suggest_stream(self, description: str, tools: list) -> AsyncGenerator[str, None]:
        if not tools:
            yield sse({"type": "text", "content": "Your stash is empty! Add some tools first."})
            yield "data: [DONE]\n\n"
            return

        tools_list = "\n".join(
            f"- **{t.name}** ({t.category}): {t.description} | Tags: {', '.join(t.tags)}"
            for t in tools
        )
        system = SUGGEST_SYSTEM_TEMPLATE.format(tools_list=tools_list)

        try:
            stream = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": description},
                ],
                max_tokens=2048,
                stream=True,
            )
            for chunk in stream:
                delta = as_text(chunk.choices[0].delta.content)
                if delta:
                    yield sse({"type": "text", "content": delta})
        except Exception as exc:
            yield sse({"type": "error", "message": f"{self._name} error: {self._error(exc)}"})

        yield "data: [DONE]\n\n"
