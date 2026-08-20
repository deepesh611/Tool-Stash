from dataclasses import dataclass, field
from datetime import date
import logging
from typing import AsyncGenerator
from urllib.parse import urlparse

from app.providers.result import activity_event, sse
from app.websearch import (
    looks_like_url,
    normalize_url,
    public_hits,
    web_fetch,
    web_search,
)

_MAX_PAGE_FETCHES = 3
_PAGE_CHARS = 3500

logger = logging.getLogger(__name__)


def _rank_url(url: str) -> int:
    lowered = url.lower()
    if "github.com" in lowered:
        return 0
    if "docs." in lowered or "/docs" in lowered:
        return 1
    return 2


def _search_query(query: str) -> str:
    if not looks_like_url(query):
        return f"{query} official site github documentation"
    parsed = urlparse(normalize_url(query))
    host = (parsed.netloc or "").removeprefix("www.")
    return f"{host} {query} official github documentation"


@dataclass
class LiveResearch:
    query: str
    hits: list[dict] = field(default_factory=list)
    user_content: str = ""

    async def stream(self) -> AsyncGenerator[str, None]:
        today = date.today().isoformat()
        yield sse({"type": "status", "message": "Searching the web for current sources..."})
        yield activity_event("search", "start", query=self.query)

        try:
            self.hits = await web_search(_search_query(self.query), max_results=6)
            yield activity_event("search", "done", query=self.query, results=public_hits(self.hits))
        except Exception as exc:
            logger.exception("Live web search failed")
            self.hits = []
            yield activity_event("search", "error", query=self.query, message=str(exc))

        pages: list[tuple[str, str, str]] = []
        fetched: set[str] = set()

        urls: list[str] = []
        if looks_like_url(self.query):
            urls.append(normalize_url(self.query))
        urls.extend(
            sorted(
                [str(item.get("url") or "") for item in self.hits if item.get("url")],
                key=_rank_url,
            )
        )

        for raw in urls:
            if len(pages) >= _MAX_PAGE_FETCHES:
                break
            target = normalize_url(raw)
            if not target or target in fetched:
                continue
            fetched.add(target)
            yield sse({"type": "status", "message": f"Fetching {target}..."})
            yield activity_event("fetch", "start", url=target)
            try:
                page = await web_fetch(target)
                title = page.get("title") or ""
                content = (page.get("content") or "")[:_PAGE_CHARS]
                pages.append((target, title, content))
                yield activity_event("fetch", "done", url=target, title=title)
            except Exception as exc:
                logger.exception("Live page fetch failed")
                yield activity_event("fetch", "error", url=target, message=str(exc))

        if not self.hits and not pages:
            yield sse({
                "type": "status",
                "message": "Web search returned no results; continuing with whatever sources we have.",
            })

        search_block = "\n".join(
            f"- {item.get('title')}: {item.get('url')}\n  {item.get('content')}"
            for item in self.hits
        ) or "No search results."

        page_block = ""
        if pages:
            parts = [
                f"Fetched page ({title}) {url}:\n{content}"
                for url, title, content in pages
            ]
            page_block = "\n\n" + "\n\n".join(parts)

        self.user_content = (
            f"Research this tool: {self.query}\n\n"
            f"Today's date: {today}\n\n"
            "Live web sources fetched just now. Treat these as ground truth over training data. "
            "Use web search/fetch tools if you still need a more official or newer page.\n\n"
            f"Web search results:\n{search_block}"
            f"{page_block}\n\n"
            "Write the research narrative and the required JSON block. Do not invent URLs."
        )
