# Tool Stash

Personal catalog of tools you run into, with an AI agent that researches a name or URL and fills in the profile.

Images: [`nerdygamer611/tool-stash-backend`](https://hub.docker.com/r/nerdygamer611/tool-stash-backend) · [`nerdygamer611/tool-stash-frontend`](https://hub.docker.com/r/nerdygamer611/tool-stash-frontend)

## Run from Docker Hub

Save this as `docker-compose.yml`:

```yaml
services:
  backend:
    image: nerdygamer611/tool-stash-backend:latest
    ports:
      - "8001:8000"
    environment:
      - DATABASE_URL=sqlite:////data/toolstash.db
      - LLM_PROVIDER=ollama
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - OLLAMA_MODEL=llama3.1
      # Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-5

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Ollama (local)
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1
    volumes:
      - ./data:/data
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: nerdygamer611/tool-stash-frontend:latest
    ports:
      - "3000:80"
    environment:
      - BACKEND_URL=http://backend:8000
      - BACKEND_HOST_PORT=8001
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      - backend
    restart: unless-stopped
```

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

- **Ollama:** install [Ollama](https://ollama.com), pull a model (`ollama pull llama3.1`), keep it running. `extra_hosts` lets the backend reach Ollama on the host (needed on Linux).
- Frontend and backend must share a Docker network. `BACKEND_URL` is `http://backend:8000` (compose service name + **internal** port). Do not use `localhost:8001`.
- **Claude / OpenAI:** set `LLM_PROVIDER=claude` or `openai` and the matching API key (see env vars below). You can also switch provider and model in the UI.
- Stash data is stored in `./data/toolstash.db`. Export / Import on the Browse page copies tools between machines.

## Run from source

```bash
cp .env.example .env   # fill in keys if you use Claude or OpenAI
docker compose up --build
```

App: [http://localhost:3000](http://localhost:3000) · API: [http://localhost:8001](http://localhost:8001)

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `LLM_PROVIDER` | `claude` | `claude`, `openai`, or `ollama` |
| `ANTHROPIC_API_KEY` | | Required for Claude |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | |
| `OPENAI_API_KEY` | | Required for OpenAI |
| `OPENAI_MODEL` | `gpt-4o` | |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Use `http://localhost:11434` only if the backend is not in Docker |
| `OLLAMA_MODEL` | `llama3.1` | Must be pulled locally |
| `OLLAMA_API_KEY` | | Optional. [Ollama cloud web search](https://ollama.com/settings/keys); otherwise DuckDuckGo + page fetch |
| `DATABASE_URL` | `sqlite:////data/toolstash.db` | |
| `BACKEND_URL` | `http://backend:8000` | URL the **frontend container** uses to reach the API. Origin only, no trailing slash. `localhost` is wrong here. Separate-container deploys fall back to the host at `BACKEND_HOST_PORT`. |
| `BACKEND_HOST_PORT` | `8001` | Host port of the backend, used only when the `backend` hostname is not on the frontend's Docker network. |

Do not bake API keys into images. Pass them as env vars or a local `.env`.

## Docker Hub CI

Pushes to `main` (and version tags `v*`) build `linux/amd64` + `linux/arm64` images and publish them to Docker Hub.

Add these repository secrets at **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `DOCKERHUB_USERNAME` | `nerdygamer611` |
| `DOCKERHUB_TOKEN` | Docker Hub [access token](https://hub.docker.com/settings/security) with Read & Write |

You can also run **Actions → Publish Docker images → Run workflow** to publish without a new commit.

## Features

- Research a tool name or URL; review and save the profile
- Browse, edit, and delete stash items
- If research errors, keep a draft of whatever was gathered
- Switch LLM provider and model from the navbar
- JSON export / import for moving a stash between devices
