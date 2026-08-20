import { useNavigate } from 'react-router-dom'
import type { Tool } from '../types'
import CategoryBadge from './CategoryBadge'

interface Props {
  tool: Tool
  onDelete: (id: number) => void
}

export default function ToolCard({ tool, onDelete }: Props) {
  const navigate = useNavigate()

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700
                 transition-all cursor-pointer group flex flex-col gap-3"
      onClick={() => navigate(`/tool/${tool.id}`)}
    >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate text-base">{tool.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tool.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/tool/${tool.id}?edit=1`) }}
              className="text-gray-600 hover:text-white text-xs px-1.5 py-1"
              title="Edit"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(tool.id) }}
              className="text-gray-600 hover:text-red-400 text-sm p-1 -mr-1 -mt-1"
              title="Remove from stash"
            >
              ✕
            </button>
          </div>
        </div>

      <CategoryBadge category={tool.category} />

      {tool.when_to_use.length > 0 && (
        <ul className="space-y-1">
          {tool.when_to_use.slice(0, 2).map((uc, i) => (
            <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
              <span className="text-brand-500 mt-0.5 shrink-0">▸</span>
              <span className="line-clamp-1">{uc}</span>
            </li>
          ))}
        </ul>
      )}

      {tool.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tool.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded-full font-mono">
              {tag}
            </span>
          ))}
          {tool.tags.length > 5 && (
            <span className="text-xs px-2 py-0.5 text-gray-600">+{tool.tags.length - 5}</span>
          )}
        </div>
      )}

      {tool.homepage && (
        <a
          href={tool.homepage}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-brand-500 hover:text-brand-400 truncate mt-auto"
        >
          {tool.homepage.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  )
}
