import { Check, Loader2, X } from 'lucide-react'
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
  const base = 'relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border'
  if (phase === 'start') {
    return (
      <span className={`${base} border-brand-400/40 bg-brand-500/15 text-brand-300`}>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      </span>
    )
  }
  if (phase === 'error') {
    return (
      <span className={`${base} border-red-400/30 bg-red-500/15 text-red-300`}>
        <X className="h-3 w-3" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className={`${base} border-emerald-400/30 bg-emerald-500/15 text-emerald-300`}>
      <Check className="h-3 w-3" aria-hidden="true" />
    </span>
  )
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
    <div className="glass-sunken rounded-2xl p-6 mb-6 animate-fade-rise">
      {title && (
        <p className="section-label mb-5">{title}</p>
      )}
      <ol className="relative space-y-5">
        {items.map((item) => (
          <li key={item.id} className="relative flex gap-3.5 last:[&>.rail]:hidden">
            <span
              className="rail absolute left-[0.59rem] top-6 bottom-[-1.25rem] w-px bg-white/[0.08]"
              aria-hidden="true"
            />
            <StatusMark phase={item.phase} />
            <div className="min-w-0 flex-1">
              {item.action === 'search' ? (
                <>
                  <p className="text-body text-white/85">
                    Search
                    {item.query && (
                      <span className="ml-2 font-mono text-brand-300">“{item.query}”</span>
                    )}
                  </p>
                  {item.phase === 'start' && (
                    <p className="text-label text-white/45 mt-1">Looking up sources…</p>
                  )}
                  {item.phase === 'error' && (
                    <p className="text-label text-red-300 mt-1">{item.message || 'Search failed'}</p>
                  )}
                  {item.results && item.results.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {item.results.map((hit) => (
                        <li key={hit.url || hit.title} className="text-label text-white/55 truncate">
                          {hit.url ? (
                            <a
                              href={hit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded transition-colors duration-fast ease-smooth hover:text-brand-300 focus-ring"
                            >
                              <span className="text-white/80">{hit.title || hostname(hit.url)}</span>
                              <span className="ml-2 text-white/35 font-mono text-micro">{hostname(hit.url)}</span>
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
                  <p className="text-body text-white/85">
                    Fetch
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 font-mono text-brand-300 rounded underline-offset-4 hover:underline hover:text-brand-200 transition-colors duration-fast ease-smooth focus-ring"
                      >
                        {hostname(item.url) || item.url}
                      </a>
                    )}
                  </p>
                  {item.phase === 'start' && (
                    <p className="text-label text-white/45 mt-1">Opening page…</p>
                  )}
                  {item.phase === 'done' && item.title && (
                    <p className="text-label text-white/55 mt-1 truncate">{item.title}</p>
                  )}
                  {item.phase === 'error' && (
                    <p className="text-label text-red-300 mt-1">{item.message || 'Fetch failed'}</p>
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
