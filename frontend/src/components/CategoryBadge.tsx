const COLORS: Record<string, string> = {
  'Developer Tools':          'bg-blue-900/60 text-blue-300 border-blue-800/50',
  'Design':                   'bg-pink-900/60 text-pink-300 border-pink-800/50',
  'Productivity':             'bg-green-900/60 text-green-300 border-green-800/50',
  'AI/ML':                    'bg-purple-900/60 text-purple-300 border-purple-800/50',
  'Data & Analytics':         'bg-yellow-900/60 text-yellow-300 border-yellow-800/50',
  'DevOps & Infrastructure':  'bg-orange-900/60 text-orange-300 border-orange-800/50',
  'Communication':            'bg-teal-900/60 text-teal-300 border-teal-800/50',
  'Security':                 'bg-red-900/60 text-red-300 border-red-800/50',
  'Finance':                  'bg-emerald-900/60 text-emerald-300 border-emerald-800/50',
  'Content Creation':         'bg-rose-900/60 text-rose-300 border-rose-800/50',
}

export default function CategoryBadge({ category }: { category: string }) {
  const cls = COLORS[category] ?? 'bg-gray-800 text-gray-400 border-gray-700/50'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${cls}`}>
      {category}
    </span>
  )
}
