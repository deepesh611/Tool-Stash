import type { LlmSettings, ResearchEvent, SuggestEvent, ToolResearch } from '../types'
import { DEMO_TOOLS } from './seed'
import { demoAllTools } from './store'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function titleCase(query: string) {
  const cleaned = query.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  if (cleaned.includes('.')) return cleaned.split('.')[0]
  return query
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function draftFromQuery(query: string): ToolResearch {
  const known = DEMO_TOOLS.find((tool) =>
    tool.name.toLowerCase() === query.trim().toLowerCase()
    || tool.homepage?.includes(query.replace(/^https?:\/\//i, '').split('/')[0] || '___'),
  )
  if (known) {
    return {
      name: known.name,
      description: known.description,
      category: known.category,
      homepage: known.homepage,
      github_url: known.github_url,
      docs_url: known.docs_url,
      what_it_is: known.what_it_is,
      why_it_exists: known.why_it_exists,
      features: known.features,
      when_to_use: known.when_to_use,
      when_not_to_use: known.when_not_to_use,
      tags: known.tags,
      url: query,
    }
  }

  const name = titleCase(query.trim()) || query.trim()
  const host = query.includes('.') ? query.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') : `${name.toLowerCase().replace(/\s+/g, '')}.dev`
  return {
    name,
    description: `${name} is a (demo) profile generated in this preview. Refresh the page to reset the stash to sample tools.`,
    category: 'Other',
    homepage: `https://${host}`,
    github_url: '',
    docs_url: '',
    what_it_is: `This is a simulated research result for “${name}”. The live app uses Ollama, Claude, or OpenAI plus web search to fill this in.`,
    why_it_exists: 'The Vercel preview has no backend. Add and edit tools for this session; a refresh restores the dummy catalog.',
    features: [
      'Works in this browser session',
      'Same UI as the self-hosted app',
      'Resets when you reload',
    ],
    when_to_use: ['Exploring the Tool Stash interface'],
    when_not_to_use: ['As a source of real product facts'],
    tags: ['demo', 'preview'],
    url: query,
  }
}

export async function* demoStreamResearch(query: string): AsyncGenerator<ResearchEvent> {
  const q = query.trim()
  const host = q.replace(/^https?:\/\//i, '').split('/')[0] || `${titleCase(q).toLowerCase()}.dev`
  yield { type: 'status', message: 'Researching in demo mode…' }
  await sleep(280)
  yield { type: 'status', message: 'Searching the web for current sources...' }
  yield {
    type: 'activity',
    action: 'search',
    phase: 'start',
    query: q,
  }
  await sleep(420)
  yield {
    type: 'activity',
    action: 'search',
    phase: 'done',
    query: q,
    results: [
      { title: `${titleCase(q)} — official site`, url: `https://${host}`, content: 'Official homepage (simulated).' },
      { title: `${titleCase(q)} on GitHub`, url: `https://github.com/search?q=${encodeURIComponent(q)}`, content: 'Repository search (simulated).' },
    ],
  }
  yield { type: 'status', message: `Fetching https://${host}/...` }
  yield { type: 'activity', action: 'fetch', phase: 'start', url: `https://${host}/` }
  await sleep(380)
  yield {
    type: 'activity',
    action: 'fetch',
    phase: 'done',
    url: `https://${host}/`,
    title: titleCase(q),
    snippet: 'Simulated page fetch for the Vercel preview.',
  }
  yield { type: 'status', message: 'Writing the tool profile...' }
  const draft = draftFromQuery(q)
  const narrative = `${draft.name} — ${draft.description}\n\nThis preview does not call a live model. Save it to try the review flow; refresh to restore sample data.`
  yield { type: 'text', content: narrative }
  yield { type: 'result', data: draft }
}

export async function* demoStreamSuggest(description: string): AsyncGenerator<SuggestEvent> {
  const words = description.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2)
  const scored = demoAllTools().map((tool) => {
    const hay = `${tool.name} ${tool.description} ${tool.category} ${tool.tags.join(' ')} ${tool.when_to_use.join(' ')}`.toLowerCase()
    const score = words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0)
    return { tool, score }
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score)

  const chunks: string[] = [
    '## Recommendations from Your Stash\n\n',
  ]
  if (scored.length) {
    for (const { tool } of scored.slice(0, 3)) {
      chunks.push(`**${tool.name}** — ${tool.description}\n\n*Why?* ${tool.when_to_use[0] || tool.why_it_exists || 'It is already in this demo stash.'}\n\n`)
    }
  } else {
    chunks.push('No strong matches in the sample stash for that prompt. Try “linux desktop”, “media server”, or “docker”.\n\n')
  }
  chunks.push('### Not in this preview\n\nThe live app can also mention tools outside your stash. This demo only ranks the sample catalog.\n')

  for (const chunk of chunks) {
    await sleep(90)
    yield { type: 'text', content: chunk }
  }
}

export const DEMO_LLM_SETTINGS: LlmSettings = {
  provider: 'ollama',
  model: 'demo-preview',
  providers: [
    {
      id: 'ollama',
      label: 'Demo',
      available: true,
      model: 'demo-preview',
      models: ['demo-preview'],
    },
  ],
}
