import type { Tool, ToolResearch } from '../types'
import { isDemo } from '../lib/demoMode'
import { DuplicateToolError } from './errors'
import {
  demoCategories,
  demoDeleteTool,
  demoExportPayload,
  demoFindDuplicate,
  demoGetTool,
  demoImportPayload,
  demoListTools,
  demoSaveTool,
  demoTags,
  demoUpdateTool,
} from '../demo/store'

export { DuplicateToolError }

const BASE = '/api/tools'

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

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function getTools(params?: {
  search?: string
  category?: string
  tag?: string
}): Promise<Tool[]> {
  if (isDemo) return demoListTools(params)
  const url = new URL(BASE + '/', window.location.origin)
  if (params?.search) url.searchParams.set('search', params.search)
  if (params?.category) url.searchParams.set('category', params.category)
  if (params?.tag) url.searchParams.set('tag', params.tag)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to fetch tools')
  return res.json()
}

export async function getTool(id: number): Promise<Tool> {
  if (isDemo) {
    const tool = demoGetTool(id)
    if (!tool) throw new Error('Tool not found')
    return tool
  }
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error('Tool not found')
  return res.json()
}

export async function findDuplicate(
  query: string,
): Promise<{ id: number; name: string } | null> {
  if (isDemo) return demoFindDuplicate(query)
  const url = new URL(BASE + '/exists', window.location.origin)
  url.searchParams.set('q', query)
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const data = await res.json() as { exists?: boolean; id?: number; name?: string }
  if (!data.exists || typeof data.id !== 'number') return null
  return { id: data.id, name: data.name || query }
}

export async function saveTool(data: ToolResearch): Promise<Tool> {
  if (isDemo) return demoSaveTool(data)
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
  if (isDemo) return demoUpdateTool(id, data)
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Failed to update tool')
  return res.json()
}

export async function deleteTool(id: number): Promise<void> {
  if (isDemo) {
    demoDeleteTool(id)
    return
  }
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete tool')
}

export async function exportStash(): Promise<void> {
  if (isDemo) {
    downloadJson('tool-stash-demo.json', demoExportPayload())
    return
  }
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

export async function importStash(file: File): Promise<{ imported: number; skipped: number; invalid: number }> {
  const text = await file.text()
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON')
  }
  if (isDemo) return demoImportPayload(payload)
  const res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    if (res.status === 413) throw new Error('File is too large to import.')
    const body = await res.json().catch(() => null)
    const detail = body?.detail
    const message = typeof detail === 'string' ? detail : detail?.message
    throw new Error(message || `Import failed (${res.status})`)
  }
  const data = await res.json() as { imported?: number; skipped?: number; invalid?: number }
  return {
    imported: data.imported ?? 0,
    skipped: data.skipped ?? 0,
    invalid: data.invalid ?? 0,
  }
}

export async function getCategories(): Promise<string[]> {
  if (isDemo) return demoCategories()
  const res = await fetch('/api/tools/categories/all')
  if (!res.ok) return []
  return res.json()
}

export async function getAllTags(): Promise<string[]> {
  if (isDemo) return demoTags()
  const res = await fetch('/api/tools/tags/all')
  if (!res.ok) return []
  return res.json()
}
