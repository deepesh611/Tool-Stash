import type { ResearchEvent, SuggestEvent, LlmSettings, LlmProviderId } from '../types'

async function* sseStream(url: string, body: unknown): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      buffer += decoder.decode()
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (line.startsWith('data: ')) {
          yield line.slice(6)
        }
      }
    }
  }

  for (const part of buffer.split('\n\n')) {
    for (const line of part.split('\n')) {
      if (line.startsWith('data: ')) {
        yield line.slice(6)
      }
    }
  }
}

export async function* streamResearch(query: string): AsyncGenerator<ResearchEvent> {
  for await (const raw of sseStream('/api/ai/research', { query })) {
    if (raw === '[DONE]') return
    try {
      yield JSON.parse(raw) as ResearchEvent
    } catch {
      // skip malformed
    }
  }
}

export async function* streamSuggest(description: string): AsyncGenerator<SuggestEvent> {
  for await (const raw of sseStream('/api/ai/suggest', { description })) {
    if (raw === '[DONE]') return
    try {
      yield JSON.parse(raw) as SuggestEvent
    } catch {
      // skip malformed
    }
  }
}

export async function getLlmSettings(): Promise<LlmSettings> {
  const res = await fetch('/api/ai/provider')
  if (!res.ok) throw new Error('Failed to load LLM settings')
  return res.json()
}

export async function updateLlmSettings(provider: LlmProviderId, model: string): Promise<LlmSettings> {
  const res = await fetch('/api/ai/provider', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model }),
  })
  if (!res.ok) throw new Error('Failed to update LLM settings')
  return res.json()
}
