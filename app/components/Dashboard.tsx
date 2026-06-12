'use client'
import { useEffect, useState } from 'react'
import type { AppCtx } from '../AppContext'
import type { PublishedEntry, AuditReport } from '../types'

export default function Dashboard({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [articles, setArticles] = useState<PublishedEntry[]>([])
  const [audit, setAudit] = useState<AuditReport | null>(null)

  useEffect(() => {
    setArticles([]); setAudit(null)
    fetch(`/api/published?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(setArticles)
    fetch(`/api/audit-report?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(setAudit)
  }, [site.id, site.agentRoot])

  const critical = audit?.issues.filter(i => i.severity === 'critical').length ?? 0
  const warnings  = audit?.issues.filter(i => i.severity === 'warning').length ?? 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">{site.name}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{site.url}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl">
          <div className="grid grid-cols-3 gap-4 mb-10">
            <StatCard label="Articles published" value={articles.length} />
            <StatCard label="SEO score" value={audit ? `${audit.score}/100` : '—'}
              color={audit ? (audit.score >= 80 ? 'green' : audit.score >= 60 ? 'amber' : 'red') : 'gray'} />
            <StatCard label="Open issues" value={audit ? audit.issues.length : '—'}
              sub={audit ? `${critical} critical · ${warnings} warnings` : undefined}
              color={critical > 0 ? 'red' : warnings > 0 ? 'amber' : 'green'} />
          </div>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700">Recent articles</h2>
              <button onClick={() => ctx.setPage('articles')} className="text-xs text-blue-500 hover:underline">View all</button>
            </div>
            {articles.length === 0 ? (
              <p className="text-sm text-gray-400">No articles published yet.</p>
            ) : (
              <div className="space-y-2">
                {[...articles].reverse().slice(0, 5).map(a => (
                  <div key={a.slug} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.publishedAt.slice(0, 10)}</p>
                    </div>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline shrink-0 ml-4">View →</a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Quick actions</h2>
            <div className="flex gap-3 flex-wrap">
              <ActionButton label="Publish article"    onClick={() => ctx.setPage('articles')} />
              <ActionButton label="Post directory"     onClick={() => ctx.setPage('directories')} />
              <ActionButton label="Run audit"          onClick={() => ctx.setPage('audit')} />
              <ActionButton label="Edit writing style" onClick={() => ctx.setPage('skills')} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'gray' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = { green: 'text-green-600', amber: 'text-amber-500', red: 'text-red-500', gray: 'text-gray-900' }
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors">
      {label}
    </button>
  )
}
