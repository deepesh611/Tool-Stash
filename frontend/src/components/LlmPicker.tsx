import { useEffect, useMemo, useState } from 'react'
import type { LlmProviderId, LlmSettings } from '../types'
import { getLlmSettings, updateLlmSettings } from '../api/ai'
import { isDemo } from '../lib/demoMode'

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'text-orange-300',
  openai: 'text-emerald-300',
  ollama: 'text-sky-300',
}

function providerColor(id: string) {
  if (id.startsWith('custom:')) return 'text-rose-200'
  return PROVIDER_COLORS[id] ?? 'text-white/70'
}

const SELECT_CLS = `bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-micro font-mono
                    text-white/80 placeholder-white/25 backdrop-blur-md
                    hover:border-white/[0.16] hover:bg-white/[0.07]
                    focus:outline-none focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20
                    disabled:opacity-50 disabled:cursor-not-allowed
                    max-w-[7.5rem] sm:max-w-[11rem]
                    transition-all duration-base ease-smooth`

export default function LlmPicker() {
  const [settings, setSettings] = useState<LlmSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = () => {
      getLlmSettings().then(setSettings).catch(() => {})
    }
    load()
    window.addEventListener('llm-settings-changed', load)
    return () => window.removeEventListener('llm-settings-changed', load)
  }, [])

  const active = useMemo(
    () => settings?.providers.find((item) => item.id === settings.provider),
    [settings],
  )

  if (!settings || !active) return null

  if (isDemo) {
    return (
      <span className="hidden sm:inline-flex items-center text-micro font-mono text-white/45 border border-white/[0.08] rounded-lg px-2.5 py-1.5 bg-white/[0.04]">
        Demo preview
      </span>
    )
  }

  const apply = async (provider: LlmProviderId, model: string) => {
    const nextModel = model.trim()
    if (!nextModel) return
    setSaving(true)
    try {
      const updated = await updateLlmSettings(provider, nextModel)
      setSettings(updated)
    } catch {
      const refreshed = await getLlmSettings().catch(() => null)
      if (refreshed) setSettings(refreshed)
    } finally {
      setSaving(false)
    }
  }

  const onProviderChange = (provider: LlmProviderId) => {
    const option = settings.providers.find((item) => item.id === provider)
    void apply(provider, option?.model || option?.models[0] || settings.model)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={settings.provider}
        disabled={saving}
        onChange={(e) => onProviderChange(e.target.value as LlmProviderId)}
        className={`${SELECT_CLS} select-chevron ${providerColor(settings.provider)}`}
        title="LLM provider"
      >
        {settings.providers.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}{item.available ? '' : ' (no key)'}
          </option>
        ))}
      </select>
      <input
        list="llm-model-options"
        value={settings.model}
        disabled={saving}
        onChange={(e) => {
          const value = e.target.value
          setSettings({ ...settings, model: value })
          if (active.models.includes(value) && value !== settings.model) {
            void apply(settings.provider, value)
          }
        }}
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value.trim() !== active.model) {
            void apply(settings.provider, e.target.value)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
        className={`${SELECT_CLS} w-[6.5rem] sm:w-[10.5rem]`}
        title="Model name"
        spellCheck={false}
      />
      <datalist id="llm-model-options">
        {active.models.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  )
}
