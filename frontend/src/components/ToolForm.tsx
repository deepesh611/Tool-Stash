import type { ToolResearch } from '../types'

export const CATEGORIES = [
  'Developer Tools', 'Design', 'Productivity', 'AI/ML',
  'Data & Analytics', 'DevOps & Infrastructure', 'Communication',
  'Security', 'Finance', 'Content Creation', 'Other',
]

export type ToolFormValue = ToolResearch & { personal_notes?: string }

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-gray-500 mb-1 block">{children}</label>
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

const INPUT_CLS = `w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white
                   placeholder-gray-600 focus:outline-none focus:border-brand-600 transition-colors`

interface Props {
  value: ToolFormValue
  onChange: <K extends keyof ToolFormValue>(field: K, value: ToolFormValue[K]) => void
  showNotes?: boolean
}

export default function ToolForm({ value, onChange, showNotes = false }: Props) {
  return (
    <div className="space-y-4 bg-gray-900/60 border border-gray-800 rounded-xl p-6">
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label>Name</Label>
          <input value={value.name} onChange={(e) => onChange('name', e.target.value)} className={INPUT_CLS} />
        </Field>
        <Field>
          <Label>Category</Label>
          <select
            value={value.category}
            onChange={(e) => onChange('category', e.target.value)}
            className={INPUT_CLS}
          >
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </Field>
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

      <div className="grid grid-cols-3 gap-3">
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
          className={`${INPUT_CLS} resize-none font-mono`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label>When to Use (one per line)</Label>
          <textarea
            value={value.when_to_use.join('\n')}
            onChange={(e) => onChange('when_to_use', e.target.value.split('\n'))}
            rows={4}
            className={`${INPUT_CLS} resize-none font-mono`}
          />
        </Field>
        <Field>
          <Label>When Not to Use (one per line)</Label>
          <textarea
            value={value.when_not_to_use.join('\n')}
            onChange={(e) => onChange('when_not_to_use', e.target.value.split('\n'))}
            rows={4}
            className={`${INPUT_CLS} resize-none font-mono`}
          />
        </Field>
      </div>

      <Field>
        <Label>Tags (comma-separated)</Label>
        <input
          value={value.tags.join(', ')}
          onChange={(e) => onChange('tags', e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))}
          className={`${INPUT_CLS} font-mono`}
        />
      </Field>

      {showNotes && (
        <Field>
          <Label>Your Notes</Label>
          <textarea
            value={value.personal_notes ?? ''}
            onChange={(e) => onChange('personal_notes', e.target.value)}
            rows={3}
            className={`${INPUT_CLS} resize-none`}
          />
        </Field>
      )}
    </div>
  )
}
