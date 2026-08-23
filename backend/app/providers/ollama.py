import json
import logging
from typing import AsyncGenerator

import httpx

from app.config import settings
from app.llm_settings import current_model
from app.providers.base import LLMProvider, RESEARCH_SYSTEM_PROMPT, SUGGEST_SYSTEM_TEMPLATE
from app.providers.live_sources import LiveResearch
from app.providers.result import activity_event, emit_research_result, sse
from app.websearch import WEB_TOOLS, execute_web_tool, normalize_url, parse_tool_args

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 8


def _message_text(message: dict) -> str:
    content = message.get("content") or ""
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content") or ""
                if text:
                    parts.append(str(text))
        content = "".join(parts)
    thinking = message.get("thinking") or message.get("reasoning") or ""
    return str(content or thinking or "")


class OllamaProvider(LLMProvider):
    def __init__(self):
        self._base_url = settings.ollama_base_url.rstrip("/")
        self._model = current_model("ollama")

    async def research_stream(self, query: str) -> AsyncGenerator[str, None]:
        yield sse({"type": "status", "message": f"Researching with Ollama ({self._model})..."})

        live = LiveResearch(query)
        async for event in live.stream():
            yield event

        messages = [
            {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
            {"role": "user", "content": live.user_content},
        ]

        final_text = ""
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                for round_num in range(1, _MAX_TOOL_ROUNDS + 1):
                    response = await client.post(
                        f"{self._base_url}/api/chat",
                        json={
                            "model": self._model,
                            "messages": messages,
                            "stream": False,
                            "think": False,
                            "tools": WEB_TOOLS,
                            "options": {"num_ctx": 16384},
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    message = data.get("message") or {}
                    messages.append(message)

                    content = _message_text(message)
                    if content:
                        final_text = content

                    tool_calls = message.get("tool_calls") or []
                    if not tool_calls:
                        break

                    yield sse({
                        "type": "status",
                        "message": f"Gathering more sources... ({round_num}/{_MAX_TOOL_ROUNDS})",
                    })
                    for call in tool_calls:
                        function = call.get("function") or {}
                        name = function.get("name") or ""
                        args = parse_tool_args(function.get("arguments"))
                        logger.info("Ollama requested %s", name or "web tool")
                        if name == "web_search":
                            yield activity_event("search", "start", query=str(args.get("query") or ""))
                        elif name == "web_fetch":
                            url = str(args.get("url") or "")
                            yield activity_event("fetch", "start", url=normalize_url(url) if url else url)
                        try:
                            result, activity = await execute_web_tool(name, args)
                            extra = {k: v for k, v in activity.items() if k != "action"}
                            yield activity_event(activity.get("action") or name, "done", **extra)
                            if name == "web_search":
                                for hit in extra.get("results") or []:
                                    if isinstance(hit, dict) and (hit.get("url") or hit.get("title")):
                                        live.hits.append({
                                            "title": str(hit.get("title") or ""),
                                            "url": str(hit.get("url") or ""),
                                            "content": str(hit.get("content") or ""),
                                        })
                            elif name == "web_fetch":
                                fetch_url = str(extra.get("url") or "")
                                fetch_snippet = str(extra.get("snippet") or "")
                                if fetch_url:
                                    live.hits.append({
                                        "title": str(extra.get("title") or ""),
                                        "url": fetch_url,
                                        "content": fetch_snippet,
                                    })
                        except Exception as exc:
                            logger.exception("Web tool execution failed")
                            result = f"Tool error: {exc}"
                            if name == "web_search":
                                yield activity_event("search", "error", query=str(args.get("query") or ""), message=str(exc))
                            elif name == "web_fetch":
                                yield activity_event("fetch", "error", url=str(args.get("url") or ""), message=str(exc))
                        messages.append({
                            "role": "tool",
                            "content": result,
                            "tool_name": name,
                        })
        except httpx.HTTPError as e:
            for chunk in emit_research_result(
                final_text,
                query,
                search_hits=live.hits,
                error_message=f"Ollama connection error: {str(e)}. Is Ollama running?",
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

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": description},
            ],
            "stream": True,
            "think": False,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST", f"{self._base_url}/api/chat", json=payload
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            if content:
                                yield sse({"type": "text", "content": content})
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
        except httpx.HTTPError as e:
            yield sse({"type": "error", "message": f"Ollama connection error: {str(e)}"})

        yield "data: [DONE]\n\n"
