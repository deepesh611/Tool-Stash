import { NavLink } from 'react-router-dom'
import { Archive, LayoutGrid, Plus, Settings2, Sparkles } from 'lucide-react'
import LlmPicker from './LlmPicker'

const navCls = ({ isActive }: { isActive: boolean }) =>
  `relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-label font-medium
   transition-all duration-base ease-smooth focus-ring
   after:absolute after:inset-x-3 after:-bottom-px after:h-px after:rounded-full
   after:transition-all after:duration-base after:ease-smooth
  ${isActive
    ? 'text-white bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] after:bg-gradient-to-r after:from-transparent after:via-brand-400/80 after:to-transparent'
    : 'text-white/50 hover:text-white hover:bg-white/[0.05] after:bg-transparent'}`

export default function Navbar() {
  return (
    <nav className="nav-bar">
      <div className="nav-row container mx-auto max-w-7xl px-6 sm:px-8 py-2.5 min-h-[4rem]">
        <div className="flex items-center gap-4 shrink-0">
          <NavLink
            to="/"
            className="group flex items-center gap-3 shrink-0 rounded-lg focus-ring"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl
                             bg-gradient-to-br from-brand-400 to-rose-700
                             shadow-glow-brand ring-1 ring-white/15
                             transition-transform duration-base ease-smooth group-hover:scale-105">
              <Archive className="h-[1.05rem] w-[1.05rem] text-white" aria-hidden="true" />
            </span>
            <span className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-white">
              Tool Stash
            </span>
          </NavLink>
          <LlmPicker />
        </div>

        <div className="nav-links">
          <NavLink to="/" end className={navCls}>
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            Browse
          </NavLink>
          <NavLink
            to="/add"
            className={({ isActive }) =>
              isActive
                ? `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-label font-medium text-white
                   bg-gradient-to-r from-brand-600 to-rose-600 shadow-glow-brand
                   transition-all duration-base ease-smooth focus-ring`
                : `${navCls({ isActive: false })}`
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Tool
          </NavLink>
          <NavLink to="/suggest" className={navCls}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            AI Suggest
          </NavLink>
          <NavLink to="/settings" className={navCls}>
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
