import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sparkle } from 'lucide-react'
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
        <div className="relative z-20 flex items-center justify-center gap-2 px-4 py-2
                        text-micro tracking-wide text-brand-100/80
                        bg-gradient-to-r from-brand-600/20 via-rose-600/20 to-brand-600/20
                        border-b border-white/[0.07]">
          <Sparkle className="h-3 w-3 shrink-0 text-brand-300" aria-hidden="true" />
          <span>Live demo — sample stash, simulated research. Changes reset on refresh.</span>
        </div>
      )}
      <Navbar />
      <main className="flex-1 container mx-auto max-w-7xl px-6 sm:px-8 py-12 sm:py-16">
        <Outlet />
      </main>
      <footer className="border-t border-white/[0.05] py-8 text-center">
        <p className="text-micro text-white/25 font-mono tracking-wider">
          frontend {FRONTEND_VERSION} · backend {backendVersion}
        </p>
      </footer>
    </div>
  )
}
