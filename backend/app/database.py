from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings


def sqlite_file_path(database_url: str) -> Path | None:
    if not database_url.startswith("sqlite"):
        return None
    return Path(database_url.replace("sqlite:///", "", 1))


def _ensure_sqlite_dir(database_url: str) -> None:
    db_path = sqlite_file_path(database_url)
    if db_path is None:
        return
    parent = db_path.parent
    if str(parent) not in {"", "."}:
        parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_dir(settings.database_url)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
