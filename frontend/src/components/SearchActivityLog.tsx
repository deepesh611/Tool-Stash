import type { ResearchActivity } from '../types'

export type ActivityItem = ResearchActivity & { id: number }

function hostname(url?: string): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function mergeActivity(items: ActivityItem[], event: ResearchActivity, nextId: number): ActivityItem[] {
  if (event.phase !== 'start') {
    const idx = [...items].reverse().findIndex((item) => (
      item.phase === 'start'
      && item.action === event.action
      && (event.action === 'search' ? item.query === event.query : item.url === event.url)
    ))
    if (idx !== -1) {
      const realIndex = items.length - 1 - idx
      const next = [...items]
      next[realIndex] = { ...next[realIndex], ...event }
      return next
    }
  }
  return [...items, { id: nextId, ...event }]
}

export function applyActivity(items: ActivityItem[], event: ResearchActivity): ActivityItem[] {
  const nextId = (items[items.length - 1]?.id ?? 0) + 1
  return mergeActivity(items, event, nextId)
}

function StatusMark({ phase }: { phase: ActivityItem['phase'] }) {
  if (phase === 'start') {
    return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500 animate-pulse" />
  }
  if (phase === 'error') {
    return <span className="mt-0.5 text-red-400 text-xs shrink-0">✕</span>
  }
  return <span className="mt-0.5 text-emerald-400 text-xs shrink-0">✓</span>
}

export default function SearchActivityLog({
  items,
  title = 'Web search process',
}: {
  items: ActivityItem[]
  title?: string | null
}) {
  if (!items.length) return null

  return (
    <div className="glass rounded-2xl p-4 mb-4">
      {title && (
        <p className="text-xs text-white/35 mb-3 uppercase tracking-wider">{title}</p>
      )}
      <ol className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2.5">
            <StatusMark phase={item.phase} />
            <div className="min-w-0 flex-1">
              {item.action === 'search' ? (
                <>
                  <p className="text-sm text-gray-200">
                    Search
                    {item.query && (
                      <span className="ml-2 font-mono text-brand-400">“{item.query}”</span>
                    )}
                  </p>
                  {item.phase === 'start' && (
                    <p className="text-xs text-gray-500 mt-0.5">Looking up sources…</p>
                  )}
                  {item.phase === 'error' && (
                    <p className="text-xs text-red-400 mt-0.5">{item.message || 'Search failed'}</p>
                  )}
                  {item.results && item.results.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {item.results.map((hit) => (
                        <li key={hit.url || hit.title} className="text-xs text-gray-400 truncate">
                          {hit.url ? (
                            <a
                              href={hit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-brand-300"
                            >
                              <span className="text-gray-200">{hit.title || hostname(hit.url)}</span>
                              <span className="ml-1.5 text-gray-600">{hostname(hit.url)}</span>
                            </a>
                          ) : (
                            <span>{hit.title}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-200">
                    Fetch
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 font-mono text-brand-400 hover:text-brand-300"
                      >
                        {hostname(item.url) || item.url}
                      </a>
                    )}
                  </p>
                  {item.phase === 'start' && (
                    <p className="text-xs text-gray-500 mt-0.5">Opening page…</p>
                  )}
                  {item.phase === 'done' && item.title && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{item.title}</p>
                  )}
                  {item.phase === 'error' && (
                    <p className="text-xs text-red-400 mt-0.5">{item.message || 'Fetch failed'}</p>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
