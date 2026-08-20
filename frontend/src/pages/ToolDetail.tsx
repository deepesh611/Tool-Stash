import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import type { Tool } from '../types'
import { DuplicateToolError, getTool, deleteTool, updateTool } from '../api/tools'
import CategoryBadge from '../components/CategoryBadge'
import ToolForm, { type ToolFormValue } from '../components/ToolForm'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-800 pt-5 mt-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function BulletList({ items, color = 'text-brand-500' }: { items: string[]; color?: string }) {
  if (!items.length) return <p className="text-sm text-gray-600 italic">None specified.</p>
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
          <span className={`${color} mt-0.5 shrink-0`}>▸</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function LinkRow({ label, url }: { label: string; url?: string }) {
  if (!url) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 w-20 shrink-0">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-400 hover:text-brand-300 truncate"
      >
        {url.replace(/^https?:\/\//, '')}
      </a>
    </div>
  )
}

export default function ToolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editing = searchParams.get('edit') === '1'
  const [tool, setTool] = useState<Tool | null>(null)
  const [draft, setDraft] = useState<ToolFormValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesChanged, setNotesChanged] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [duplicateId, setDuplicateId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const toDraft = (item: Tool): ToolFormValue => ({
    name: item.name,
    description: item.description,
    category: item.category,
    homepage: item.homepage ?? '',
    github_url: item.github_url ?? '',
    docs_url: item.docs_url ?? '',
    what_it_is: item.what_it_is ?? '',
    why_it_exists: item.why_it_exists ?? '',
    features: item.features ?? [],
    when_to_use: item.when_to_use ?? [],
    when_not_to_use: item.when_not_to_use ?? [],
    tags: item.tags ?? [],
    url: item.url,
    personal_notes: item.personal_notes ?? '',
  })

  useEffect(() => {
    if (!id) return
    getTool(Number(id))
      .then((t) => {
        setTool(t)
        setNotes(t.personal_notes ?? '')
        setDraft(toDraft(t))
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleDelete = async () => {
    if (!tool || !confirm(`Remove "${tool.name}" from your stash?`)) return
    await deleteTool(tool.id)
    navigate('/')
  }

  const handleSaveNotes = async () => {
    if (!tool) return
    setNotesSaving(true)
    try {
      const updated = await updateTool(tool.id, { personal_notes: notes })
      setTool(updated)
      setDraft(toDraft(updated))
      setNotesChanged(false)
    } finally {
      setNotesSaving(false)
    }
  }

  const startEdit = () => {
    if (!tool) return
    setDraft(toDraft({ ...tool, personal_notes: notes }))
    setSaveError('')
    setDuplicateId(null)
    setSearchParams({ edit: '1' })
  }

  const cancelEdit = () => {
    if (tool) setDraft(toDraft(tool))
    setSaveError('')
    setDuplicateId(null)
    setSearchParams({})
  }

  const updateDraft = <K extends keyof ToolFormValue>(field: K, value: ToolFormValue[K]) =>
    setDraft((prev) => prev ? { ...prev, [field]: value } : prev)

  const handleSaveEdit = async () => {
    if (!tool || !draft) return
    setSaving(true)
    setSaveError('')
    setDuplicateId(null)
    try {
      const updated = await updateTool(tool.id, {
        name: draft.name,
        description: draft.description,
        category: draft.category,
        url: draft.url,
        homepage: draft.homepage,
        github_url: draft.github_url,
        docs_url: draft.docs_url,
        what_it_is: draft.what_it_is,
        why_it_exists: draft.why_it_exists,
        features: draft.features,
        when_to_use: draft.when_to_use,
        when_not_to_use: draft.when_not_to_use,
        tags: draft.tags,
        personal_notes: draft.personal_notes,
      })
      setTool(updated)
      setNotes(updated.personal_notes ?? '')
      setNotesChanged(false)
      setDraft(toDraft(updated))
      setSearchParams({})
    } catch (err) {
      if (err instanceof DuplicateToolError) {
        setSaveError(err.message)
        setDuplicateId(err.id)
      } else {
        setSaveError('Failed to save changes.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-900 rounded-lg w-1/3" />
        <div className="h-4 bg-gray-900 rounded-lg w-2/3" />
        <div className="h-48 bg-gray-900 rounded-xl" />
      </div>
    )
  }

  if (!tool) return null

  if (editing && draft) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={cancelEdit}
          className="text-sm text-gray-500 hover:text-white mb-6 flex items-center gap-1 transition-colors"
        >
          ← Cancel
        </button>
        <h1 className="text-xl font-bold mb-1">Edit {tool.name}</h1>
        <p className="text-sm text-gray-500 mb-6">Update any field and save back to your stash.</p>
        <ToolForm value={draft} onChange={updateDraft} showNotes />
        {saveError && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-400 text-sm">
            {saveError}
            {duplicateId != null && (
              <button
                type="button"
                onClick={() => navigate(`/tool/${duplicateId}`)}
                className="mt-2 block text-brand-400 hover:text-brand-300 underline underline-offset-2"
              >
                Open existing tool
              </button>
            )}
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            onClick={cancelEdit}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const addedDate = new Date(tool.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="text-sm text-gray-500 hover:text-white mb-6 flex items-center gap-1 transition-colors"
      >
        ← Back to Stash
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-2xl font-bold text-white">{tool.name}</h1>
            <CategoryBadge category={tool.category} />
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">{tool.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={startEdit}
            className="text-xs text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600
                       px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="text-xs text-gray-600 hover:text-red-400 border border-gray-800 hover:border-red-900
                       px-3 py-1.5 rounded-lg transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Tags */}
      {tool.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {tool.tags.map((tag) => (
            <span key={tag} className="text-xs px-2.5 py-0.5 bg-gray-800 text-gray-500 rounded-full font-mono">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Links */}
      {(tool.homepage || tool.github_url || tool.docs_url) && (
        <Section title="Links">
          <div className="space-y-2">
            <LinkRow label="Homepage" url={tool.homepage} />
            <LinkRow label="GitHub" url={tool.github_url} />
            <LinkRow label="Docs" url={tool.docs_url} />
          </div>
        </Section>
      )}

      {/* What it is */}
      {tool.what_it_is && (
        <Section title="What It Is">
          <p className="text-sm text-gray-300 leading-relaxed">{tool.what_it_is}</p>
        </Section>
      )}

      {/* Why it exists */}
      {tool.why_it_exists && (
        <Section title="Why It Exists">
          <p className="text-sm text-gray-300 leading-relaxed">{tool.why_it_exists}</p>
        </Section>
      )}

      {/* Features */}
      {tool.features.length > 0 && (
        <Section title="Key Features">
          <BulletList items={tool.features} />
        </Section>
      )}

      {/* When to use */}
      {tool.when_to_use.length > 0 && (
        <Section title="When to Use">
          <BulletList items={tool.when_to_use} color="text-green-500" />
        </Section>
      )}

      {/* When not to use */}
      {tool.when_not_to_use.length > 0 && (
        <Section title="When Not to Use">
          <BulletList items={tool.when_not_to_use} color="text-red-500" />
        </Section>
      )}

      {/* Personal notes */}
      <Section title="Your Notes">
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesChanged(true) }}
          placeholder="Add your own notes, tips, or reminders about this tool..."
          rows={4}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300
                     placeholder-gray-700 focus:outline-none focus:border-brand-600 resize-none transition-colors"
        />
        {notesChanged && (
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveNotes}
              disabled={notesSaving}
              className="text-sm px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50
                         rounded-lg transition-colors"
            >
              {notesSaving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        )}
      </Section>

      {/* Footer */}
      <div className="mt-8 pt-5 border-t border-gray-800 text-xs text-gray-600">
        Added to stash on {addedDate}
        {tool.url && <span> · from <span className="font-mono">{tool.url}</span></span>}
      </div>
    </div>
  )
}
