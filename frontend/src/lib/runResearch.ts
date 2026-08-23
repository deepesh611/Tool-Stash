import { streamResearch } from '../api/ai'
import { applyActivity, type ActivityItem } from '../components/SearchActivityLog'
import type { ResearchEvent, ToolResearch } from '../types'
import { salvageResearch, mergeToolResearch } from './researchDraft'

export async function collectResearch(
  query: string,
  onEvent?: (event: ResearchEvent) => void,
): Promise<{
  draft: ToolResearch
  text: string
  activities: ActivityItem[]
  error: string
}> {
  let draft: ToolResearch | null = null
  let text = ''
  let activities: ActivityItem[] = []
  let error = ''

  try {
    for await (const event of streamResearch(query)) {
      onEvent?.(event)
      if (event.type === 'activity') {
        activities = applyActivity(activities, event)
      } else if (event.type === 'text') {
        text = event.content
      } else if (event.type === 'result') {
        draft = event.data
      } else if (event.type === 'error') {
        error = event.message
      }
    }
  } catch {
    error = error || 'Network error. Is the backend running?'
  }

  return {
    draft: mergeToolResearch(salvageResearch(query, text, activities), draft),
    text,
    activities,
    error,
  }
}
