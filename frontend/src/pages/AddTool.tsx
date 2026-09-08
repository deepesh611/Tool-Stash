import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="page-title mb-1">Add a Tool</h1>
        <p className="text-sm text-white/40 mb-6">
          {isDemo
            ? 'Demo research is simulated and does not call a live model. Saved tools reset on refresh.'
            : 'Type a tool name or paste its URL — the AI agent will research everything about it.'}
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-400/20 rounded-xl text-red-300 text-sm">
            {error}
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
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            placeholder="e.g. Raycast, Turborepo, https://linear.app"
            className="flex-1 input-glass py-3"
            autoFocus
          />
          <button
            onClick={handleResearch}
            disabled={!query.trim()}
            className="btn-primary py-3 shrink-0"
          >
            Research →
          </button>
        </div>
      </div>
    )
  }

  // --- researching ---
  if (phase === 'researching') {
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

  // --- verifying ---
  if (phase === 'verifying' && edited) {
    return (
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="page-title mb-1">Review & Save</h1>
        <p className="text-sm text-white/40 mb-6">
          {error
            ? 'Research hit a snag. Edit the draft below and save what we gathered.'
            : 'Edit any field before saving to your stash.'}
        </p>

        <ToolForm value={edited} onChange={update} />

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-400/20 rounded-xl text-red-300 text-sm">
            {error}
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
            onClick={handleSave}
            className="flex-1 btn-primary"
          >
            ✓ Save to Stash
          </button>
          <button
            onClick={() => setPhase('input')}
            className="btn-ghost px-5"
          >
            Try Again
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

  // --- saving ---
  if (phase === 'saving') {
    return (
      <div className="max-w-xl mx-auto pt-16 text-center">
        <div className="text-4xl mb-4 animate-bounce">💾</div>
        <p className="text-white/50 text-sm">Saving to your stash...</p>
      </div>
    )
  }

  // --- success ---
  return (
    <div className="max-w-xl mx-auto pt-16 text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="page-title mb-1">{edited?.name} added!</h2>
      <p className="text-white/40 text-sm mb-8">It's now in your stash.</p>
      <div className="flex gap-3 justify-center">
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
          View Stash →
        </button>
      </div>
    </div>
  )
}
