import { useEffect, useState } from 'react'
import { Check, KeyRound, Pencil, Plug, PlugZap, Trash2 } from 'lucide-react'
import type { CustomLlm } from '../types'
import {
  createCustomLlm,
  deleteCustomLlm,
  listCustomLlms,
  testCustomLlm,
  updateCustomLlm,
} from '../api/ai'
import { isDemo } from '../lib/demoMode'

type Draft = {
  id: string | null
  name: string
  baseUrl: string
  model: string
  apiKey: string
  clearKey: boolean
  hasKey: boolean
}

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  clearKey: false,
  hasKey: false,
})

export default function Settings() {
  const [endpoints, setEndpoints] = useState<CustomLlm[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(!isDemo)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (isDemo) return
    const load = () => {
      listCustomLlms()
        .then(setEndpoints)
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false))
    }
    load()
    window.addEventListener('llm-settings-changed', load)
    return () => window.removeEventListener('llm-settings-changed', load)
  }, [])

  if (isDemo) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title">Settings</h1>
        <p className="lede mt-4">
          Custom LLM endpoints need the self-hosted app. This preview does not call a model.
        </p>
      </div>
    )
  }

  const editing = draft.id !== null

  const save = async () => {
    setError('')
    setNotice('')
    setSaving(true)
    try {
      if (editing && draft.id) {
        const body: { name: string; base_url: string; model: string; api_key?: string } = {
          name: draft.name,
          base_url: draft.baseUrl,
          model: draft.model,
        }
        if (draft.clearKey) body.api_key = ''
        else if (draft.apiKey.trim()) body.api_key = draft.apiKey.trim()
        await updateCustomLlm(draft.id, body)
      } else {
        await createCustomLlm({
          name: draft.name,
          base_url: draft.baseUrl,
          model: draft.model,
          api_key: draft.apiKey.trim(),
        })
      }
      setDraft(emptyDraft())
      setNotice(editing ? 'Endpoint updated.' : 'Endpoint added. Pick it from the navbar.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save endpoint')
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setError('')
    setNotice('')
    setTesting(true)
    try {
      const body: { base_url: string; model: string; api_key?: string; id?: string } = {
        base_url: draft.baseUrl,
        model: draft.model,
      }
      if (draft.apiKey.trim()) body.api_key = draft.apiKey.trim()
      else if (draft.clearKey) body.api_key = ''
      else if (draft.id) body.id = draft.id
      const result = await testCustomLlm(body)
      if (result.ok) setNotice(result.message)
      else setError(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the endpoint')
    } finally {
      setTesting(false)
    }
  }

  const remove = async (endpoint: CustomLlm) => {
    if (!window.confirm(`Delete ${endpoint.name}?`)) return
    setError('')
    setNotice('')
    try {
      await deleteCustomLlm(endpoint.id)
      if (draft.id === endpoint.id) setDraft(emptyDraft())
      setNotice('Endpoint deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete endpoint')
    }
  }

  const startEdit = (endpoint: CustomLlm) => {
    setError('')
    setNotice('')
    setDraft({
      id: endpoint.id,
      name: endpoint.name,
      baseUrl: endpoint.base_url,
      model: endpoint.model,
      apiKey: '',
      clearKey: false,
      hasKey: endpoint.has_key,
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="page-title">Settings</h1>
      <p className="lede mt-4 mb-10 max-w-xl">
        Add OpenAI-compatible endpoints and name them. They show up in the navbar next to Claude, OpenAI, and Ollama.
      </p>

      {error && (
        <div role="alert" className="px-5 py-4 bg-red-500/[0.08] border border-red-400/20 rounded-xl text-red-200 text-body mb-6 animate-fade-rise">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2.5 px-5 py-4 bg-emerald-500/[0.08] border border-emerald-400/20 rounded-xl text-emerald-200 text-body mb-6 animate-fade-rise">
          <Check className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      <form
        className="glass rounded-2xl p-7 sm:p-9 mb-10 space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="flex items-center gap-2.5 pb-1">
          <Plug className="h-4 w-4 text-brand-400/80" aria-hidden="true" />
          <h2 className="section-title">
            {editing ? 'Edit endpoint' : 'New endpoint'}
          </h2>
        </div>
        <label className="block">
          <span className="field-label">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Groq"
            className="input-glass"
            required
          />
        </label>
        <label className="block">
          <span className="field-label">Base URL</span>
          <input
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
            className="input-glass font-mono text-label"
            spellCheck={false}
            required
          />
        </label>
        <label className="block">
          <span className="field-label">API key</span>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value, clearKey: false })}
            placeholder={editing && draft.hasKey ? 'Saved — leave blank to keep' : 'Optional'}
            className="input-glass font-mono text-label"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {editing && draft.hasKey && (
          <label className="flex items-center gap-2.5 text-label text-white/60 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={draft.clearKey}
              onChange={(e) => setDraft({ ...draft, clearKey: e.target.checked, apiKey: '' })}
              className="h-4 w-4 rounded border-white/20 bg-white/[0.06] text-brand-500
                         accent-brand-500 focus-ring cursor-pointer"
            />
            <KeyRound className="h-3.5 w-3.5 text-white/35" aria-hidden="true" />
            Remove saved key
          </label>
        )}
        <label className="block">
          <span className="field-label">Model</span>
          <input
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            placeholder="llama-3.3-70b-versatile"
            className="input-glass font-mono text-label"
            spellCheck={false}
            required
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/[0.06]">
          <button type="submit" disabled={saving || testing} className="btn-primary">
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add endpoint'}
          </button>
          <button type="button" disabled={saving || testing} onClick={() => void test()} className="btn-ghost">
            <PlugZap className="h-4 w-4" aria-hidden="true" />
            {testing ? 'Testing...' : 'Test'}
          </button>
          {editing && (
            <button
              type="button"
              disabled={saving || testing}
              onClick={() => setDraft(emptyDraft())}
              className="btn-ghost"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className="section-label mb-5">Saved endpoints</h2>
      <div className="space-y-3">
        {loading && (
          <div className="glass rounded-xl px-6 py-5 space-y-2.5">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-3 w-56" />
            <div className="skeleton h-3 w-40" />
          </div>
        )}
        {!loading && endpoints.length === 0 && (
          <div className="glass-sunken rounded-xl px-6 py-10 text-center">
            <Plug className="h-6 w-6 mx-auto mb-3 text-white/25" aria-hidden="true" />
            <p className="text-body text-white/45">No custom endpoints yet.</p>
          </div>
        )}
        {endpoints.map((endpoint) => (
          <div
            key={endpoint.id}
            className="glass rounded-xl px-6 py-5 flex flex-wrap items-start justify-between gap-4
                       hover:border-white/[0.14] transition-colors duration-base ease-smooth"
          >
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-white">{endpoint.name}</p>
              <p className="text-label font-mono text-white/45 truncate mt-1">{endpoint.base_url}</p>
              <p className="text-label text-white/55 mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono">{endpoint.model}</span>
                <span
                  className={`chip ${endpoint.has_key
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200/80'
                    : ''}`}
                >
                  {endpoint.has_key ? 'key saved' : 'no key'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => startEdit(endpoint)} className="btn-ghost btn-sm">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(endpoint)}
                className="btn-danger btn-sm"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
