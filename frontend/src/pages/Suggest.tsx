import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamSuggest } from '../api/ai'

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
      <h1 className="text-xl font-bold mb-1">AI Suggest</h1>
      <p className="text-sm text-gray-500 mb-6">
        Describe what you're trying to do — get tool recommendations from your stash.
      </p>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSuggest()
        }}
        placeholder="e.g. I need to set up a monorepo with multiple packages and fast CI builds..."
        rows={4}
        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white
                   placeholder-gray-600 focus:outline-none focus:border-brand-600 resize-none mb-3 transition-colors"
      />

      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-gray-600">⌘ + Enter to submit</p>
        <button
          onClick={handleSuggest}
          disabled={isStreaming || !description.trim()}
          className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl
                     text-sm font-medium transition-colors"
        >
          {isStreaming ? 'Thinking...' : '✨ Suggest Tools'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {(output || isStreaming) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {output ? (
            <div className="prose-stash">
              <ReactMarkdown>{output + (isStreaming ? ' ▋' : '')}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
              <p className="text-gray-500 text-sm">Analyzing your stash...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
