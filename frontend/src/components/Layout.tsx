import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import { FRONTEND_VERSION, fetchBackendVersion } from '../api/version'
import { isDemo } from '../lib/demoMode'

export default function Layout() {
  const [backendVersion, setBackendVersion] = useState('…')

  useEffect(() => {
    fetchBackendVersion().then(setBackendVersion)
  }, [])

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <div className="bg-scene" aria-hidden="true">
        <div className="bg-ring bg-ring-a" />
        <div className="bg-ring bg-ring-b" />
      </div>
      {isDemo && (
        <div className="relative z-20 text-center text-[11px] leading-relaxed tracking-wide text-white/70 bg-brand-600/25 border-b border-white/10 py-1.5 px-4">
          Live demo — sample stash, simulated research. Changes reset on refresh.
        </div>
      )}
      <Navbar />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-white/[0.06] py-4 text-center text-[11px] text-white/30 font-mono">
        frontend {FRONTEND_VERSION} · backend {backendVersion}
      </footer>
    </div>
  )
}
