import json
import logging
from typing import AsyncGenerator

import httpx

from app.config import settings
from app.llm_settings import current_model
from app.providers.base import LLMProvider, RESEARCH_SYSTEM_PROMPT, SUGGEST_SYSTEM_TEMPLATE
from app.providers.result import emit_research_result
from app.websearch import (
    WEB_TOOLS,
    execute_web_tool,
    looks_like_url,
    normalize_url,
    parse_tool_args,
    public_hits,
    web_fetch,
    web_search,
)

logger = logging.getLogger(__name__)

_RESEARCH_TOOL_PROMPT = """Use web_search and web_fetch to gather current information from official sources.
Prefer the official homepage, GitHub repository, and documentation.
Do not invent URLs. If a link is unknown, omit it or set it to null.
After researching, write a short narrative and then the required JSON block."""

_MAX_TOOL_ROUNDS = 8


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _activity(action: str, phase: str, **fields) -> str:
    return _sse({"type": "activity", "action": action, "phase": phase, **fields})


class OllamaProvider(LLMProvider):
    def __init__(self):
        self._base_url = settings.ollama_base_url.rstrip("/")
        self._model = current_model("ollama")

    async def research_stream(self, query: str) -> AsyncGenerator[str, None]:
        yield _sse({"type": "status", "message": f"Researching with Ollama ({self._model})..."})
        yield _sse({"type": "status", "message": "Searching the web..."})
        yield _activity("search", "start", query=query)

        try:
            search_results = await web_search(query, max_results=5)
            yield _activity("search", "done", query=query, results=public_hits(search_results))
        except Exception as exc:
            logger.exception("Initial web search failed")
            search_results = []
            yield _activity("search", "error", query=query, message=str(exc))

        page_context = ""
        if looks_like_url(query):
            target = normalize_url(query)
            yield _sse({"type": "status", "message": "Fetching the provided URL..."})
            yield _activity("fetch", "start", url=target)
            try:
                page = await web_fetch(target)
                title = page.get("title") or ""
                content = page.get("content") or ""
                page_context = f"\n\nFetched page ({title}):\n{content}"
                yield _activity("fetch", "done", url=target, title=title)
            except Exception as exc:
                logger.exception("Initial URL fetch failed")
                yield _activity("fetch", "error", url=target, message=str(exc))

        if not search_results and not page_context:
            yield _sse({
                "type": "status",
                "message": "Web search returned no results; continuing with model knowledge.",
            })

        search_block = "\n".join(
            f"- {item.get('title')}: {item.get('url')}\n  {item.get('content')}"
            for item in search_results
        ) or "No search results."

        user_content = (
            f"Research this tool: {query}\n\n"
            f"Web search results:\n{search_block}"
            f"{page_context}\n\n"
            "Use tools if you need more official pages, then produce the research write-up and JSON."
        )

        messages = [
            {"role": "system", "content": f"{RESEARCH_SYSTEM_PROMPT}\n\n{_RESEARCH_TOOL_PROMPT}"},
            {"role": "user", "content": user_content},
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

                    content = message.get("content") or ""
                    if content:
                        final_text = content

                    tool_calls = message.get("tool_calls") or []
                    if not tool_calls:
                        break

                    yield _sse({
                        "type": "status",
                        "message": f"Gathering more sources... ({round_num}/{_MAX_TOOL_ROUNDS})",
                    })
                    for call in tool_calls:
                        function = call.get("function") or {}
                        name = function.get("name") or ""
                        args = parse_tool_args(function.get("arguments"))
                        logger.info("Ollama requested %s", name or "web tool")
                        if name == "web_search":
                            yield _activity("search", "start", query=str(args.get("query") or ""))
                        elif name == "web_fetch":
                            url = str(args.get("url") or "")
                            yield _activity("fetch", "start", url=normalize_url(url) if url else url)
                        try:
                            result, activity = await execute_web_tool(name, args)
                            extra = {k: v for k, v in activity.items() if k != "action"}
                            yield _activity(activity.get("action") or name, "done", **extra)
                        except Exception as exc:
                            logger.exception("Web tool execution failed")
                            result = f"Tool error: {exc}"
                            if name == "web_search":
                                yield _activity("search", "error", query=str(args.get("query") or ""), message=str(exc))
                            elif name == "web_fetch":
                                yield _activity("fetch", "error", url=str(args.get("url") or ""), message=str(exc))
                        messages.append({
                            "role": "tool",
                            "content": result,
                            "tool_name": name,
                        })
        except httpx.HTTPError as e:
            for chunk in emit_research_result(
                final_text,
                query,
                search_hits=search_results,
                error_message=f"Ollama connection error: {str(e)}. Is Ollama running?",
            ):
                yield chunk
            return

        for chunk in emit_research_result(final_text, query, search_hits=search_results):
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
                                yield _sse({"type": "text", "content": content})
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
        except httpx.HTTPError as e:
            yield _sse({"type": "error", "message": f"Ollama connection error: {str(e)}"})

        yield "data: [DONE]\n\n"
