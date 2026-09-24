import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function TagFilter({
  tags,
  active,
  onChange,
}: {
  tags: string[]
  active: string
  onChange: (tag: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || open) {
      setOverflows(false)
      return
    }
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 2)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [tags, active, open])

  if (!tags.length) return null

  const ordered = active && tags.includes(active)
    ? [active, ...tags.filter((tag) => tag !== active)]
    : tags

  return (
    <div>
      <div
        ref={wrapRef}
        className={`flex flex-wrap gap-2 transition-all duration-slow ease-smooth ${
          open ? 'max-h-52 overflow-y-auto pr-1' : 'max-h-[3.75rem] overflow-hidden'
        }`}
      >
        {ordered.map((tag) => (
          <button
            key={tag}
            onClick={() => onChange(tag === active ? '' : tag)}
            className={`chip-interactive ${tag === active ? 'chip-active' : ''}`}
            aria-pressed={tag === active}
          >
            #{tag}
          </button>
        ))}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="mt-3 inline-flex items-center gap-1 text-label text-white/40
                     hover:text-white/75 rounded transition-colors duration-fast ease-smooth focus-ring"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-base ease-smooth ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          {open ? 'Show less' : `Show all ${tags.length} tags`}
        </button>
      )}
    </div>
  )
}
