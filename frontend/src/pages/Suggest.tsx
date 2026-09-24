import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Sparkles } from 'lucide-react'
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
    <div className="max-w-3xl mx-auto">
      <header className="mb-10">
        <h1 className="page-title">AI Suggest</h1>
        <p className="lede mt-4 max-w-xl">
          {isDemo
            ? 'Describe a task — this preview ranks the sample stash. No live model is called.'
            : "Describe what you're trying to do — get tool recommendations from your stash."}
        </p>
      </header>

      <div className="glass rounded-2xl p-2 mb-5">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSuggest()
          }}
          placeholder="e.g. I need to set up a monorepo with multiple packages and fast CI builds..."
          rows={4}
          aria-label="Describe your task"
          className="w-full bg-transparent border-0 resize-none rounded-xl px-5 py-4
                     text-lede text-white placeholder-white/25 min-h-[7.5rem]
                     focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400/20
                     transition-all duration-base ease-smooth"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-12">
        <p className="text-label text-white/35 flex items-center gap-1.5">
          <kbd className="inline-flex items-center rounded-md border border-white/[0.10] bg-white/[0.05]
                          px-1.5 py-0.5 font-mono text-micro text-white/60">⌘</kbd>
          <span className="text-white/25">+</span>
          <kbd className="inline-flex items-center rounded-md border border-white/[0.10] bg-white/[0.05]
                          px-1.5 py-0.5 font-mono text-micro text-white/60">Enter</kbd>
          <span className="ml-1">to submit</span>
        </p>
        <button
          onClick={handleSuggest}
          disabled={isStreaming || !description.trim()}
          className="btn-primary"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {isStreaming ? 'Thinking...' : 'Suggest Tools'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="px-5 py-3.5 bg-red-500/[0.08] border border-red-400/20 rounded-xl
                     text-red-200 text-body mb-6 animate-fade-rise"
        >
          {error}
        </div>
      )}

      {(output || isStreaming) && (
        <div className="glass rounded-2xl p-8 sm:p-10 animate-fade-rise">
          {output ? (
            <div className="prose-stash">
              <ReactMarkdown>{output + (isStreaming ? ' ▋' : '')}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <p className="text-body text-white/55">Analyzing your stash...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
