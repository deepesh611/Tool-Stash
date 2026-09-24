import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Loader2, PartyPopper, Search } from 'lucide-react'
import type { ToolResearch } from '../types'
import { DuplicateToolError, findDuplicate, saveTool } from '../api/tools'
import StreamingText from '../components/StreamingText'
import SearchActivityLog, { applyActivity, type ActivityItem } from '../components/SearchActivityLog'
import ToolForm, { type ToolFormValue } from '../components/ToolForm'
import { collectResearch } from '../lib/runResearch'
import { isDemo } from '../lib/demoMode'

type Phase = 'input' | 'researching' | 'verifying' | 'saving' | 'success'

export default function AddTool() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('input')
  const [query, setQuery] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [researchText, setResearchText] = useState('')
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [edited, setEdited] = useState<ToolResearch | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [duplicateId, setDuplicateId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const handleResearch = async () => {
    if (!query.trim()) return
    const q = query.trim()
    setError('')
    setDuplicateId(null)

    const existing = await findDuplicate(q)
    if (existing) {
      setError(`"${existing.name}" is already in your stash.`)
      setDuplicateId(existing.id)
      return
    }

    setPhase('researching')
    setResearchText('')
    setActivities([])
    setStatusMsg('Connecting to AI agent...')

    const { draft, text, activities: activityList, error: researchError } = await collectResearch(q, (event) => {
      if (event.type === 'status') setStatusMsg(event.message)
      else if (event.type === 'activity') setActivities((prev) => applyActivity(prev, event))
      else if (event.type === 'text') setResearchText(event.content)
    })

    setResearchText(text)
    setActivities(activityList)
    setEdited(draft)
    setError(researchError)
    setPhase('verifying')
  }

  const handleSave = async () => {
    if (!edited) return
    setPhase('saving')
    setError('')
    setDuplicateId(null)
    try {
      const saved = await saveTool({ ...edited, url: query.trim() })
      setSavedId(saved.id)
      setPhase('success')
    } catch (err) {
      if (err instanceof DuplicateToolError) {
        setError(err.message)
        setDuplicateId(err.id)
      } else {
        setError('Failed to save. Please try again.')
      }
      setPhase('verifying')
    }
  }

  const update = <K extends keyof ToolFormValue>(field: K, value: ToolFormValue[K]) =>
    setEdited((prev) => prev ? { ...prev, [field]: value } : prev)

  // --- input ---
  if (phase === 'input') {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title">Add a Tool</h1>
        <p className="lede mt-4 mb-10">
          {isDemo
            ? 'Demo research is simulated and does not call a live model. Saved tools reset on refresh.'
            : 'Type a tool name or paste its URL — the AI agent will research everything about it.'}
        </p>
        {error && (
          <div role="alert" className="mb-6 px-5 py-4 bg-red-500/[0.08] border border-red-400/20 rounded-xl text-red-200 text-body animate-fade-rise">
            {error}
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
              placeholder="e.g. Raycast, Turborepo, https://linear.app"
              aria-label="Tool name or URL"
              className="input-glass pl-[3.25rem] py-3.5 text-lede"
              autoFocus
            />
          </div>
          <button
            onClick={handleResearch}
            disabled={!query.trim()}
            className="btn-primary py-3.5 shrink-0"
          >
            Research
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  // --- researching ---
  if (phase === 'researching') {
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

  // --- verifying ---
  if (phase === 'verifying' && edited) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="page-title">Review &amp; Save</h1>
        <p className="lede mt-4 mb-10 max-w-xl">
          {error
            ? 'Research hit a snag. Edit the draft below and save what we gathered.'
            : 'Edit any field before saving to your stash.'}
        </p>

        <ToolForm value={edited} onChange={update} />

        {error && (
          <div role="alert" className="mt-6 px-5 py-4 bg-red-500/[0.08] border border-red-400/20 rounded-xl text-red-200 text-body animate-fade-rise">
            {error}
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
            onClick={handleSave}
            className="flex-1 btn-primary"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Save to Stash
          </button>
          <button
            onClick={() => setPhase('input')}
            className="btn-ghost"
          >
            Try Again
          </button>
        </div>

        {activities.length > 0 && (
          <details className="mt-8">
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
          <details className="mt-8">
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

  // --- saving ---
  if (phase === 'saving') {
    return (
      <div className="max-w-xl mx-auto py-28 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full
                        bg-white/[0.04] border border-white/[0.07] shadow-elev-1 mb-7">
          <Loader2 className="h-6 w-6 text-brand-300 animate-spin" aria-hidden="true" />
        </div>
        <p className="text-body text-white/55" role="status">Saving to your stash...</p>
      </div>
    )
  }

  // --- success ---
  return (
    <div className="max-w-xl mx-auto py-28 flex flex-col items-center text-center animate-fade-rise">
      <div className="flex h-20 w-20 items-center justify-center rounded-full
                      bg-gradient-to-br from-brand-500/25 to-rose-600/20
                      border border-brand-400/25 shadow-glow-brand mb-7">
        <PartyPopper className="h-8 w-8 text-brand-200" aria-hidden="true" />
      </div>
      <h2 className="page-title">{edited?.name} added!</h2>
      <p className="lede mt-4 mb-10">It's now in your stash.</p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => { setPhase('input'); setQuery(''); setEdited(null); setActivities([]) }}
          className="btn-ghost"
        >
          Add Another
        </button>
        {savedId && (
          <button
            onClick={() => navigate(`/tool/${savedId}`)}
            className="btn-ghost"
          >
            View Profile
          </button>
        )}
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          View Stash
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
