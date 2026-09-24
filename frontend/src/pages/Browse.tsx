import { useEffect, useState, useCallback } from 'react'
import { Download, PackageOpen, Search, SlidersHorizontal, Upload, X } from 'lucide-react'
import type { Tool } from '../types'
import { getTools, deleteTool, getCategories, getAllTags, exportStash, importStash } from '../api/tools'
import ToolCard from '../components/ToolCard'
import TagFilter from '../components/TagFilter'

export default function Browse() {
  const [tools, setTools] = useState<Tool[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [ioMessage, setIoMessage] = useState('')
  const [ioTone, setIoTone] = useState<'ok' | 'warn' | 'error'>('ok')

  const fetchTools = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getTools({
        search: search || undefined,
        category: activeCategory || undefined,
        tag: activeTag || undefined,
      })
      setTools(data)
    } catch {
      setLoadError('Could not load your stash.')
      setTools([])
    } finally {
      setLoading(false)
    }
  }, [search, activeCategory, activeTag])

  useEffect(() => {
    const timer = setTimeout(fetchTools, 300)
    return () => clearTimeout(timer)
  }, [fetchTools])

  useEffect(() => {
    getCategories().then(setCategories)
    getAllTags().then(setAllTags)
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this tool from your stash?')) return
    await deleteTool(id)
    setTools((prev) => prev.filter((t) => t.id !== id))
  }

  const clearFilters = () => {
    setSearch('')
    setActiveCategory('')
    setActiveTag('')
  }

  const refreshMeta = () => {
    getCategories().then(setCategories).catch(() => {})
    getAllTags().then(setAllTags).catch(() => {})
  }

  const handleExport = async () => {
    try {
      await exportStash()
      setIoTone('ok')
      setIoMessage('Stash exported.')
    } catch {
      setIoTone('error')
      setIoMessage('Export failed.')
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const result = await importStash(file)
      const parts: string[] = []
      if (result.imported) {
        parts.push(`Imported ${result.imported} tool${result.imported === 1 ? '' : 's'}`)
      }
      if (result.skipped) {
        parts.push(`skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}`)
      }
      if (result.invalid) {
        parts.push(`${result.invalid} could not be read`)
      }
      if (!result.imported && result.skipped && !result.invalid) {
        setIoTone('warn')
        setIoMessage(`Nothing new. All ${result.skipped} tools are already in your stash.`)
      } else if (!result.imported && !result.skipped && result.invalid) {
        setIoTone('error')
        setIoMessage('Import failed. None of the tools in that file could be read.')
      } else if (!result.imported && !result.skipped && !result.invalid) {
        setIoTone('warn')
        setIoMessage('That file has no tools to import.')
      } else {
        setIoTone(result.invalid ? 'warn' : 'ok')
        setIoMessage(`${parts.join(', ')}.`)
      }
      await fetchTools()
      refreshMeta()
    } catch (err) {
      setIoTone('error')
      setIoMessage(err instanceof Error ? err.message : 'Import failed. Use a Tool Stash JSON export.')
    }
  }

  const hasFilters = search || activeCategory || activeTag

  return (
    <div>
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="page-title">Your Stash</h1>
          {!loading && (
            <p className="mt-3 text-label text-white/40 tracking-wide">
              <span className="font-mono text-brand-300/90">{tools.length}</span>
              {' '}tool{tools.length !== 1 ? 's' : ''}
              {hasFilters ? ' matching filters' : ' total'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button onClick={handleExport} className="btn-ghost btn-sm">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </button>
          <label className="btn-ghost btn-sm cursor-pointer focus-within:ring-2 focus-within:ring-brand-400/55 focus-within:ring-offset-2 focus-within:ring-offset-ink">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Import
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                void handleImport(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </header>

      {ioMessage && (
        <div
          role="status"
          className={`mb-8 px-5 py-3.5 rounded-xl text-body animate-fade-rise ${
            ioTone === 'error'
              ? 'bg-red-500/[0.08] border border-red-400/20 text-red-200'
              : ioTone === 'warn'
                ? 'bg-amber-500/[0.08] border border-amber-400/20 text-amber-100'
                : 'glass-sunken text-white/70'
          }`}
        >
          {ioMessage}
        </div>
      )}
      {loadError && (
        <p className="mb-8 text-body text-red-300">{loadError}</p>
      )}

      {/* Filter shelf — search, categories and tags read as one object */}
      <section
        aria-label="Filters"
        className="glass-sunken rounded-2xl mb-12 divide-y divide-white/[0.05]"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search your stash"
            className="w-full bg-transparent border-0 rounded-t-2xl pl-[3.25rem] pr-5 py-4
                       text-body text-white placeholder-white/30
                       focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400/25
                       transition-all duration-base ease-smooth"
          />
        </div>

        {categories.length > 0 && (
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="h-3 w-3 text-white/30" aria-hidden="true" />
              <span className="section-label">Category</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory('')}
                aria-pressed={!activeCategory}
                className={`filter-pill ${!activeCategory ? 'filter-pill-active' : ''}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
                  aria-pressed={cat === activeCategory}
                  className={`filter-pill ${cat === activeCategory ? 'filter-pill-active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {allTags.length > 0 && (
          <div className="px-5 py-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="section-label">Tags</span>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-label text-white/40
                             hover:text-white rounded transition-colors duration-fast ease-smooth focus-ring"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  Clear filters
                </button>
              )}
            </div>
            <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />
          </div>
        )}
      </section>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <div className="skeleton h-4 w-2/5" />
                <div className="skeleton h-4 w-20 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-4/5" />
              </div>
              <div className="space-y-2 pt-1">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-2/3" />
              </div>
              <div className="flex gap-1.5 pt-1">
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : tools.length === 0 ? (
        <div className="flex flex-col items-center text-center py-28 animate-fade-rise">
          <div className="flex h-20 w-20 items-center justify-center rounded-full
                          bg-white/[0.04] border border-white/[0.07] shadow-elev-1 mb-7">
            <PackageOpen className="h-8 w-8 text-white/30" aria-hidden="true" />
          </div>
          {hasFilters ? (
            <>
              <p className="section-title mb-2">No tools match your filters.</p>
              <p className="text-body text-white/45 mb-7">
                Try a broader search or a different category.
              </p>
              <button onClick={clearFilters} className="btn-ghost">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="section-title mb-2">Your stash is empty.</p>
              <p className="text-body text-white/45 mb-7">
                Add a tool by name or URL and let the agent fill in the profile.
              </p>
              <a href="/add" className="btn-primary">
                Add your first tool
              </a>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
