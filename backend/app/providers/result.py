import json
import re
from typing import Any, Iterator


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def activity_event(action: str, phase: str, **fields) -> str:
    return sse({"type": "activity", "action": action, "phase": phase, **fields})


def extract_json_block(text: str) -> str | None:
    fenced = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if fenced:
        return fenced.group(1)
    match = re.search(r"\{[\s\S]*\"name\"[\s\S]*\}", text)
    if match:
        return match.group(0)
    return None


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def coerce_tool(data: dict[str, Any] | None, query: str) -> dict[str, Any]:
    payload = data or {}
    name = str(payload.get("name") or query).strip() or query
    return {
        "name": name,
        "description": str(payload.get("description") or "").strip(),
        "category": str(payload.get("category") or "Other").strip() or "Other",
        "homepage": payload.get("homepage") or "",
        "github_url": payload.get("github_url") or "",
        "docs_url": payload.get("docs_url") or "",
        "what_it_is": payload.get("what_it_is") or "",
        "why_it_exists": payload.get("why_it_exists") or "",
        "features": _as_list(payload.get("features")),
        "when_to_use": _as_list(payload.get("when_to_use")),
        "when_not_to_use": _as_list(payload.get("when_not_to_use")),
        "tags": _as_list(payload.get("tags")),
        "url": query,
    }


def partial_from_text(query: str, text: str) -> dict[str, Any]:
    paragraphs = [
        line.strip()
        for line in (text or "").split("\n")
        if line.strip() and not line.strip().startswith("```")
    ]
    description = paragraphs[0][:400] if paragraphs else ""
    return coerce_tool(
        {
            "name": query,
            "description": description,
            "what_it_is": (text or "")[:2000],
        },
        query,
    )


def partial_from_search(query: str, search_hits: list[dict[str, Any]] | None) -> dict[str, Any]:
    homepage = ""
    github_url = ""
    docs_url = ""
    titles: list[str] = []
    description = ""
    for item in search_hits or []:
        url = str(item.get("url") or "")
        title = str(item.get("title") or "").strip()
        content = str(item.get("content") or "").strip()
        if title:
            titles.append(title)
        if content and not description:
            description = content[:400]
        lowered = url.lower()
        if "github.com" in lowered and not github_url:
            github_url = url
        elif ("docs." in lowered or "/docs" in lowered) and not docs_url:
            docs_url = url
        elif url and not homepage:
            homepage = url
    return coerce_tool(
        {
            "name": query,
            "description": description,
            "homepage": homepage,
            "github_url": github_url,
            "docs_url": docs_url,
            "features": titles[:8],
        },
        query,
    )


def emit_research_result(
    final_text: str,
    query: str,
    search_hits: list[dict[str, Any]] | None = None,
    error_message: str | None = None,
) -> Iterator[str]:
    if final_text:
        yield sse({"type": "text", "content": final_text})

    parsed: dict[str, Any] | None = None
    parse_error = error_message
    raw = extract_json_block(final_text or "")
    if raw:
        try:
            loaded = json.loads(raw)
            if isinstance(loaded, dict):
                parsed = coerce_tool(loaded, query)
        except json.JSONDecodeError as exc:
            parse_error = parse_error or f"JSON parse error: {exc}"
    elif final_text and not parse_error:
        parse_error = "Could not extract structured data. Review the draft and save what we gathered."
    elif not final_text and not parse_error:
        parse_error = "Research did not finish. Review the draft and save what we gathered."

    from_search = partial_from_search(query, search_hits)
    from_text = partial_from_text(query, final_text or "")
    merged = {**from_search, **{k: v for k, v in from_text.items() if v}}
    if parsed:
        merged = {**merged, **{k: v for k, v in parsed.items() if v not in ("", [], None)}}
        merged["name"] = parsed.get("name") or merged["name"]
        merged["url"] = query

    yield sse({"type": "result", "data": coerce_tool(merged, query)})
    if parse_error:
        yield sse({"type": "error", "message": parse_error})
    yield "data: [DONE]\n\n"
