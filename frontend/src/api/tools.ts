import type { Tool, ToolResearch } from '../types'

const BASE = '/api/tools'

export class DuplicateToolError extends Error {
  id: number

  constructor(message: string, id: number) {
    super(message)
    this.name = 'DuplicateToolError'
    this.id = id
  }
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null)
  const detail = body?.detail
  if (res.status === 409) {
    const message =
      typeof detail === 'string' ? detail : detail?.message ?? fallback
    const id = typeof detail === 'object' && detail ? detail.id : undefined
    if (typeof id === 'number') throw new DuplicateToolError(message, id)
    throw new Error(message)
  }
  throw new Error(typeof detail === 'string' ? detail : fallback)
}

export async function getTools(params?: {
  search?: string
  category?: string
  tag?: string
}): Promise<Tool[]> {
  const url = new URL(BASE + '/', window.location.origin)
  if (params?.search) url.searchParams.set('search', params.search)
  if (params?.category) url.searchParams.set('category', params.category)
  if (params?.tag) url.searchParams.set('tag', params.tag)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to fetch tools')
  return res.json()
}

export async function getTool(id: number): Promise<Tool> {
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error('Tool not found')
  return res.json()
}

export async function saveTool(data: ToolResearch): Promise<Tool> {
  const res = await fetch(BASE + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Failed to save tool')
  return res.json()
}

export async function updateTool(
  id: number,
  data: Partial<ToolResearch> & { personal_notes?: string }
): Promise<Tool> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Failed to update tool')
  return res.json()
}

export async function deleteTool(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete tool')
}

export async function exportStash(): Promise<void> {
  const res = await fetch(`${BASE}/export`)
  if (!res.ok) throw new Error('Failed to export stash')
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? 'tool-stash.json'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function importStash(file: File): Promise<{ imported: number; skipped: number }> {
  const text = await file.text()
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON')
  }
  const res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to import stash')
  return res.json()
}

export async function getCategories(): Promise<string[]> {
  const res = await fetch('/api/tools/categories/all')
  if (!res.ok) return []
  return res.json()
}

export async function getAllTags(): Promise<string[]> {
  const res = await fetch('/api/tools/tags/all')
  if (!res.ok) return []
  return res.json()
}
