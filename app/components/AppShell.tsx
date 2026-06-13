'use client'
import { useState } from 'react'
import { useApp } from '../AppContext'
import Sidebar from './Sidebar'
import Dashboard from './Dashboard'
import Pipeline from './Pipeline'
import Articles from './Articles'
import Directories from './Directories'
import Audit from './Audit'
import Skills from './Skills'
import SiteSettings from './SiteSettings'
import Analytics from './Analytics'
import AddSiteModal from './AddSiteModal'
import Assistant from './Assistant'

export default function AppShell() {
  const ctx = useApp()
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar ctx={ctx} onAddSite={() => setShowAddModal(true)} />
      <main className="flex-1 overflow-auto">
        {!ctx.activeSite ? (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm">
            No site selected.{' '}
            <button onClick={() => setShowAddModal(true)} className="ml-1 text-blue-500 hover:underline">Add a site</button>
          </div>
        ) : (
          <>
            {ctx.page === 'dashboard' && <Dashboard ctx={ctx} />}
            {ctx.page === 'pipeline'  && <Pipeline ctx={ctx} />}
            {ctx.page === 'articles'     && <Articles ctx={ctx} />}
            {ctx.page === 'directories'  && <Directories ctx={ctx} />}
            {ctx.page === 'audit'        && <Audit ctx={ctx} />}
            {ctx.page === 'analytics'    && <Analytics ctx={ctx} />}
            {ctx.page === 'skills'       && <Skills ctx={ctx} />}
            {ctx.page === 'settings'  && <SiteSettings ctx={ctx} />}
          </>
        )}
      </main>
      {showAddModal && <AddSiteModal onAdd={ctx.addSite} onClose={() => setShowAddModal(false)} />}
      <Assistant ctx={ctx} />
    </div>
  )
}
