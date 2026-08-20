export const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || 'dev'

export async function fetchBackendVersion(): Promise<string> {
  const res = await fetch('/api/health')
  if (!res.ok) return 'unknown'
  const data = await res.json().catch(() => null)
  const version = data && typeof data.version === 'string' ? data.version.trim() : ''
  return version || 'unknown'
}
