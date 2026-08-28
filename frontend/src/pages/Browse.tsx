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
      setIoMessage('Stash exported.')
    } catch {
      setIoMessage('Export failed.')
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const result = await importStash(file)
      setIoMessage(`Imported ${result.imported}, skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}.`)
      await fetchTools()
      refreshMeta()
    } catch {
      setIoMessage('Import failed. Use a Tool Stash JSON export.')
    }
  }

  const hasFilters = search || activeCategory || activeTag

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Your Stash</h1>
          {!loading && (
            <p className="text-xs text-gray-500 mt-0.5">
              {tools.length} tool{tools.length !== 1 ? 's' : ''}
              {hasFilters ? ' matching filters' : ' total'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Clear filters ✕
            </button>
          )}
          <button
            onClick={handleExport}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Export
          </button>
          <label className="text-xs px-3 py-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors cursor-pointer">
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
        <p className="text-xs text-gray-500 -mt-4 mb-4">{ioMessage}</p>
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
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5
                     text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-600
                     transition-colors"
        />
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setActiveCategory('')}
            className={`text-xs px-3 py-1 rounded-full border transition-colors
              ${!activeCategory
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors
                ${cat === activeCategory
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'}`}
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
            <div key={i} className="bg-gray-900/50 rounded-xl h-48 animate-pulse border border-gray-800/50" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <div className="text-center py-24 text-gray-600">
          <p className="text-5xl mb-4">📦</p>
          {hasFilters ? (
            <>
              <p className="text-base">No tools match your filters.</p>
              <button onClick={clearFilters} className="text-sm mt-2 text-brand-500 hover:underline">
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-base">Your stash is empty.</p>
              <p className="text-sm mt-1">
                <a href="/add" className="text-brand-500 hover:underline">Add your first tool →</a>
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
