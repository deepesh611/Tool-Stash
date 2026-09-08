import { useEffect, useState, useCallback } from 'react'
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
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="page-title">Your Stash</h1>
          {!loading && (
            <p className="text-xs text-white/40 mt-1">
              {tools.length} tool{tools.length !== 1 ? 's' : ''}
              {hasFilters ? ' matching filters' : ' total'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Clear filters ✕
            </button>
          )}
          <button
            onClick={handleExport}
            className="btn-ghost !text-xs !py-1.5 !px-3"
          >
            Export
          </button>
          <label className="btn-ghost !text-xs !py-1.5 !px-3 cursor-pointer">
            Import
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                void handleImport(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      {ioMessage && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            ioTone === 'error'
              ? 'bg-red-500/10 border border-red-400/20 text-red-300'
              : ioTone === 'warn'
                ? 'bg-amber-500/10 border border-amber-400/20 text-amber-200'
                : 'glass text-white/70'
          }`}
        >
          {ioMessage}
        </div>
      )}
      {loadError && (
        <p className="text-xs text-red-400 -mt-4 mb-4">{loadError}</p>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-glass"
        />
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setActiveCategory('')}
            className={`text-xs px-3 py-1 rounded-full border backdrop-blur-sm transition-all
              ${!activeCategory
                ? 'bg-brand-600/90 border-brand-500/80 text-white shadow-[0_0_16px_rgba(99,102,241,0.35)]'
                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
              className={`text-xs px-3 py-1 rounded-full border backdrop-blur-sm transition-all
                ${cat === activeCategory
                  ? 'bg-brand-600/90 border-brand-500/80 text-white shadow-[0_0_16px_rgba(99,102,241,0.35)]'
                  : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-2xl h-48 animate-pulse" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <div className="text-center py-24 text-white/40">
          <p className="text-5xl mb-4">📦</p>
          {hasFilters ? (
            <>
              <p className="text-base">No tools match your filters.</p>
              <button onClick={clearFilters} className="text-sm mt-2 text-brand-400 hover:underline">
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-base">Your stash is empty.</p>
              <p className="text-sm mt-1">
                <a href="/add" className="text-brand-400 hover:underline">Add your first tool →</a>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
