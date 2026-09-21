import { useEffect, useState } from 'react'
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
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="page-title mb-1">Settings</h1>
        <p className="text-sm text-white/40">
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
    <div className="max-w-2xl mx-auto pt-6">
      <h1 className="page-title mb-1">Settings</h1>
      <p className="text-sm text-white/40 mb-6">
        Add OpenAI-compatible endpoints and name them. They show up in the navbar next to Claude, OpenAI, and Ollama.
      </p>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-400/20 rounded-xl text-red-300 text-sm mb-4">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-400/20 rounded-xl text-emerald-300 text-sm mb-4">
          {notice}
        </div>
      )}

      <form
        className="glass rounded-2xl p-5 mb-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <h2 className="text-sm font-medium text-white">
          {editing ? 'Edit endpoint' : 'New endpoint'}
        </h2>
        <label className="block">
          <span className="block text-xs text-white/40 mb-1">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Groq"
            className="input-glass"
            required
          />
        </label>
        <label className="block">
          <span className="block text-xs text-white/40 mb-1">Base URL</span>
          <input
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
            className="input-glass font-mono text-xs"
            spellCheck={false}
            required
          />
        </label>
        <label className="block">
          <span className="block text-xs text-white/40 mb-1">API key</span>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value, clearKey: false })}
            placeholder={editing && draft.hasKey ? 'Saved — leave blank to keep' : 'Optional'}
            className="input-glass font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {editing && draft.hasKey && (
          <label className="flex items-center gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={draft.clearKey}
              onChange={(e) => setDraft({ ...draft, clearKey: e.target.checked, apiKey: '' })}
            />
            Remove saved key
          </label>
        )}
        <label className="block">
          <span className="block text-xs text-white/40 mb-1">Model</span>
          <input
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            placeholder="llama-3.3-70b-versatile"
            className="input-glass font-mono text-xs"
            spellCheck={false}
            required
          />
        </label>
        <div className="flex items-center gap-2 pt-1">
          <button type="submit" disabled={saving || testing} className="btn-primary">
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add endpoint'}
          </button>
          <button type="button" disabled={saving || testing} onClick={() => void test()} className="btn-ghost">
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

      <div className="space-y-2">
        {loading && <p className="text-sm text-white/40">Loading endpoints...</p>}
        {!loading && endpoints.length === 0 && (
          <p className="text-sm text-white/40">No custom endpoints yet.</p>
        )}
        {endpoints.map((endpoint) => (
          <div key={endpoint.id} className="glass rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-white">{endpoint.name}</p>
              <p className="text-xs font-mono text-white/40 truncate">{endpoint.base_url}</p>
              <p className="text-xs text-white/50 mt-1">
                {endpoint.model}
                <span className="text-white/30"> · {endpoint.has_key ? 'key saved' : 'no key'}</span>
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => startEdit(endpoint)} className="btn-ghost px-3 py-1.5">
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(endpoint)}
                className="btn-ghost px-3 py-1.5 text-red-300 hover:text-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
