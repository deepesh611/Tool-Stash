import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Ban, BookOpen, Check, ChevronRight, ExternalLink, GitBranch,
  Globe, Pencil, RefreshCw, Trash2,
} from 'lucide-react'
import type { Tool, ToolResearch } from '../types'
import { DuplicateToolError, getTool, deleteTool, updateTool } from '../api/tools'
import CategoryBadge from '../components/CategoryBadge'
import ToolForm, { type ToolFormValue } from '../components/ToolForm'
import StreamingText from '../components/StreamingText'
import SearchActivityLog, { applyActivity, type ActivityItem } from '../components/SearchActivityLog'
import { collectResearch } from '../lib/runResearch'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/[0.06] pt-8 mt-8 first:border-0 first:pt-0 first:mt-0">
      <h2 className="section-label mb-4">{title}</h2>
      {children}
    </section>
  )
}

function BulletList({ items, color = 'text-brand-400/80' }: { items: string[]; color?: string }) {
  if (!items.length) return <p className="text-body text-white/40 italic">None specified.</p>
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-body text-white/70 leading-relaxed">
          <ChevronRight className={`${color} h-3.5 w-3.5 mt-[0.3rem] shrink-0`} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

const LINK_ICONS: Record<string, typeof Globe> = {
  Homepage: Globe,
  GitHub: GitBranch,
  Docs: BookOpen,
}

function LinkRow({ label, url }: { label: string; url?: string }) {
  if (!url) return null
  const Icon = LINK_ICONS[label] ?? ExternalLink
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-3
                 hover:bg-white/[0.05] transition-colors duration-fast ease-smooth focus-ring"
    >
      <Icon className="h-4 w-4 shrink-0 text-white/35 group-hover:text-brand-300
                       transition-colors duration-fast ease-smooth" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-micro uppercase tracking-[0.14em] text-white/35">{label}</span>
        <span className="block text-label text-brand-400 group-hover:text-brand-300 truncate
                         transition-colors duration-fast ease-smooth">
          {url.replace(/^https?:\/\//, '')}
        </span>
      </span>
    </a>
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="skeleton h-4 w-28" />
        <div className="glass rounded-2xl p-8 space-y-4">
          <div className="skeleton h-9 w-1/3" />
          <div className="skeleton h-4 w-2/3" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-8">
          <div className="space-y-4">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-32 w-full rounded-xl" />
          </div>
          <div className="skeleton h-56 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!tool) return null

  if (view === 'researching') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          <p className="text-body text-brand-300" role="status">{statusMsg}</p>
        </div>
        <SearchActivityLog items={activities} />
        {researchText && (
          <div className="glass rounded-2xl p-7">
            <p className="section-label mb-5">Research in progress</p>
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
          className="group inline-flex items-center gap-2 text-label text-white/40 hover:text-white mb-8
                     rounded transition-colors duration-fast ease-smooth focus-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-base ease-smooth group-hover:-translate-x-0.5" aria-hidden="true" />
          Cancel
        </button>
        <h1 className="page-title">Review research</h1>
        <p className="lede mt-4 mb-10 max-w-xl">
          {saveError
            ? 'Research hit a snag. Edit the draft below and apply what we gathered.'
            : 'Edit any field, then apply it to this profile. Your notes stay as they are.'}
        </p>
        <ToolForm value={researchDraft} onChange={updateResearchDraft} />
        {saveError && (
          <div role="alert" className="mt-6 px-5 py-4 bg-red-500/[0.08] border border-red-400/20 rounded-xl text-red-200 text-body animate-fade-rise">
            {saveError}
            {duplicateId != null && (
              <button
                type="button"
                onClick={() => navigate(`/tool/${duplicateId}`)}
                className="mt-3 block text-brand-400 hover:text-brand-300 underline underline-offset-4
                           rounded transition-colors duration-fast ease-smooth focus-ring"
              >
                Open existing tool
              </button>
            )}
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={handleApplyResearch}
            disabled={saving}
            className="flex-1 btn-primary"
          >
            {saving ? 'Saving...' : 'Apply to profile'}
          </button>
          <button
            onClick={cancelResearch}
            className="btn-ghost"
          >
            Keep current
          </button>
        </div>
        {activities.length > 0 && (
          <details className="mt-8 group">
            <summary className="inline-flex items-center gap-1.5 text-label text-white/40 cursor-pointer
                                hover:text-white/75 select-none rounded transition-colors duration-fast ease-smooth focus-ring">
              Web search process
            </summary>
            <div className="mt-4">
              <SearchActivityLog items={activities} title={null} />
            </div>
          </details>
        )}
        {researchText && (
          <details className="mt-8 group">
            <summary className="inline-flex items-center gap-1.5 text-label text-white/40 cursor-pointer
                                hover:text-white/75 select-none rounded transition-colors duration-fast ease-smooth focus-ring">
              View raw research
            </summary>
            <div className="mt-4 glass-sunken rounded-2xl p-6">
              <StreamingText text={researchText} isStreaming={false} className="opacity-75" />
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
          className="group inline-flex items-center gap-2 text-label text-white/40 hover:text-white mb-8
                     rounded transition-colors duration-fast ease-smooth focus-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-base ease-smooth group-hover:-translate-x-0.5" aria-hidden="true" />
          Cancel
        </button>
        <h1 className="page-title">Edit {tool.name}</h1>
        <p className="lede mt-4 mb-10 max-w-xl">Update any field and save back to your stash.</p>
        <ToolForm value={draft} onChange={updateDraft} showNotes />
        {saveError && (
          <div role="alert" className="mt-6 px-5 py-4 bg-red-500/[0.08] border border-red-400/20 rounded-xl text-red-200 text-body animate-fade-rise">
            {saveError}
            {duplicateId != null && (
              <button
                type="button"
                onClick={() => navigate(`/tool/${duplicateId}`)}
                className="mt-3 block text-brand-400 hover:text-brand-300 underline underline-offset-4
                           rounded transition-colors duration-fast ease-smooth focus-ring"
              >
                Open existing tool
              </button>
            )}
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="flex-1 btn-primary"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            onClick={cancelEdit}
            className="btn-ghost"
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
    <div className="max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="group inline-flex items-center gap-2 text-label text-white/40 hover:text-white mb-8
                   rounded transition-colors duration-fast ease-smooth focus-ring"
      >
        <ArrowLeft
          className="h-3.5 w-3.5 transition-transform duration-base ease-smooth group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
        Back to Stash
      </button>

      {/* Header */}
      <header className="glass rounded-2xl p-8 sm:p-10 mb-10 animate-fade-rise">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="min-w-0 lg:flex-1">
            <div className="flex items-center gap-4 flex-wrap mb-4">
              <h1 className="page-title">{tool.name}</h1>
              <CategoryBadge category={tool.category} />
            </div>
            <p className="lede max-w-2xl">{tool.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button onClick={handleReResearch} className="btn-ghost btn-sm">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Re-research
            </button>
            <button onClick={startEdit} className="btn-ghost btn-sm">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
            <button onClick={handleDelete} className="btn-danger btn-sm">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-10 lg:gap-14 items-start">
        {/* Main narrative */}
        <div className="min-w-0">
          {/* What it is */}
          {tool.what_it_is && (
            <Section title="What It Is">
              <p className="text-body text-white/70 leading-relaxed">{tool.what_it_is}</p>
            </Section>
          )}

          {/* Why it exists */}
          {tool.why_it_exists && (
            <Section title="Why It Exists">
              <p className="text-body text-white/70 leading-relaxed">{tool.why_it_exists}</p>
            </Section>
          )}

          {/* Features */}
          {tool.features.length > 0 && (
            <Section title="Key Features">
              <BulletList items={tool.features} />
            </Section>
          )}

          {/* Fit — the two lists read as a contrast pair */}
          {(tool.when_to_use.length > 0 || tool.when_not_to_use.length > 0) && (
            <Section title="Fit">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {tool.when_to_use.length > 0 && (
                  <div className="glass-sunken rounded-xl p-6 border-emerald-400/[0.12]">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full
                                       bg-emerald-500/15 border border-emerald-400/25 text-emerald-300">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <h3 className="section-label !text-emerald-200/70">When to Use</h3>
                    </div>
                    <BulletList items={tool.when_to_use} color="text-emerald-400/70" />
                  </div>
                )}
                {tool.when_not_to_use.length > 0 && (
                  <div className="glass-sunken rounded-xl p-6 border-red-400/[0.12]">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full
                                       bg-red-500/15 border border-red-400/25 text-red-300">
                        <Ban className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <h3 className="section-label !text-red-200/70">When Not to Use</h3>
                    </div>
                    <BulletList items={tool.when_not_to_use} color="text-red-400/70" />
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Personal notes */}
          <Section title="Your Notes">
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesChanged(true) }}
              placeholder="Add your own notes, tips, or reminders about this tool..."
              rows={5}
              aria-label="Your notes"
              className="input-glass resize-none"
            />
            {notesChanged && (
              <div className="flex justify-end mt-4 animate-fade-rise">
                <button
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="btn-primary btn-sm"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {notesSaving ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* Meta rail */}
        <aside className="lg:sticky lg:top-24 space-y-8">
          {(tool.homepage || tool.github_url || tool.docs_url) && (
            <div className="glass rounded-2xl p-6">
              <h2 className="section-label mb-3">Links</h2>
              <div className="space-y-0.5">
                <LinkRow label="Homepage" url={tool.homepage} />
                <LinkRow label="GitHub" url={tool.github_url} />
                <LinkRow label="Docs" url={tool.docs_url} />
              </div>
            </div>
          )}

          {tool.tags.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="section-label mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {tool.tags.map((tag) => (
                  <span key={tag} className="chip">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="px-1">
            <p className="text-micro text-white/30 leading-relaxed">
              Added to stash on{' '}
              <span className="text-white/45">{addedDate}</span>
              {tool.url && (
                <>
                  <br />
                  from <span className="font-mono text-white/40 break-all">{tool.url}</span>
                </>
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
