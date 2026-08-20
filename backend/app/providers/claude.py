from typing import AsyncGenerator

import anthropic

from app.config import settings
from app.llm_settings import current_model
from app.providers.base import LLMProvider, RESEARCH_SYSTEM_PROMPT, SUGGEST_SYSTEM_TEMPLATE
from app.providers.live_sources import LiveResearch
from app.providers.result import emit_research_result, sse


class ClaudeProvider(LLMProvider):
    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._model = current_model("claude")

    async def research_stream(self, query: str) -> AsyncGenerator[str, None]:
        yield sse({"type": "status", "message": f"Starting research with Claude ({self._model})..."})

        live = LiveResearch(query)
        async for event in live.stream():
            yield event

        messages = [{"role": "user", "content": live.user_content}]
        tools_config = [{"type": "web_search_20260209", "name": "web_search"}]

        final_text = ""
        max_pauses = 8
        pauses = 0

        try:
            while True:
                response = self._client.messages.create(
                    model=self._model,
                    max_tokens=4096,
                    system=RESEARCH_SYSTEM_PROMPT,
                    tools=tools_config,
                    messages=messages,
                )

                for block in response.content:
                    if hasattr(block, "type") and block.type == "text":
                        final_text += block.text

                if response.stop_reason == "end_turn":
                    break
                elif response.stop_reason == "pause_turn":
                    pauses += 1
                    if pauses > max_pauses:
                        break
                    yield sse({"type": "status", "message": f"Gathering more results... ({pauses}/{max_pauses})"})
                    messages.append({"role": "assistant", "content": response.content})
                    continue
                else:
                    break

        except anthropic.APIError as e:
            for chunk in emit_research_result(
                final_text,
                query,
                search_hits=live.hits,
                error_message=f"Claude API error: {e.message}",
            ):
                yield chunk
            return

        for chunk in emit_research_result(final_text, query, search_hits=live.hits):
            yield chunk

    async def suggest_stream(self, description: str, tools: list) -> AsyncGenerator[str, None]:
        if not tools:
            yield sse({"type": "text", "content": "Your stash is empty! Add some tools first using the **Add Tool** page."})
            yield "data: [DONE]\n\n"
            return

        tools_list = "\n".join(
            f"- **{t.name}** ({t.category}): {t.description} | Tags: {', '.join(t.tags)}"
            for t in tools
        )
        system = SUGGEST_SYSTEM_TEMPLATE.format(tools_list=tools_list)

        try:
            with self._client.messages.stream(
                model=self._model,
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": description}],
            ) as stream:
                for chunk in stream.text_stream:
                    yield sse({"type": "text", "content": chunk})
        except anthropic.APIError as e:
            yield sse({"type": "error", "message": f"Claude API error: {e.message}"})

        yield "data: [DONE]\n\n"
