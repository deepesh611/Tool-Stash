import type { Tool, ToolResearch } from '../types'
import { DuplicateToolError } from '../api/errors'
import { DEMO_TOOLS } from './seed'

function cloneTools(): Tool[] {
  return structuredClone(DEMO_TOOLS)
}

let tools = cloneTools()
let nextId = Math.max(...tools.map((item) => item.id)) + 1

function normName(value?: string) {
  return (value || '').trim().toLowerCase()
}

function normUrl(value?: string) {
  return (value || '').trim().replace(/\/+$/, '').toLowerCase()
}

function isDuplicate(candidate: { name?: string; homepage?: string; url?: string; github_url?: string }, excludeId?: number) {
  const name = normName(candidate.name)
  const urls = [candidate.homepage, candidate.url, candidate.github_url].map(normUrl).filter(Boolean)
  return tools.find((tool) => {
    if (excludeId != null && tool.id === excludeId) return false
    if (name && normName(tool.name) === name) return true
    const existing = [tool.homepage, tool.url, tool.github_url].map(normUrl).filter(Boolean)
    return urls.some((url) => existing.includes(url))
  }) ?? null
}

export function demoListTools(params?: { search?: string; category?: string; tag?: string }): Tool[] {
  const search = params?.search?.trim().toLowerCase()
  return tools.filter((tool) => {
    if (params?.category && tool.category !== params.category) return false
    if (params?.tag && !tool.tags.includes(params.tag)) return false
    if (search) {
      const hay = `${tool.name} ${tool.description} ${tool.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
}

export function demoGetTool(id: number): Tool | undefined {
  return tools.find((tool) => tool.id === id)
}

export function demoFindDuplicate(query: string): { id: number; name: string } | null {
  const text = query.trim()
  if (!text) return null
  const asUrl = /^https?:\/\//i.test(text) || text.includes('.')
  const hit = isDuplicate(asUrl
    ? { name: text, homepage: text, url: text, github_url: text }
    : { name: text })
  return hit ? { id: hit.id, name: hit.name } : null
}

export function demoSaveTool(data: ToolResearch): Tool {
  const existing = isDuplicate(data)
  if (existing) throw new DuplicateToolError(`"${existing.name}" is already in your stash.`, existing.id)
  const tool: Tool = {
    id: nextId++,
    name: data.name,
    url: data.url,
    description: data.description,
    category: data.category || 'Other',
    homepage: data.homepage,
    github_url: data.github_url,
    docs_url: data.docs_url,
    what_it_is: data.what_it_is,
    why_it_exists: data.why_it_exists,
    features: data.features || [],
    when_to_use: data.when_to_use || [],
    when_not_to_use: data.when_not_to_use || [],
    tags: data.tags || [],
    created_at: new Date().toISOString(),
  }
  tools = [tool, ...tools]
  return tool
}

export function demoUpdateTool(id: number, data: Partial<ToolResearch> & { personal_notes?: string }): Tool {
  const current = demoGetTool(id)
  if (!current) throw new Error('Tool not found')
  const next = { ...current, ...data, id }
  const existing = isDuplicate(next, id)
  if (existing) throw new DuplicateToolError(`"${existing.name}" is already in your stash.`, existing.id)
  tools = tools.map((tool) => (tool.id === id ? next : tool))
  return next
}

export function demoDeleteTool(id: number): void {
  tools = tools.filter((tool) => tool.id !== id)
}

export function demoCategories(): string[] {
  return [...new Set(tools.map((tool) => tool.category))].sort()
}

export function demoTags(): string[] {
  const counts = new Map<string, number>()
  for (const tool of tools) {
    for (const tag of tool.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag)
}

export function demoExportPayload() {
  return { tools }
}

export function demoImportPayload(payload: unknown): { imported: number; skipped: number; invalid: number } {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { tools?: unknown }).tools)
      ? (payload as { tools: unknown[] }).tools
      : null
  if (!list) throw new Error('That file is not a Tool Stash export.')
  let imported = 0
  let skipped = 0
  let invalid = 0
  for (const item of list) {
    if (!item || typeof item !== 'object' || !('name' in item) || !String((item as Tool).name || '').trim()) {
      invalid += 1
      continue
    }
    const row = item as ToolResearch
    if (isDuplicate(row)) {
      skipped += 1
      continue
    }
    demoSaveTool({
      name: row.name,
      description: row.description || '',
      category: row.category || 'Other',
      homepage: row.homepage,
      github_url: row.github_url,
      docs_url: row.docs_url,
      what_it_is: row.what_it_is,
      why_it_exists: row.why_it_exists,
      features: row.features || [],
      when_to_use: row.when_to_use || [],
      when_not_to_use: row.when_not_to_use || [],
      tags: row.tags || [],
      url: row.url,
    })
    imported += 1
  }
  return { imported, skipped, invalid }
}

export function demoAllTools(): Tool[] {
  return tools
}
