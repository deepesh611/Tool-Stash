const COLORS: Record<string, string> = {
  'Developer Tools':          'bg-blue-500/15 text-blue-200 border-blue-400/25',
  'Design':                   'bg-pink-500/15 text-pink-200 border-pink-400/25',
  'Productivity':             'bg-emerald-500/15 text-emerald-200 border-emerald-400/25',
  'AI/ML':                    'bg-violet-500/15 text-violet-200 border-violet-400/25',
  'Data & Analytics':         'bg-amber-500/15 text-amber-200 border-amber-400/25',
  'DevOps & Infrastructure':  'bg-orange-500/15 text-orange-200 border-orange-400/25',
  'Communication':            'bg-teal-500/15 text-teal-200 border-teal-400/25',
  'Security':                 'bg-red-500/15 text-red-200 border-red-400/25',
  'Finance':                  'bg-lime-500/15 text-lime-200 border-lime-400/25',
  'Content Creation':         'bg-rose-500/15 text-rose-200 border-rose-400/25',
}

export default function CategoryBadge({ category }: { category: string }) {
  const cls = COLORS[category] ?? 'bg-white/10 text-white/60 border-white/10'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border backdrop-blur-sm shrink-0 ${cls}`}>
      {category}
    </span>
  )
}
