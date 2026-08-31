import re
from typing import Iterable

_SEPARATORS = re.compile(r"[^a-z0-9]+")


def normalize_tag(value: str) -> str:
    text = (value or "").strip().lstrip("#").lower().replace("_", "-")
    text = _SEPARATORS.sub("-", text).strip("-")
    return text


def normalize_tags(values: Iterable[str] | str | None) -> list[str]:
    if isinstance(values, str):
        values = [values]
    seen: set[str] = set()
    out: list[str] = []
    for raw in values or []:
        tag = normalize_tag(str(raw))
        if not tag or tag in seen:
            continue
        seen.add(tag)
        out.append(tag)
    return out
