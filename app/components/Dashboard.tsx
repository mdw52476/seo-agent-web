'use client'
import { useEffect, useState } from 'react'
import type { AppCtx } from '../AppContext'
import type { PublishedEntry, AuditReport } from '../types'
import ScoreChart from './ScoreChart'

interface AuditPoint { score: number; audited_at: string }
interface DayEntry {
  day: number
  type: 'article' | 'directory'
  keyword: string
  title: string
  status: 'planned' | 'published' | 'skipped'
}
interface Plan { cycle: number; days: DayEntry[] }
interface RunLogEntry { stage: string; ranAt: string }

const STAGE_LABELS: Record<string, string> = {
  analyze: 'Analyze site',
  research: 'Research keywords',
  'day-guide': 'Plan content',
  publish: 'Publish articles',
  'publish-dir': 'Publish directories',
  audit: 'Audit site',
  fix: 'Apply fixes',
}

export default function Dashboard({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [articles, setArticles]     = useState<PublishedEntry[]>([])
  const [directories, setDirectories] = useState<PublishedEntry[]>([])
  const [audit, setAudit]           = useState<AuditReport | null>(null)
  const [scoreHistory, setScoreHistory] = useState<AuditPoint[]>([])
  const [plan, setPlan]             = useState<Plan | null>(null)
  const [runLogs, setRunLogs]       = useState<RunLogEntry[]>([])
  const [sitemapCount, setSitemapCount] = useState<number | null>(null)

  useEffect(() => {
    setArticles([]); setDirectories([]); setAudit(null); setScoreHistory([]); setPlan(null); setRunLogs([]); setSitemapCount(null)
    fetch(`/api/published?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(setArticles)
    fetch(`/api/published?siteId=${encodeURIComponent(site.id)}&type=directory`).then(r => r.json()).then(setDirectories)
    fetch(`/api/audit-report?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(setAudit)
    fetch(`/api/analytics?siteId=${encodeURIComponent(site.id)}&range=90d`).then(r => r.json()).then(d => setScoreHistory(d?.audits ?? []))
    fetch(`/api/plan?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(setPlan)
    fetch(`/api/run-log?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(d => setRunLogs(d ?? []))
    fetch(`/api/sitemap?siteUrl=${encodeURIComponent(site.url)}`).then(r => r.json()).then(d => setSitemapCount(d?.found ? d.urls.length : 0))
  }, [site.id, site.agentRoot, site.url])

  const critical = audit?.issues.filter(i => i.severity === 'critical').length ?? 0
  const warnings  = audit?.issues.filter(i => i.severity === 'warning').length ?? 0
  const upcoming = (plan?.days ?? []).filter(d => d.status === 'planned').sort((a, b) => a.day - b.day).slice(0, 4)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">{site.name}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{site.url}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-5xl">
          <div className="grid grid-cols-5 gap-4 mb-6">
            <StatCard label="SEO score" value={audit ? `${audit.score}/100` : '—'}
              color={audit ? (audit.score >= 80 ? 'green' : audit.score >= 60 ? 'amber' : 'red') : 'gray'} />
            <StatCard label="Open issues" value={audit ? audit.issues.length : '—'}
              sub={audit ? `${critical} critical · ${warnings} warnings` : undefined}
              color={critical > 0 ? 'red' : warnings > 0 ? 'amber' : 'green'} />
            <StatCard label="Pages in sitemap" value={sitemapCount ?? '—'} />
            <StatCard label="Directories posted" value={directories.length} />
            <StatCard label="Articles posted" value={articles.length} />
          </div>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700">SEO score trend</h2>
              <button onClick={() => ctx.setPage('analytics')} className="text-xs text-blue-500 hover:underline">View analytics</button>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <ScoreChart audits={scoreHistory} height={140} />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-700">Upcoming</h2>
                <button onClick={() => ctx.setPage('planner')} className="text-xs text-blue-500 hover:underline">View planner</button>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing scheduled — generate a plan in the Planner tab.</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(d => (
                    <div key={d.day} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 w-7 h-7 rounded-md bg-gray-50 text-xs font-bold text-gray-900 flex items-center justify-center">{d.day}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{d.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{d.type === 'directory' ? 'Directory' : 'Article'} · "{d.keyword}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
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
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{a.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.publishedAt.slice(0, 10)}</p>
                      </div>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline shrink-0 ml-4">View →</a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Recent pipeline activity</h2>
            {runLogs.length === 0 ? (
              <p className="text-sm text-gray-400">No pipeline stages have run yet.</p>
            ) : (
              <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
                {runLogs.slice(0, 6).map(l => (
                  <div key={l.stage} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">{STAGE_LABELS[l.stage] ?? l.stage}</span>
                    <span className="text-xs text-gray-400">{new Date(l.ranAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
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
