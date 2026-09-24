// Muted, warm-biased hues. Still distinct enough to scan by colour, but
// desaturated so they sit inside the amber identity instead of fighting it.
const COLORS: Record<string, string> = {
  'Developer Tools':          'bg-sky-500/[0.12] text-sky-200/85 border-sky-400/20',
  'Design':                   'bg-fuchsia-500/[0.12] text-fuchsia-200/85 border-fuchsia-400/20',
  'Productivity':             'bg-emerald-500/[0.12] text-emerald-200/85 border-emerald-400/20',
  'AI/ML':                    'bg-violet-500/[0.12] text-violet-200/85 border-violet-400/20',
  'Data & Analytics':         'bg-amber-500/[0.12] text-amber-200/85 border-amber-400/20',
  'DevOps & Infrastructure':  'bg-orange-500/[0.12] text-orange-200/85 border-orange-400/20',
  'Communication':            'bg-teal-500/[0.12] text-teal-200/85 border-teal-400/20',
  'Security':                 'bg-red-500/[0.12] text-red-200/85 border-red-400/20',
  'Finance':                  'bg-lime-500/[0.12] text-lime-200/85 border-lime-400/20',
  'Content Creation':         'bg-rose-500/[0.12] text-rose-200/85 border-rose-400/20',
}

export default function CategoryBadge({ category }: { category: string }) {
  const cls = COLORS[category] ?? 'bg-white/[0.07] text-white/60 border-white/[0.10]'
  return (
    <span
      className={`inline-flex items-center text-micro font-medium tracking-wide
                  px-2.5 py-1 rounded-full border backdrop-blur-sm shrink-0 ${cls}`}
    >
      {category}
    </span>
  )
}
