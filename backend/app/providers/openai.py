import json
from typing import AsyncGenerator

from openai import OpenAI

from app.config import settings
from app.llm_settings import current_model
from app.providers.base import LLMProvider, RESEARCH_SYSTEM_PROMPT, SUGGEST_SYSTEM_TEMPLATE
from app.providers.result import emit_research_result


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


class OpenAIProvider(LLMProvider):
    def __init__(self):
        self._client = OpenAI(api_key=settings.openai_api_key)
        self._model = current_model("openai")

    async def research_stream(self, query: str) -> AsyncGenerator[str, None]:
        yield _sse({"type": "status", "message": f"Researching with {self._model}..."})

        # Use responses API with web_search_preview if model supports it,
        # otherwise fall back to prompt-only chat completion.
        try:
            response = self._client.responses.create(
                model=self._model,
                tools=[{"type": "web_search_preview"}],
                input=f"{RESEARCH_SYSTEM_PROMPT}\n\nResearch this tool: {query}",
            )
            final_text = response.output_text or ""
        except Exception:
            # Fallback: chat completions without web search
            yield _sse({"type": "status", "message": "Web search unavailable, using model knowledge..."})
            completion = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Research this tool: {query}"},
                ],
                max_tokens=4096,
            )
            final_text = completion.choices[0].message.content or ""

        for chunk in emit_research_result(final_text, query):
            yield chunk

    async def suggest_stream(self, description: str, tools: list) -> AsyncGenerator[str, None]:
        if not tools:
            yield _sse({"type": "text", "content": "Your stash is empty! Add some tools first."})
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
                delta = chunk.choices[0].delta.content
                if delta:
                    yield _sse({"type": "text", "content": delta})
        except Exception as e:
            yield _sse({"type": "error", "message": f"OpenAI error: {str(e)}"})

        yield "data: [DONE]\n\n"
