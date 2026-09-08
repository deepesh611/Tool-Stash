import { useEffect, useRef, useState } from 'react'

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
    <div className="mb-6">
      <div
        ref={wrapRef}
        className={`flex flex-wrap gap-1.5 ${
          open ? 'max-h-40 overflow-y-auto pr-1' : 'max-h-[4.5rem] overflow-hidden'
        }`}
      >
        {ordered.map((tag) => (
          <button
            key={tag}
            onClick={() => onChange(tag === active ? '' : tag)}
            className={`text-xs px-2.5 py-0.5 rounded-full font-mono border transition-all
              ${tag === active
                ? 'bg-white/15 border-white/25 text-white'
                : 'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/70'}`}
          >
            #{tag}
          </button>
        ))}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="mt-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {open ? 'Show less' : `Show all ${tags.length} tags`}
        </button>
      )}
    </div>
  )
}
