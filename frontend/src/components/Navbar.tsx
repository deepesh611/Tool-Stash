import { NavLink } from 'react-router-dom'
import LlmPicker from './LlmPicker'

export default function Navbar() {
  return (
    <nav className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur sticky top-0 z-10">
      <div className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <NavLink to="/" className="font-bold text-base text-white flex items-center gap-2 shrink-0">
            <span>🗃</span>
            <span>Tool Stash</span>
          </NavLink>
          <LlmPicker />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`
            }
          >
            Browse
          </NavLink>
          <NavLink
            to="/add"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`
            }
          >
            + Add Tool
          </NavLink>
          <NavLink
            to="/suggest"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`
            }
          >
            ✨ AI Suggest
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
