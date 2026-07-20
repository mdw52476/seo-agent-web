'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Site } from './types'
import { createClient } from './lib/supabase/client'

export type Page = 'dashboard' | 'pipeline' | 'planner' | 'articles' | 'directories' | 'audit' | 'analytics' | 'sitemap' | 'skills' | 'settings'

export interface AppCtx {
  sites: Site[]
  activeSite: Site | null
  page: Page
  setPage: (p: Page) => void
  switchSite: (id: string) => void
  addSite: (site: Site) => Promise<void>
  updateSite: (site: Site) => void
  deleteSite: (id: string) => void
  user: { id: string; email: string } | null
  signOut: () => Promise<void>
}

const Ctx = createContext<AppCtx | null>(null)
export const useApp = () => useContext(Ctx)!

export function AppProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<Site[]>([])
  const [activeSiteId, setActiveSiteId] = useState<string>('')
  const [page, setPage] = useState<Page>('dashboard')
  const [loaded, setLoaded] = useState(false)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? '' })
    })
  }, [])

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then((stored: Site[]) => {
      if (stored.length > 0) {
        setSites(stored)
        setActiveSiteId(stored[0].id)
      }
      setLoaded(true)
    })
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const activeSite = sites.find(s => s.id === activeSiteId) ?? null

  const switchSite = (id: string) => { setActiveSiteId(id); setPage('dashboard') }

  const addSite = async (site: Site) => {
    const res = await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(site) })
    const { agentRoot } = await res.json()
    const finalSite = { ...site, agentRoot }
    setSites(prev => [...prev, finalSite])
    setActiveSiteId(finalSite.id)
    setPage('pipeline')
  }

  const updateSite = (site: Site) => {
    setSites(prev => prev.map(s => s.id === site.id ? site : s))
    fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(site) })
  }

  const deleteSite = (id: string) => {
    const remaining = sites.filter(s => s.id !== id)
    setSites(remaining)
    if (activeSiteId === id) setActiveSiteId(remaining[0]?.id ?? '')
    fetch('/api/sites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  const ctx: AppCtx = { sites, activeSite, page, setPage, switchSite, addSite, updateSite, deleteSite, user, signOut }

  if (!loaded) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  )

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
}
