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
      - LLM_PROVIDER=ollama
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - OLLAMA_MODEL=llama3.1
      - DATABASE_URL=sqlite:////data/toolstash.db
    volumes:
      - ./data:/data
    restart: unless-stopped

  frontend:
    image: nerdygamer611/tool-stash-frontend:latest
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
```

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

- **Ollama:** install [Ollama](https://ollama.com), pull a model (`ollama pull llama3.1`), keep it running. On Linux, `host.docker.internal` may need `extra_hosts: ["host.docker.internal:host-gateway"]`.
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

Do not bake API keys into images. Pass them as env vars or a local `.env`.

## Features

- Research a tool name or URL; review and save the profile
- Browse, edit, and delete stash items
- If research errors, keep a draft of whatever was gathered
- Switch LLM provider and model from the navbar
- JSON export / import for moving a stash between devices
