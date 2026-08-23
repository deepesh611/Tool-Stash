import type { ToolResearch } from '../types'
import type { ActivityItem } from '../components/SearchActivityLog'

export function emptyDraft(query: string): ToolResearch {
  return {
    name: query,
    description: '',
    category: 'Other',
    homepage: '',
    github_url: '',
    docs_url: '',
    what_it_is: '',
    why_it_exists: '',
    features: [],
    when_to_use: [],
    when_not_to_use: [],
    tags: [],
    url: query,
  }
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

export function parseToolJson(text: string): Partial<ToolResearch> | null {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)]
  const raw = fences[fences.length - 1]?.[1] ?? text.match(/\{[\s\S]*"name"[\s\S]*\}/)?.[0]
  if (!raw) return null
  try {
    const data = JSON.parse(raw.replace(/,\s*([}\]])/g, '$1')) as Record<string, unknown>
    if (!data || typeof data !== 'object') return null
    return {
      name: typeof data.name === 'string' ? data.name : undefined,
      description: typeof data.description === 'string' ? data.description : undefined,
      category: typeof data.category === 'string' ? data.category : undefined,
      homepage: typeof data.homepage === 'string' ? data.homepage : undefined,
      github_url: typeof data.github_url === 'string' ? data.github_url : undefined,
      docs_url: typeof data.docs_url === 'string' ? data.docs_url : undefined,
      what_it_is: typeof data.what_it_is === 'string' ? data.what_it_is : undefined,
      why_it_exists: typeof data.why_it_exists === 'string' ? data.why_it_exists : undefined,
      features: asList(data.features),
      when_to_use: asList(data.when_to_use),
      when_not_to_use: asList(data.when_not_to_use),
      tags: asList(data.tags),
    }
  } catch {
    return null
  }
}

function fromActivities(activities: ActivityItem[]): Partial<ToolResearch> {
  let homepage = ''
  let github_url = ''
  let docs_url = ''
  let description = ''
  let what_it_is = ''
  const features: string[] = []
  for (const item of activities) {
    if (item.action === 'search' && item.results) {
      for (const hit of item.results) {
        const url = hit.url || ''
        const title = hit.title?.trim()
        const content = hit.content?.trim() || ''
        if (title) features.push(title)
        if (content && !description) description = content.slice(0, 400)
        if (content && content.length > what_it_is.length) what_it_is = content.slice(0, 2000)
        const lowered = url.toLowerCase()
        if (lowered.includes('github.com') && !github_url) github_url = url
        else if ((lowered.includes('docs.') || lowered.includes('/docs')) && !docs_url) docs_url = url
        else if (url && !homepage) homepage = url
      }
    }
    if (item.action === 'fetch' && item.url) {
      const lowered = item.url.toLowerCase()
      const snippet = item.snippet?.trim() || ''
      if (item.title && !description) description = item.title
      if (snippet && !description) description = snippet.slice(0, 400)
      if (snippet && snippet.length > what_it_is.length) what_it_is = snippet.slice(0, 2000)
      if (lowered.includes('github.com') && !github_url) github_url = item.url
      else if ((lowered.includes('docs.') || lowered.includes('/docs')) && !docs_url) docs_url = item.url
      else if (!homepage) homepage = item.url
    }
  }
  return {
    homepage,
    github_url,
    docs_url,
    description,
    what_it_is,
    features: features.slice(0, 8),
  }
}

function fromNarrative(query: string, text: string): Partial<ToolResearch> {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('```'))
  return {
    name: query,
    description: lines[0]?.slice(0, 400) ?? '',
    what_it_is: text.slice(0, 2000),
  }
}

function keepFilled(partial: Partial<ToolResearch>): Partial<ToolResearch> {
  const next: Partial<ToolResearch> = {}
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue
    ;(next as Record<string, unknown>)[key] = value
  }
  return next
}

export function mergeToolResearch(base: ToolResearch, overlay?: ToolResearch | null): ToolResearch {
  if (!overlay) return base
  const next: ToolResearch = { ...base }
  const overlayRecord = overlay as unknown as Record<string, unknown>
  const nextRecord = next as unknown as Record<string, unknown>
  for (const key of Object.keys(overlayRecord) as (keyof ToolResearch)[]) {
    const value = overlayRecord[key]
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue
    nextRecord[key] = value
  }
  if (overlay.name) next.name = overlay.name
  return next
}

export function salvageResearch(
  query: string,
  text: string,
  activities: ActivityItem[],
): ToolResearch {
  const parsed = parseToolJson(text)
  return {
    ...emptyDraft(query),
    ...keepFilled(fromNarrative(query, text)),
    ...keepFilled(fromActivities(activities)),
    ...keepFilled(parsed ?? {}),
    url: query,
    name: parsed?.name || query,
  }
}
