import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamSuggest } from '../api/ai'
import { isDemo } from '../lib/demoMode'

export default function Suggest() {
  const [description, setDescription] = useState('')
  const [output, setOutput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')

  const handleSuggest = async () => {
    if (!description.trim() || isStreaming) return
    setOutput('')
    setError('')
    setIsStreaming(true)

    try {
      for await (const event of streamSuggest(description.trim())) {
        if (event.type === 'text') {
          setOutput((prev) => prev + event.content)
        } else if (event.type === 'error') {
          setError(event.message)
        }
      }
    } catch {
      setError('Network error. Is the backend running?')
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-6">
      <h1 className="page-title mb-1">AI Suggest</h1>
      <p className="text-sm text-white/40 mb-6">
        {isDemo
          ? 'Describe a task — this preview ranks the sample stash. No live model is called.'
          : "Describe what you're trying to do — get tool recommendations from your stash."}
      </p>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSuggest()
        }}
        placeholder="e.g. I need to set up a monorepo with multiple packages and fast CI builds..."
        rows={4}
        className="input-glass resize-none mb-3 min-h-[6.5rem]"
      />

      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-white/30">⌘ + Enter to submit</p>
        <button
          onClick={handleSuggest}
          disabled={isStreaming || !description.trim()}
          className="btn-primary"
        >
          {isStreaming ? 'Thinking...' : '✨ Suggest Tools'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-400/20 rounded-xl text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {(output || isStreaming) && (
        <div className="glass rounded-2xl p-6">
          {output ? (
            <div className="prose-stash">
              <ReactMarkdown>{output + (isStreaming ? ' ▋' : '')}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
              <p className="text-white/45 text-sm">Analyzing your stash...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
