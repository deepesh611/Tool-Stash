import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

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


@app.get("/", response_class=HTMLResponse)
def root():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tool Stash API</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #030712;
      color: #e5e7eb;
    }
    main {
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; }
    p { margin: 0; color: #9ca3af; font-size: 0.95rem; }
    a { color: #818cf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <h1>Tool Stash backend is working</h1>
    <p>API is up. Use the app UI, or hit <a href="/health">/health</a>.</p>
  </main>
</body>
</html>
"""


@app.get("/health")
def health():
    return {"status": "ok"}
