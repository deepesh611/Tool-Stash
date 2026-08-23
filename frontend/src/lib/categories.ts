export const DEFAULT_CATEGORIES = [
  'Developer Tools', 'Design', 'Productivity', 'AI/ML',
  'Data & Analytics', 'DevOps & Infrastructure', 'Communication',
  'Security', 'Finance', 'Content Creation', 'Other',
]

export function mergeCategories(...lists: Array<string | string[] | undefined | null>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    const items = Array.isArray(list) ? list : list ? [list] : []
    for (const raw of items) {
      const name = raw.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(name)
    }
  }
  return out
}
