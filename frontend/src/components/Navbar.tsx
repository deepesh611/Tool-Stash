import { NavLink } from 'react-router-dom'
import LlmPicker from './LlmPicker'

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all
  ${isActive
    ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
    : 'text-white/50 hover:text-white hover:bg-white/[0.06]'}`

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-10 border-b border-white/[0.07] bg-[#07070f]/90 backdrop-blur-md">
      <div className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <NavLink to="/" className="font-semibold text-base text-white flex items-center gap-2.5 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400/90 to-violet-600 shadow-[0_0_16px_rgba(99,102,241,0.45)] text-sm">
              🗃
            </span>
            <span className="tracking-tight">Tool Stash</span>
          </NavLink>
          <LlmPicker />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <NavLink to="/" end className={navCls}>
            Browse
          </NavLink>
          <NavLink
            to="/add"
            className={({ isActive }) =>
              isActive
                ? 'px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-violet-500 shadow-[0_0_18px_rgba(99,102,241,0.35)]'
                : `${navCls({ isActive: false })}`
            }
          >
            + Add Tool
          </NavLink>
          <NavLink to="/suggest" className={navCls}>
            AI Suggest
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
