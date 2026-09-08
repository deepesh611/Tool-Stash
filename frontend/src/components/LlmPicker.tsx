import { useEffect, useMemo, useState } from 'react'
import type { LlmProviderId, LlmSettings } from '../types'
import { getLlmSettings, updateLlmSettings } from '../api/ai'
import { isDemo } from '../lib/demoMode'

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'text-orange-400',
  openai: 'text-green-400',
  ollama: 'text-blue-400',
}

const SELECT_CLS = `bg-white/[0.05] border border-white/[0.1] rounded-lg px-2 py-1 text-xs font-mono
                    text-gray-200 focus:outline-none focus:border-brand-400/50 max-w-[11rem] backdrop-blur-md`

export default function LlmPicker() {
  const [settings, setSettings] = useState<LlmSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getLlmSettings().then(setSettings).catch(() => {})
  }, [])

  const active = useMemo(
    () => settings?.providers.find((item) => item.id === settings.provider),
    [settings],
  )

  if (!settings || !active) return null

  if (isDemo) {
    return (
      <span className="hidden sm:inline text-[11px] font-mono text-white/40 border border-white/10 rounded-lg px-2 py-1 bg-white/[0.04]">
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
    <div className="flex items-center gap-1.5">
      <select
        value={settings.provider}
        disabled={saving}
        onChange={(e) => onProviderChange(e.target.value as LlmProviderId)}
        className={`${SELECT_CLS} ${PROVIDER_COLORS[settings.provider] ?? 'text-gray-300'}`}
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
        className={`${SELECT_CLS} w-[10.5rem]`}
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
