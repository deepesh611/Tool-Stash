from collections import Counter
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app import models, schemas
from app.tags import normalize_tag, normalize_tags
from app.websearch import looks_like_url, normalize_url

router = APIRouter()

EXPORTABLE_FIELDS = (
    "name",
    "url",
    "description",
    "category",
    "homepage",
    "github_url",
    "docs_url",
    "what_it_is",
    "why_it_exists",
    "features",
    "when_to_use",
    "when_not_to_use",
    "tags",
    "personal_notes",
)


class StashImportResult(BaseModel):
    imported: int
    skipped: int


def _tool_payload(tool: models.Tool) -> dict:
    payload = {field: getattr(tool, field) for field in EXPORTABLE_FIELDS}
    payload["tags"] = normalize_tags(payload.get("tags") or [])
    return payload


def _persist_normalized_tags(db: Session, tools: list[models.Tool]) -> None:
    dirty = False
    for tool in tools:
        normalized = normalize_tags(tool.tags or [])
        if list(tool.tags or []) != normalized:
            tool.tags = normalized
            flag_modified(tool, "tags")
            dirty = True
    if dirty:
        db.commit()
        for tool in tools:
            db.refresh(tool)


def _norm_name(name: str | None) -> str:
    return (name or "").strip().lower()


def _norm_url(url: str | None) -> str:
    text = (url or "").strip()
    if not text:
        return ""
    if "://" not in text and "." not in text:
        return text.lower().rstrip("/")
    parsed = urlparse(text if "://" in text else f"https://{text}")
    host = (parsed.netloc or "").lower().removeprefix("www.")
    path = (parsed.path or "").rstrip("/")
    if not host:
        return text.lower().rstrip("/")
    return f"{host}{path}"


def _identity_urls(homepage: str | None, url: str | None, github_url: str | None) -> set[str]:
    return {value for value in (_norm_url(homepage), _norm_url(url), _norm_url(github_url)) if value}


def find_duplicate(
    db: Session,
    *,
    name: str | None,
    homepage: str | None = None,
    url: str | None = None,
    github_url: str | None = None,
    exclude_id: int | None = None,
) -> models.Tool | None:
    incoming_name = _norm_name(name)
    incoming_urls = _identity_urls(homepage, url, github_url)
    for tool in db.query(models.Tool).all():
        if exclude_id is not None and tool.id == exclude_id:
            continue
        if incoming_name and _norm_name(tool.name) == incoming_name:
            return tool
        existing_urls = _identity_urls(tool.homepage, tool.url, tool.github_url)
        if incoming_urls and incoming_urls & existing_urls:
            return tool
    return None


def find_duplicate_for_query(db: Session, query: str) -> models.Tool | None:
    text = query.strip()
    if not text:
        return None
    if looks_like_url(text):
        url = normalize_url(text)
        return find_duplicate(db, name=text, homepage=url, url=url, github_url=url)
    return find_duplicate(db, name=text)


def _duplicate_error(tool: models.Tool) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={"message": f'"{tool.name}" is already in your stash.', "id": tool.id},
    )


@router.get("", response_model=list[schemas.ToolResponse])
@router.get("/", response_model=list[schemas.ToolResponse], include_in_schema=False)
def list_tools(
    search: str | None = Query(None),
    category: str | None = Query(None),
    tag: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Tool)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                models.Tool.name.ilike(pattern),
                models.Tool.description.ilike(pattern),
            )
        )
    if category:
        q = q.filter(models.Tool.category == category)
    tools = q.order_by(models.Tool.created_at.desc()).all()

    if tag:
        wanted = normalize_tag(tag)
        tools = [t for t in tools if wanted in normalize_tags(t.tags or [])]

    _persist_normalized_tags(db, tools)
    return tools


@router.post("", response_model=schemas.ToolResponse, status_code=201)
@router.post("/", response_model=schemas.ToolResponse, status_code=201, include_in_schema=False)
def create_tool(tool: schemas.ToolCreate, db: Session = Depends(get_db)):
    existing = find_duplicate(
        db,
        name=tool.name,
        homepage=tool.homepage,
        url=tool.url,
        github_url=tool.github_url,
    )
    if existing:
        raise _duplicate_error(existing)
    db_tool = models.Tool(**tool.model_dump())
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool


@router.get("/export")
def export_tools(db: Session = Depends(get_db)):
    tools = db.query(models.Tool).order_by(models.Tool.created_at.asc()).all()
    payload = {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tools": [_tool_payload(tool) for tool in tools],
    }
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": f'attachment; filename="tool-stash-{timestamp}.json"',
        },
    )


@router.post("/import", response_model=StashImportResult)
def import_tools(body: Any = Body(...), db: Session = Depends(get_db)):
    if isinstance(body, list):
        raw_tools = body
    elif isinstance(body, dict):
        raw_tools = body.get("tools") or []
    else:
        raise HTTPException(status_code=400, detail="Invalid stash file")
    if not isinstance(raw_tools, list):
        raise HTTPException(status_code=400, detail="Invalid stash file")

    incoming: list[schemas.ToolCreate] = []
    for item in raw_tools:
        payload = dict(item) if isinstance(item, dict) else item
        if isinstance(payload, dict):
            for field in ("features", "when_to_use", "when_not_to_use", "tags"):
                if payload.get(field) is None:
                    payload[field] = []
        incoming.append(schemas.ToolCreate.model_validate(payload))

    imported = 0
    skipped = 0
    for item in incoming:
        existing = find_duplicate(
            db,
            name=item.name,
            homepage=item.homepage,
            url=item.url,
            github_url=item.github_url,
        )
        if existing:
            skipped += 1
            continue
        db.add(models.Tool(**item.model_dump()))
        db.flush()
        imported += 1

    db.commit()
    return StashImportResult(imported=imported, skipped=skipped)


@router.get("/categories/all")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(models.Tool.category).distinct().all()
    return sorted([r[0] for r in rows])


@router.get("/exists", response_model=schemas.DuplicateCheckResponse)
def check_duplicate(q: str = Query(...), db: Session = Depends(get_db)):
    existing = find_duplicate_for_query(db, q)
    if not existing:
        return schemas.DuplicateCheckResponse(exists=False)
    return schemas.DuplicateCheckResponse(exists=True, id=existing.id, name=existing.name)


@router.get("/tags/all")
def list_tags(db: Session = Depends(get_db)):
    tools = db.query(models.Tool).all()
    _persist_normalized_tags(db, tools)
    counts: Counter[str] = Counter()
    for tool in tools:
        counts.update(tool.tags or [])
    return [tag for tag, _ in counts.most_common()]


@router.get("/{tool_id}", response_model=schemas.ToolResponse)
def get_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    _persist_normalized_tags(db, [tool])
    return tool


@router.patch("/{tool_id}", response_model=schemas.ToolResponse)
def update_tool(tool_id: int, update: schemas.ToolUpdate, db: Session = Depends(get_db)):
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    changes = update.model_dump(exclude_none=True)
    merged_name = changes.get("name", tool.name)
    existing = find_duplicate(
        db,
        name=merged_name,
        homepage=changes.get("homepage", tool.homepage),
        url=changes.get("url", tool.url),
        github_url=changes.get("github_url", tool.github_url),
        exclude_id=tool.id,
    )
    if existing:
        raise _duplicate_error(existing)
    for field, value in changes.items():
        setattr(tool, field, value)
    db.commit()
    db.refresh(tool)
    return tool


@router.delete("/{tool_id}", status_code=204)
def delete_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    db.delete(tool)
    db.commit()
