from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.database import Base


class Tool(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    url = Column(String(500), nullable=True)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True)

    # Rich profile fields
    homepage = Column(String(500), nullable=True)
    github_url = Column(String(500), nullable=True)
    docs_url = Column(String(500), nullable=True)
    what_it_is = Column(Text, nullable=True)
    why_it_exists = Column(Text, nullable=True)
    features = Column(JSON, nullable=False, default=list)
    when_to_use = Column(JSON, nullable=False, default=list)
    when_not_to_use = Column(JSON, nullable=False, default=list)
    tags = Column(JSON, nullable=False, default=list)
    personal_notes = Column(Text, nullable=True, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
