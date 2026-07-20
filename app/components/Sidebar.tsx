'use client'
import { useState } from 'react'
import type { AppCtx, Page } from '../AppContext'

const nav: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⬡' },
  { id: 'pipeline',    label: 'Site Metrics', icon: '▶' },
  { id: 'planner',     label: 'Planner',     icon: '▦' },
  { id: 'articles',    label: 'Articles',    icon: '≡' },
  { id: 'directories', label: 'Directories', icon: '⊟' },
  { id: 'audit',       label: 'Audit',       icon: '◎' },
  { id: 'analytics',   label: 'Analytics',   icon: '◈' },
  { id: 'sitemap',     label: 'Sitemap',     icon: '⛓' },
  { id: 'skills',      label: 'Skills',      icon: '✦' },
  { id: 'settings',    label: 'Settings',    icon: '⚙' },
]

export default function Sidebar({ ctx, onAddSite }: { ctx: AppCtx; onAddSite: () => void }) {
  const [showSwitcher, setShowSwitcher] = useState(false)

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col relative">
      <div className="px-3 py-3 border-b border-gray-100">
        <button
          onClick={() => setShowSwitcher(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-md bg-gray-900 text-white text-xs flex items-center justify-center shrink-0 font-medium">
              {ctx.activeSite?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{ctx.activeSite?.name ?? 'No site'}</p>
              <p className="text-xs text-gray-400 truncate leading-tight">{ctx.activeSite?.url?.replace('https://', '') ?? ''}</p>
            </div>
          </div>
          <span className="text-gray-400 text-xs shrink-0 ml-1">{showSwitcher ? '▲' : '▼'}</span>
        </button>

        {showSwitcher && (
          <div className="absolute left-3 right-3 top-16 z-50 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
            {ctx.sites.map(site => (
              <button key={site.id} onClick={() => { ctx.switchSite(site.id); setShowSwitcher(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${site.id === ctx.activeSite?.id ? 'bg-gray-50' : ''}`}>
                <span className="w-6 h-6 rounded-md bg-gray-900 text-white text-xs flex items-center justify-center shrink-0 font-medium">
                  {site.name[0].toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{site.name}</p>
                  <p className="text-xs text-gray-400 truncate">{site.url.replace('https://', '')}</p>
                </div>
                {site.id === ctx.activeSite?.id && <span className="ml-auto text-gray-300 text-xs">✓</span>}
              </button>
            ))}
            <div className="border-t border-gray-100">
              <button onClick={() => { onAddSite(); setShowSwitcher(false) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
                <span className="w-6 h-6 rounded-md border border-dashed border-gray-300 text-gray-400 text-sm flex items-center justify-center shrink-0">+</span>
                <p className="text-xs text-gray-500">Add site</p>
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ id, label, icon }) => (
          <button key={id} onClick={() => ctx.setPage(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${ctx.page === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <span className="text-base leading-none">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 truncate mb-1">{ctx.user?.email ?? ''}</p>
        <button onClick={ctx.signOut} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          Sign out
        </button>
      </div>
    </aside>
  )
}
