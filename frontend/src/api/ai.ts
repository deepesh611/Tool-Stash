import type { ResearchEvent, SuggestEvent, LlmSettings, LlmProviderId, CustomLlm } from '../types'
import { isDemo } from '../lib/demoMode'
import { DEMO_LLM_SETTINGS, demoStreamResearch, demoStreamSuggest } from '../demo/ai'

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
  if (isDemo) {
    yield* demoStreamResearch(query)
    return
  }
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
  if (isDemo) {
    yield* demoStreamSuggest(description)
    return
  }
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
  if (isDemo) return DEMO_LLM_SETTINGS
  const res = await fetch('/api/ai/provider')
  if (!res.ok) throw new Error('Failed to load LLM settings')
  return res.json()
}

export async function updateLlmSettings(provider: LlmProviderId, model: string): Promise<LlmSettings> {
  if (isDemo) return DEMO_LLM_SETTINGS
  const res = await fetch('/api/ai/provider', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model }),
  })
  if (!res.ok) throw new Error(await readError(res, 'Failed to update LLM settings'))
  const settings = await res.json() as LlmSettings
  notifyLlmSettingsChanged()
  return settings
}

export function notifyLlmSettingsChanged() {
  window.dispatchEvent(new Event('llm-settings-changed'))
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string' && body.detail) return body.detail
  } catch {
    // response was not JSON
  }
  return fallback
}

export async function listCustomLlms(): Promise<CustomLlm[]> {
  const res = await fetch('/api/ai/custom')
  if (!res.ok) throw new Error(await readError(res, 'Failed to load custom endpoints'))
  return res.json()
}

export async function createCustomLlm(body: {
  name: string
  base_url: string
  model: string
  api_key: string
}): Promise<CustomLlm> {
  const res = await fetch('/api/ai/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res, 'Failed to save endpoint'))
  const saved = await res.json() as CustomLlm
  notifyLlmSettingsChanged()
  return saved
}

export async function updateCustomLlm(
  id: string,
  body: { name: string; base_url: string; model: string; api_key?: string },
): Promise<CustomLlm> {
  const res = await fetch(`/api/ai/custom/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res, 'Failed to save endpoint'))
  const saved = await res.json() as CustomLlm
  notifyLlmSettingsChanged()
  return saved
}

export async function deleteCustomLlm(id: string): Promise<void> {
  const res = await fetch(`/api/ai/custom/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res, 'Failed to delete endpoint'))
  notifyLlmSettingsChanged()
}

export async function testCustomLlm(body: {
  base_url: string
  model: string
  api_key?: string
  id?: string
}): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/ai/custom/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res, 'Could not reach the endpoint'))
  return res.json()
}
