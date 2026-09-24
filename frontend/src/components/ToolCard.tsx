import { useNavigate } from 'react-router-dom'
import { ChevronRight, Pencil, X } from 'lucide-react'
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
      className="glass rounded-2xl p-7 flex flex-col gap-5 cursor-pointer group
                 hover:border-white/[0.16] hover:-translate-y-1 hover:shadow-elev-3
                 focus-within:border-white/[0.16]
                 transition-all duration-base ease-smooth animate-fade-rise"
      onClick={() => navigate(`/tool/${tool.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-2">
            <h3 className="font-semibold text-white text-[1.0625rem] tracking-[-0.015em] truncate">
              {tool.name}
            </h3>
            <CategoryBadge category={tool.category} />
          </div>
          <p className="text-label text-white/55 leading-relaxed line-clamp-2">
            {tool.description}
          </p>
        </div>
        <div
          className="flex items-center gap-0.5 shrink-0 -mr-2 -mt-1.5
                     opacity-0 group-hover:opacity-100 focus-within:opacity-100
                     transition-opacity duration-base ease-smooth"
        >
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/tool/${tool.id}?edit=1`) }}
            className="btn-icon"
            title="Edit"
            aria-label={`Edit ${tool.name}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(tool.id) }}
            className="btn-icon hover:text-red-300 hover:bg-red-500/10"
            title="Remove from stash"
            aria-label={`Remove ${tool.name} from stash`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {tool.when_to_use.length > 0 && (
        <ul className="space-y-2">
          {tool.when_to_use.slice(0, 2).map((uc, i) => (
            <li key={i} className="text-label text-white/50 flex items-start gap-2 leading-relaxed">
              <ChevronRight
                className="h-3 w-3 mt-[0.28rem] shrink-0 text-brand-400/80"
                aria-hidden="true"
              />
              <span className="line-clamp-1">{uc}</span>
            </li>
          ))}
        </ul>
      )}

      {tool.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tool.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
          {tool.tags.length > 5 && (
            <span className="inline-flex items-center text-micro px-1.5 py-1 text-white/30">
              +{tool.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {tool.homepage && (
        <a
          href={tool.homepage}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-label text-brand-400 hover:text-brand-300 truncate mt-auto pt-1
                     rounded transition-colors duration-fast ease-smooth focus-ring
                     underline-offset-4 hover:underline"
        >
          {tool.homepage.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  )
}
