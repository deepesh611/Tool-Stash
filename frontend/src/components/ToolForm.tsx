import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ToolResearch } from '../types'
import { getCategories } from '../api/tools'
import { DEFAULT_CATEGORIES, mergeCategories } from '../lib/categories'
import { normalizeTags } from '../lib/tags'

export const CATEGORIES = DEFAULT_CATEGORIES

export type ToolFormValue = ToolResearch & { personal_notes?: string }

function Label({ children }: { children: React.ReactNode }) {
  return <label className="field-label">{children}</label>
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-white/[0.06] pt-7 first:border-0 first:pt-0">
      <legend className="sr-only">{legend}</legend>
      <p className="section-label mb-5" aria-hidden="true">{legend}</p>
      <div className="space-y-5">{children}</div>
    </fieldset>
  )
}

const INPUT_CLS = `input-glass`

const NEW_CATEGORY = '__new__'

interface Props {
  value: ToolFormValue
  onChange: <K extends keyof ToolFormValue>(field: K, value: ToolFormValue[K]) => void
  showNotes?: boolean
}

function CategoryField({
  value,
  onChange,
}: {
  value: string
  onChange: (category: string) => void
}) {
  const [fromStash, setFromStash] = useState<string[]>([])
  const [created, setCreated] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState('')

  useEffect(() => {
    getCategories().then(setFromStash).catch(() => {})
  }, [])

  const options = mergeCategories(DEFAULT_CATEGORIES, fromStash, created, value)

  const commitCustom = () => {
    const name = custom.trim()
    if (!name) {
      setAdding(false)
      return
    }
    setCreated(mergeCategories(created, name))
    onChange(name)
    setAdding(false)
    setCustom('')
  }

  return (
    <Field>
      <Label>Category</Label>
      {adding ? (
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitCustom()
              }
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="New category name"
            className={INPUT_CLS}
            autoFocus
          />
          <button
            type="button"
            onClick={commitCustom}
            disabled={!custom.trim()}
            className="btn-primary btn-sm shrink-0"
            aria-label="Add category"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setCustom('') }}
            className="btn-ghost btn-sm shrink-0"
            aria-label="Cancel new category"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={options.includes(value) ? value : (value || 'Other')}
            onChange={(e) => {
              if (e.target.value === NEW_CATEGORY) {
                setAdding(true)
                setCustom('')
                return
              }
              onChange(e.target.value)
            }}
            className="select-glass"
          >
            {options.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        </div>
      )}
    </Field>
  )
}

export default function ToolForm({ value, onChange, showNotes = false }: Props) {
  return (
    <div className="glass rounded-2xl p-7 sm:p-9 space-y-8">
      <Fieldset legend="Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field>
            <Label>Name</Label>
            <input value={value.name} onChange={(e) => onChange('name', e.target.value)} className={INPUT_CLS} />
          </Field>
          <CategoryField value={value.category} onChange={(category) => onChange('category', category)} />
        </div>

        <Field>
          <Label>Description</Label>
          <textarea
            value={value.description}
            onChange={(e) => onChange('description', e.target.value)}
            rows={2}
            className={`${INPUT_CLS} resize-none`}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Links">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field>
            <Label>Homepage</Label>
            <input value={value.homepage ?? ''} onChange={(e) => onChange('homepage', e.target.value)} className={INPUT_CLS} placeholder="https://..." />
          </Field>
          <Field>
            <Label>GitHub</Label>
            <input value={value.github_url ?? ''} onChange={(e) => onChange('github_url', e.target.value)} className={INPUT_CLS} placeholder="https://github.com/..." />
          </Field>
          <Field>
            <Label>Docs</Label>
            <input value={value.docs_url ?? ''} onChange={(e) => onChange('docs_url', e.target.value)} className={INPUT_CLS} placeholder="https://docs..." />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Profile">
        <Field>
          <Label>What It Is</Label>
          <textarea
            value={value.what_it_is ?? ''}
            onChange={(e) => onChange('what_it_is', e.target.value)}
            rows={3}
            className={`${INPUT_CLS} resize-none`}
          />
        </Field>

        <Field>
          <Label>Why It Exists</Label>
          <textarea
            value={value.why_it_exists ?? ''}
            onChange={(e) => onChange('why_it_exists', e.target.value)}
            rows={3}
            className={`${INPUT_CLS} resize-none`}
          />
        </Field>

        <Field>
          <Label>Key Features (one per line)</Label>
          <textarea
            value={value.features.join('\n')}
            onChange={(e) => onChange('features', e.target.value.split('\n'))}
            rows={4}
            className={`${INPUT_CLS} resize-none font-mono text-label`}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Fit">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field>
            <Label>When to Use (one per line)</Label>
            <textarea
              value={value.when_to_use.join('\n')}
              onChange={(e) => onChange('when_to_use', e.target.value.split('\n'))}
              rows={4}
              className={`${INPUT_CLS} resize-none font-mono text-label`}
            />
          </Field>
          <Field>
            <Label>When Not to Use (one per line)</Label>
            <textarea
              value={value.when_not_to_use.join('\n')}
              onChange={(e) => onChange('when_not_to_use', e.target.value.split('\n'))}
              rows={4}
              className={`${INPUT_CLS} resize-none font-mono text-label`}
            />
          </Field>
        </div>

        <Field>
          <Label>Tags (comma-separated, kebab-case)</Label>
          <input
            value={value.tags.join(', ')}
            onChange={(e) => onChange('tags', normalizeTags(e.target.value.split(',')))}
            className={`${INPUT_CLS} font-mono text-label`}
            placeholder="open-source, cli, docker"
          />
        </Field>
      </Fieldset>

      {showNotes && (
        <Fieldset legend="Notes">
          <Field>
            <Label>Your Notes</Label>
            <textarea
              value={value.personal_notes ?? ''}
              onChange={(e) => onChange('personal_notes', e.target.value)}
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
          </Field>
        </Fieldset>
      )}
    </div>
  )
}
