import html as html_lib
import ipaddress
import json
import logging
import re
import socket
from html.parser import HTMLParser
from typing import Any
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_USER_AGENT = "Mozilla/5.0 (compatible; ToolStash/1.0; +https://localhost)"
_MAX_FETCH_CHARS = 8000
_MAX_TOOL_RESULT_CHARS = 8000
_MAX_DOWNLOAD_BYTES = 1_000_000
_GITHUB_SKIP = {
    "topics", "orgs", "search", "settings", "explore", "sponsors",
    "login", "features", "marketplace", "pricing", "about", "collections",
    "events", "codespaces", "copilot", "apps",
}
_GITHUB_REPO_RE = re.compile(
    r"https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)",
    re.I,
)

OLLAMA_WEB_SEARCH_URL = "https://ollama.com/api/web_search"
OLLAMA_WEB_FETCH_URL = "https://ollama.com/api/web_fetch"

WEB_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for current information about a tool, product, or topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query, e.g. official site, GitHub, or docs.",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Number of results to return (1-10).",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": "Fetch a URL and return the page title and main text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "http or https URL to fetch.",
                    },
                },
                "required": ["url"],
            },
        },
    },
]


def looks_like_url(query: str) -> bool:
    text = query.strip()
    if re.match(r"^https?://", text, re.I):
        return True
    if " " in text:
        return False
    return bool(re.match(r"^[\w.-]+\.[a-z]{2,}(/.*)?$", text, re.I))


def normalize_url(url: str) -> str:
    text = url.strip()
    if re.match(r"^https?://", text, re.I):
        return text
    return f"https://{text}"


def query_token(query: str) -> str:
    return "".join(ch for ch in query.lower() if ch.isalnum())


def github_repo_url(url: str) -> str | None:
    if not url:
        return None
    parsed = urlparse(normalize_url(url))
    host = (parsed.netloc or "").lower().removeprefix("www.")
    if host != "github.com":
        return None
    parts = [item for item in parsed.path.split("/") if item]
    if len(parts) < 2:
        return None
    org, repo = parts[0], parts[1].removesuffix(".git")
    if org.lower() in _GITHUB_SKIP or repo.lower() in {"followers", "following", "stars"}:
        return None
    return f"https://github.com/{org}/{repo}"


def extract_github_repos(*texts: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for text in texts:
        for match in _GITHUB_REPO_RE.finditer(text or ""):
            url = github_repo_url(match.group(0))
            if url and url.lower() not in seen:
                seen.add(url.lower())
                found.append(url)
    return found


def rank_source_url(url: str, query: str) -> int:
    """Lower is better. Prefer official docs/homepage, then the matching GitHub repo."""
    lowered = url.lower()
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    token = query_token(query)
    host_key = "".join(ch for ch in host.split(":")[0] if ch.isalnum())
    path = parsed.path.rstrip("/") or "/"
    official = bool(token and token in host_key)
    docs = "docs." in lowered or "/docs" in lowered or "/manual" in lowered
    repo = github_repo_url(url)
    repo_match = False
    if repo:
        repo_name = "".join(ch for ch in repo.rsplit("/", 1)[-1].lower() if ch.isalnum())
        repo_match = bool(token and token == repo_name)
    homepage = official and path in {"", "/"}
    if official and docs:
        return 0
    if homepage:
        return 1
    if repo_match:
        return 2
    if official:
        return 3
    if docs:
        return 4
    if repo:
        return 5
    return 6


def canonical_fetch_url(url: str) -> str:
    """Prefer GitHub README raw text over the HTML chrome shell."""
    target = normalize_url(url)
    repo = github_repo_url(target)
    if not repo:
        return target
    parsed = urlparse(target)
    parts = [item for item in parsed.path.split("/") if item]
    org, repo_name = parts[0], parts[1].removesuffix(".git")
    if len(parts) >= 5 and parts[2] == "blob":
        return f"https://raw.githubusercontent.com/{org}/{repo_name}/{'/'.join(parts[3:])}"
    if len(parts) == 2 or (len(parts) >= 3 and parts[2] in {"tree", "blob", "about"}):
        return f"https://raw.githubusercontent.com/{org}/{repo_name}/HEAD/README.md"
    return target


def _assert_public_http_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http and https URLs are allowed")
    host = parsed.hostname
    if not host or host.lower() in {"localhost", "metadata.google.internal"}:
        raise ValueError("Blocked non-public URL")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise ValueError("Could not resolve host") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise ValueError("Blocked non-public URL")


class _HTMLTextParser(HTMLParser):
    _SKIP = {"script", "style", "noscript", "svg", "iframe"}

    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self.title_parts: list[str] = []
        self.body_parts: list[str] = []
        self.links: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        href = dict(attrs).get("href")
        if tag in {"a", "link"} and href:
            self.links.append(href)
        if tag in self._SKIP:
            self._skip_depth += 1
            return
        if tag == "title":
            self._in_title = True
        if tag in {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "section"}:
            self.body_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
            return
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        if self._in_title:
            self.title_parts.append(data)
            return
        self.body_parts.append(data)


def _html_to_text(raw_html: str, base_url: str = "") -> tuple[str, str, list[str]]:
    parser = _HTMLTextParser()
    parser.feed(raw_html)
    title = re.sub(r"\s+", " ", "".join(parser.title_parts)).strip()
    body = re.sub(r"[ \t]+", " ", "".join(parser.body_parts))
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    links: list[str] = []
    seen: set[str] = set()
    for href in parser.links:
        abs_url = urljoin(base_url, html_lib.unescape(href)).split("#", 1)[0]
        if not abs_url.startswith("http") or abs_url in seen:
            continue
        seen.add(abs_url)
        links.append(abs_url)
    return title, body[:_MAX_FETCH_CHARS], links[:40]


def _unwrap_ddg_url(href: str) -> str:
    href = html_lib.unescape(href)
    if href.startswith("//"):
        href = f"https:{href}"
    parsed = urlparse(href)
    uddg = parse_qs(parsed.query).get("uddg")
    if uddg:
        return unquote(uddg[0])
    return href


def public_hits(results: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        {
            "title": item.get("title") or "",
            "url": item.get("url") or "",
            "content": (item.get("content") or "")[:280],
        }
        for item in results
        if item.get("url") or item.get("title")
    ]


def _format_results(results: list[dict[str, str]]) -> str:
    if not results:
        return "No search results."
    lines = []
    for item in results:
        lines.append(
            f"- {item.get('title') or '(untitled)'}\n"
            f"  URL: {item.get('url') or ''}\n"
            f"  {item.get('content') or ''}"
        )
    return "\n".join(lines)


async def web_search(query: str, max_results: int = 5) -> list[dict[str, str]]:
    max_results = max(1, min(int(max_results or 5), 10))
    if settings.ollama_api_key:
        try:
            return await _ollama_web_search(query, max_results)
        except Exception:
            logger.warning("Ollama cloud web search failed; using local search")
    return await _local_web_search(query, max_results)


async def web_fetch(url: str) -> dict[str, str]:
    target = canonical_fetch_url(url)
    if settings.ollama_api_key:
        try:
            return await _ollama_web_fetch(target)
        except Exception:
            logger.warning("Ollama cloud web fetch failed; using local fetch")
    return await _local_web_fetch(target)


async def execute_web_tool(name: str, args: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    if name == "web_search":
        query = str(args.get("query") or "")
        results = await web_search(query, args.get("max_results") or 5)
        activity = {"action": "search", "query": query, "results": public_hits(results)}
        return _format_results(results)[:_MAX_TOOL_RESULT_CHARS], activity
    if name == "web_fetch":
        url = str(args.get("url") or "")
        target = normalize_url(url) if url else url
        try:
            page = await web_fetch(url)
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            activity = {"action": "fetch", "url": target, "title": f"HTTP {code}"}
            return f"Fetch failed: HTTP {code} for {target}. Use a different official URL.", activity
        title = page.get("title") or ""
        content = page.get("content") or ""
        links = page.get("links") or []
        link_text = ""
        if isinstance(links, list) and links:
            link_text = "\nLinks: " + ", ".join(str(item) for item in links[:15])
        activity = {
            "action": "fetch",
            "url": target,
            "title": title,
            "snippet": content[:400],
        }
        return f"Title: {title}\n\n{content}{link_text}"[:_MAX_TOOL_RESULT_CHARS], activity
    return f"Unknown tool: {name}", {"action": name or "unknown"}


async def _ollama_web_search(query: str, max_results: int) -> list[dict[str, str]]:
    headers = {
        "Authorization": f"Bearer {settings.ollama_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            OLLAMA_WEB_SEARCH_URL,
            headers=headers,
            json={"query": query, "max_results": max_results},
        )
        response.raise_for_status()
        payload = response.json()
    results = []
    for item in payload.get("results") or []:
        results.append(
            {
                "title": str(item.get("title") or ""),
                "url": str(item.get("url") or ""),
                "content": str(item.get("content") or ""),
            }
        )
    logger.info("Ollama cloud web search returned %s results", len(results))
    return results


async def _ollama_web_fetch(url: str) -> dict[str, str]:
    _assert_public_http_url(url)
    headers = {
        "Authorization": f"Bearer {settings.ollama_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.post(
            OLLAMA_WEB_FETCH_URL,
            headers=headers,
            json={"url": url},
        )
        response.raise_for_status()
        payload = response.json()
    logger.info("Ollama cloud web fetch completed")
    return {
        "title": str(payload.get("title") or ""),
        "content": str(payload.get("content") or "")[:_MAX_FETCH_CHARS],
        "links": payload.get("links") or [],
    }


async def _local_web_search(query: str, max_results: int) -> list[dict[str, str]]:
    headers = {"User-Agent": _USER_AGENT}
    results: list[dict[str, str]] = []
    seen: set[str] = set()
    html_text = ""

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=headers) as client:
        try:
            instant = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
            )
            instant.raise_for_status()
            data = instant.json()
            abstract = (data.get("Abstract") or "").strip()
            abstract_url = (data.get("AbstractURL") or "").strip()
            heading = (data.get("Heading") or query).strip()
            if abstract and abstract_url and abstract_url not in seen:
                seen.add(abstract_url)
                results.append({"title": heading, "url": abstract_url, "content": abstract})
        except Exception:
            logger.warning("DuckDuckGo instant answer lookup failed")

        html_response = await client.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
        )
        html_response.raise_for_status()
        html_text = html_response.text

    for match in re.finditer(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
        html_text,
        re.I | re.S,
    ):
        url = _unwrap_ddg_url(match.group(1))
        title = re.sub(r"<[^>]+>", "", match.group(2))
        title = html_lib.unescape(re.sub(r"\s+", " ", title)).strip()
        if not url or url in seen:
            continue
        seen.add(url)
        snippet_match = re.search(
            r'class="result__snippet"[^>]*>(.*?)</(?:a|td)',
            html_text[match.end() : match.end() + 1200],
            re.I | re.S,
        )
        snippet = ""
        if snippet_match:
            snippet = re.sub(r"<[^>]+>", "", snippet_match.group(1))
            snippet = html_lib.unescape(re.sub(r"\s+", " ", snippet)).strip()
        results.append({"title": title, "url": url, "content": snippet})
        if len(results) >= max_results:
            break

    logger.info("Local web search returned %s results", len(results))
    return results[:max_results]


async def _local_web_fetch(url: str) -> dict[str, str]:
    headers = {"User-Agent": _USER_AGENT}
    current = url
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=False, headers=headers) as client:
        for _ in range(5):
            _assert_public_http_url(current)
            response = await client.get(current)
            if response.is_redirect:
                location = response.headers.get("Location")
                if not location:
                    raise RuntimeError("Redirect without Location header")
                current = urljoin(current, location)
                continue
            response.raise_for_status()
            content_type = (response.headers.get("content-type") or "").lower()
            if "html" not in content_type and "text" not in content_type:
                raise ValueError("Unsupported content type")
            raw = response.content[:_MAX_DOWNLOAD_BYTES].decode(response.encoding or "utf-8", errors="replace")
            title, body, links = _html_to_text(raw, current)
            logger.info("Local web fetch completed")
            return {"title": title, "content": body, "links": links}
    raise RuntimeError("Too many redirects")


def parse_tool_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    return {}
