import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import tools, ai

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tool Stash API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools.router, prefix="/api/tools", tags=["tools"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])


@app.get("/health")
def health():
    return {"status": "ok"}
