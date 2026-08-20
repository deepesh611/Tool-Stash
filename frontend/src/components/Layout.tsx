import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import { FRONTEND_VERSION, fetchBackendVersion } from '../api/version'

export default function Layout() {
  const [backendVersion, setBackendVersion] = useState('…')

  useEffect(() => {
    fetchBackendVersion().then(setBackendVersion)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-gray-800/80 py-3 text-center text-[11px] text-gray-600 font-mono">
        frontend {FRONTEND_VERSION} · backend {backendVersion}
      </footer>
    </div>
  )
}
