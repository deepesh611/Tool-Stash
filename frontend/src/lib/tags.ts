const SEPARATORS = /[^a-z0-9]+/g

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').toLowerCase().replace(/_/g, '-').replace(SEPARATORS, '-').replace(/^-+|-+$/g, '')
}

export function normalizeTags(values: string[] | undefined | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values ?? []) {
    const tag = normalizeTag(String(raw))
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}
