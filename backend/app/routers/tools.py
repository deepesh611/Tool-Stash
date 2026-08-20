from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app import models, schemas

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
    return {field: getattr(tool, field) for field in EXPORTABLE_FIELDS}


def _duplicate_key(name: str, homepage: str | None, url: str | None) -> str:
    return f"{(name or '').strip().lower()}|{(homepage or url or '').strip().lower()}"


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
        tools = [t for t in tools if tag.lower() in [tg.lower() for tg in (t.tags or [])]]

    return tools


@router.post("", response_model=schemas.ToolResponse, status_code=201)
@router.post("/", response_model=schemas.ToolResponse, status_code=201, include_in_schema=False)
def create_tool(tool: schemas.ToolCreate, db: Session = Depends(get_db)):
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

    existing = {
        _duplicate_key(tool.name, tool.homepage, tool.url)
        for tool in db.query(models.Tool).all()
    }

    imported = 0
    skipped = 0
    for item in incoming:
        key = _duplicate_key(item.name, item.homepage, item.url)
        if key in existing:
            skipped += 1
            continue
        db.add(models.Tool(**item.model_dump()))
        existing.add(key)
        imported += 1

    db.commit()
    return StashImportResult(imported=imported, skipped=skipped)


@router.get("/categories/all")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(models.Tool.category).distinct().all()
    return sorted([r[0] for r in rows])


@router.get("/tags/all")
def list_tags(db: Session = Depends(get_db)):
    tools = db.query(models.Tool.tags).all()
    all_tags: set[str] = set()
    for (tags,) in tools:
        if tags:
            all_tags.update(tags)
    return sorted(all_tags)


@router.get("/{tool_id}", response_model=schemas.ToolResponse)
def get_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.patch("/{tool_id}", response_model=schemas.ToolResponse)
def update_tool(tool_id: int, update: schemas.ToolUpdate, db: Session = Depends(get_db)):
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    for field, value in update.model_dump(exclude_none=True).items():
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
