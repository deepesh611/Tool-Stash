export interface Tool {
  id: number
  name: string
  url?: string
  description: string
  category: string
  homepage?: string
  github_url?: string
  docs_url?: string
  what_it_is?: string
  why_it_exists?: string
  features: string[]
  when_to_use: string[]
  when_not_to_use: string[]
  tags: string[]
  personal_notes?: string
  created_at: string
}

export interface ToolResearch {
  name: string
  description: string
  category: string
  homepage?: string
  github_url?: string
  docs_url?: string
  what_it_is?: string
  why_it_exists?: string
  features: string[]
  when_to_use: string[]
  when_not_to_use: string[]
  tags: string[]
  url?: string
}

export interface SearchHit {
  title: string
  url: string
  content?: string
}

export type ResearchActivity = {
  action: 'search' | 'fetch' | string
  phase: 'start' | 'done' | 'error'
  query?: string
  url?: string
  title?: string
  snippet?: string
  results?: SearchHit[]
  message?: string
}

export type ResearchEvent =
  | { type: 'status'; message: string }
  | ({ type: 'activity' } & ResearchActivity)
  | { type: 'text'; content: string }
  | { type: 'result'; data: ToolResearch }
  | { type: 'error'; message: string }

export type SuggestEvent =
  | { type: 'text'; content: string }
  | { type: 'error'; message: string }

export type LlmProviderId = 'claude' | 'openai' | 'ollama'

export interface LlmProviderOption {
  id: LlmProviderId
  label: string
  available: boolean
  model: string
  models: string[]
}

export interface LlmSettings {
  provider: LlmProviderId
  model: string
  providers: LlmProviderOption[]
}
