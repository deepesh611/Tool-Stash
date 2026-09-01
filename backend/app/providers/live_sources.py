from collections import deque
from dataclasses import dataclass, field
from datetime import date
import logging
from typing import AsyncGenerator
from urllib.parse import urlparse

from app.providers.result import activity_event, sse
from app.websearch import (
    extract_github_repos,
    github_repo_url,
    looks_like_url,
    normalize_url,
    public_hits,
    rank_source_url,
    web_fetch,
    web_search,
)

_MAX_PAGE_FETCHES = 4
_PAGE_CHARS = 3500

logger = logging.getLogger(__name__)


def _search_query(query: str) -> str:
    if not looks_like_url(query):
        return f"{query} official site github documentation"
    parsed = urlparse(normalize_url(query))
    host = (parsed.netloc or "").removeprefix("www.")
    return f"{host} {query} official github documentation"


def _queue_url(
    queue: deque[str],
    queued: set[str],
    url: str,
    query: str,
    *,
    front: bool = False,
) -> None:
    target = normalize_url(url) if url else ""
    if not target:
        return
    key = target.lower()
    if key in queued:
        return
    queued.add(key)
    if front and rank_source_url(target, query) <= 2:
        queue.appendleft(target)
    else:
        queue.append(target)


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
        queue: deque[str] = deque()
        queued: set[str] = set()

        if looks_like_url(self.query):
            _queue_url(queue, queued, self.query, self.query)
        ranked_hits = sorted(
            [str(hit.get("url") or "") for hit in self.hits if hit.get("url")],
            key=lambda item: rank_source_url(item, self.query),
        )
        search_github: list[str] = []
        for item in ranked_hits:
            if github_repo_url(item):
                search_github.append(item)
                continue
            _queue_url(queue, queued, item, self.query)

        github_fallback = False
        while len(pages) < _MAX_PAGE_FETCHES:
            if not queue:
                if github_fallback or any(github_repo_url(url) for url, _title, _content in pages):
                    break
                github_fallback = True
                for item in search_github:
                    _queue_url(queue, queued, item, self.query, front=True)
                if not queue:
                    break
            target = queue.popleft()
            if target.lower() in fetched:
                continue
            fetched.add(target.lower())
            yield sse({"type": "status", "message": f"Fetching {target}..."})
            yield activity_event("fetch", "start", url=target)
            try:
                page = await web_fetch(target)
                title = page.get("title") or ""
                content = (page.get("content") or "")[:_PAGE_CHARS]
                pages.append((target, title, content))
                yield activity_event("fetch", "done", url=target, title=title, snippet=content[:400])
                discovered = extract_github_repos(
                    content,
                    title,
                    " ".join(str(item) for item in (page.get("links") or [])),
                )
                for href in page.get("links") or []:
                    repo = github_repo_url(str(href))
                    if repo:
                        discovered.append(repo)
                for repo in discovered:
                    _queue_url(queue, queued, repo, self.query, front=True)
            except Exception as exc:
                logger.warning("Live page fetch failed for %s: %s", target, exc)
                yield activity_event("fetch", "error", url=target, message=str(exc))

        self._merge_pages_into_hits(pages)

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
            "Write the research narrative and the required JSON block. Do not invent URLs. "
            "github_url must be the official repository linked from the homepage, not a fork."
        )

    def _merge_pages_into_hits(self, pages: list[tuple[str, str, str]]) -> None:
        for url, title, content in pages:
            snippet = (content or "").strip()[:500]
            matched = False
            for item in self.hits:
                if (item.get("url") or "") == url:
                    if title and not item.get("title"):
                        item["title"] = title
                    if snippet and not item.get("content"):
                        item["content"] = snippet
                    matched = True
                    break
            if not matched:
                self.hits.append({"title": title or "", "url": url, "content": snippet})
