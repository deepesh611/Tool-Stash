import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import type { Tool, ToolResearch } from '../types'
import { DuplicateToolError, getTool, deleteTool, updateTool } from '../api/tools'
import CategoryBadge from '../components/CategoryBadge'
import ToolForm, { type ToolFormValue } from '../components/ToolForm'
import StreamingText from '../components/StreamingText'
import SearchActivityLog, { applyActivity, type ActivityItem } from '../components/SearchActivityLog'
import { collectResearch } from '../lib/runResearch'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[0.07] pt-5 mt-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-3">{title}</h2>
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

function researchQuery(item: Tool): string {
  return (item.homepage || item.url || item.name).trim()
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
  const [view, setView] = useState<'profile' | 'researching' | 'review'>('profile')
  const [statusMsg, setStatusMsg] = useState('')
  const [researchText, setResearchText] = useState('')
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [researchDraft, setResearchDraft] = useState<ToolResearch | null>(null)

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

  const handleReResearch = async () => {
    if (!tool) return
    if (!confirm('Fetch a fresh profile from the web? Your personal notes will be kept.')) return
    const q = researchQuery(tool)
    setView('researching')
    setStatusMsg('Connecting to AI agent...')
    setResearchText('')
    setActivities([])
    setSaveError('')
    setDuplicateId(null)
    setSearchParams({})

    const { draft, text, activities: activityList, error } = await collectResearch(q, (event) => {
      if (event.type === 'status') setStatusMsg(event.message)
      else if (event.type === 'activity') setActivities((prev) => applyActivity(prev, event))
      else if (event.type === 'text') setResearchText(event.content)
    })

    setResearchText(text)
    setActivities(activityList)
    setResearchDraft({ ...draft, url: tool.url || q })
    setSaveError(error)
    setView('review')
  }

  const cancelResearch = () => {
    setView('profile')
    setResearchDraft(null)
    setSaveError('')
    setDuplicateId(null)
  }

  const updateResearchDraft = <K extends keyof ToolFormValue>(field: K, value: ToolFormValue[K]) =>
    setResearchDraft((prev) => prev ? { ...prev, [field]: value } : prev)

  const handleApplyResearch = async () => {
    if (!tool || !researchDraft) return
    setSaving(true)
    setSaveError('')
    setDuplicateId(null)
    try {
      const updated = await updateTool(tool.id, {
        name: researchDraft.name,
        description: researchDraft.description,
        category: researchDraft.category,
        url: researchDraft.url || tool.url,
        homepage: researchDraft.homepage,
        github_url: researchDraft.github_url,
        docs_url: researchDraft.docs_url,
        what_it_is: researchDraft.what_it_is,
        why_it_exists: researchDraft.why_it_exists,
        features: researchDraft.features,
        when_to_use: researchDraft.when_to_use,
        when_not_to_use: researchDraft.when_not_to_use,
        tags: researchDraft.tags,
        personal_notes: notes,
      })
      setTool(updated)
      setDraft(toDraft(updated))
      setNotes(updated.personal_notes ?? '')
      setNotesChanged(false)
      setView('profile')
      setResearchDraft(null)
    } catch (err) {
      if (err instanceof DuplicateToolError) {
        setSaveError(err.message)
        setDuplicateId(err.id)
      } else {
        setSaveError('Failed to apply research.')
      }
    } finally {
      setSaving(false)
    }
  }

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
        <div className="h-8 glass rounded-lg w-1/3" />
        <div className="h-4 glass rounded-lg w-2/3" />
        <div className="h-48 glass rounded-2xl" />
      </div>
    )
  }

  if (!tool) return null

  if (view === 'researching') {
    return (
      <div className="max-w-2xl mx-auto pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
          <p className="text-sm text-brand-400">{statusMsg}</p>
        </div>
        <SearchActivityLog items={activities} />
        {researchText && (
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-white/35 mb-3 uppercase tracking-wider">Research in progress</p>
            <StreamingText text={researchText} isStreaming />
          </div>
        )}
      </div>
    )
  }

  if (view === 'review' && researchDraft) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={cancelResearch}
          className="text-sm text-white/40 hover:text-white mb-6 flex items-center gap-1 transition-colors"
        >
          ← Cancel
        </button>
        <h1 className="page-title mb-1">Review research</h1>
        <p className="text-sm text-white/40 mb-6">
          {saveError
            ? 'Research hit a snag. Edit the draft below and apply what we gathered.'
            : 'Edit any field, then apply it to this profile. Your notes stay as they are.'}
        </p>
        <ToolForm value={researchDraft} onChange={updateResearchDraft} />
        {saveError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-400/20 rounded-xl text-red-300 text-sm">
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
            onClick={handleApplyResearch}
            disabled={saving}
            className="flex-1 btn-primary"
          >
            {saving ? 'Saving...' : 'Apply to profile'}
          </button>
          <button
            onClick={cancelResearch}
            className="btn-ghost px-5"
          >
            Keep current
          </button>
        </div>
        {activities.length > 0 && (
          <details className="mt-5">
            <summary className="text-xs text-white/35 cursor-pointer hover:text-white/60 select-none">
              Web search process
            </summary>
            <div className="mt-2">
              <SearchActivityLog items={activities} title={null} />
            </div>
          </details>
        )}
        {researchText && (
          <details className="mt-5">
            <summary className="text-xs text-white/35 cursor-pointer hover:text-white/60 select-none">
              View raw research
            </summary>
            <div className="mt-2 glass rounded-2xl p-4">
              <StreamingText text={researchText} isStreaming={false} className="text-xs opacity-70" />
            </div>
          </details>
        )}
      </div>
    )
  }

  if (editing && draft) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={cancelEdit}
          className="text-sm text-white/40 hover:text-white mb-6 flex items-center gap-1 transition-colors"
        >
          ← Cancel
        </button>
        <h1 className="page-title mb-1">Edit {tool.name}</h1>
        <p className="text-sm text-white/40 mb-6">Update any field and save back to your stash.</p>
        <ToolForm value={draft} onChange={updateDraft} showNotes />
        {saveError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-400/20 rounded-xl text-red-300 text-sm">
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
            className="flex-1 btn-primary"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            onClick={cancelEdit}
            className="btn-ghost px-5"
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
        className="text-sm text-white/40 hover:text-white mb-6 flex items-center gap-1 transition-colors"
      >
        ← Back to Stash
      </button>

      {/* Header */}
      <div className="glass rounded-2xl p-6 mb-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="page-title">{tool.name}</h1>
            <CategoryBadge category={tool.category} />
          </div>
          <p className="text-white/55 text-sm leading-relaxed">{tool.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReResearch}
            className="btn-ghost !text-xs !py-1.5 !px-3"
          >
            Re-research
          </button>
          <button
            onClick={startEdit}
            className="btn-ghost !text-xs !py-1.5 !px-3"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="btn-ghost !text-xs !py-1.5 !px-3 hover:!text-red-300 hover:!border-red-400/30"
          >
            Remove
          </button>
        </div>
      </div>
      </div>

      {/* Tags */}
      {tool.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {tool.tags.map((tag) => (
            <span key={tag} className="chip">
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
          className="input-glass resize-none"
        />
        {notesChanged && (
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveNotes}
              disabled={notesSaving}
              className="btn-primary !text-sm !px-4 !py-1.5"
            >
              {notesSaving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        )}
      </Section>

      {/* Footer */}
      <div className="mt-8 pt-5 border-t border-white/[0.07] text-xs text-white/30">
        Added to stash on {addedDate}
        {tool.url && <span> · from <span className="font-mono">{tool.url}</span></span>}
      </div>
    </div>
  )
}
