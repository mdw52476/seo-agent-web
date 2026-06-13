'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import LogViewer from './LogViewer'
import type { AppCtx } from '../AppContext'

interface AuditIssue {
  severity: string
  page: string
  rule: string
  detail: string
  fix: string
  autoFixable: boolean
}

interface AuditReport {
  siteUrl: string
  auditedAt: string
  pagesChecked: number
  issues: AuditIssue[]
  score: number
}

type Tab = 'report' | 'run'

const SEV_WEIGHT: Record<string, number> = { critical: 12, warning: 5, recommendation: 2 }

function calcScore(base: number, issues: AuditIssue[], resolved: Set<number>): number {
  if (!issues.length) return base
  const totalWeight  = issues.reduce((s, i) => s + (SEV_WEIGHT[i.severity] ?? 2), 0)
  const resolvedWeight = [...resolved].reduce((s, idx) => s + (SEV_WEIGHT[issues[idx]?.severity] ?? 2), 0)
  return Math.min(100, Math.round(base + (resolvedWeight / totalWeight) * (100 - base)))
}

export default function Audit({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [tab, setTab] = useState<Tab>('report')
  const [report, setReport] = useState<AuditReport | null>(null)
  const [filter, setFilter] = useState('all')
  const [running, setRunning] = useState(false)
  const [fixingIdx, setFixingIdx] = useState<number | null>(null)
  const [lines, setLines] = useState<{ text: string; stream: string }[]>([])
  const [resolved, setResolved] = useState<Set<number>>(new Set())
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  useEffect(() => {
    setReport(null); setResolved(new Set())
    fetch(`/api/audit-report?siteId=${encodeURIComponent(site.id)}`)
      .then(r => r.json()).then(d => d && setReport(d))
  }, [site.id, site.agentRoot])

  const runCmd = useCallback(async (cmd: string, afterRun?: () => void) => {
    if (running) return
    readerRef.current?.cancel()
    setRunning(true); setLines([]); setTab('run')

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, agentRoot: site.agentRoot, siteId: site.id, siteUrl: site.url, siteType: site.siteType, siteEnv: site.env }),
    })

    const reader = res.body!.getReader()
    readerRef.current = reader
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (line.startsWith('data: ')) {
          try { setLines(prev => [...prev, JSON.parse(line.slice(6))]) } catch {}
        }
      }
    }

    setRunning(false)
    afterRun?.()
  }, [running, site.agentRoot])

  const reloadReport = useCallback(() => {
    fetch(`/api/audit-report?siteId=${encodeURIComponent(site.id)}`)
      .then(r => r.json()).then(d => { if (d) { setReport(d); setResolved(new Set()); setTab('report') } })
  }, [site.agentRoot])

  const runAudit = () => runCmd(`audit ${site.url}`, reloadReport)
  const runAllFixes = () => runCmd(`fix ${site.url} --yes`, reloadReport)

  const autoFixOne = useCallback(async (idx: number, issue: AuditIssue) => {
    if (running) return
    setFixingIdx(idx)
    await runCmd(`fix ${site.url} --yes --rule "${issue.rule}" --page "${issue.page}"`, () => {
      setFixingIdx(null)
      reloadReport()
    })
    setFixingIdx(null)
  }, [running, runCmd, reloadReport, site.url])

  const toggleResolved = (idx: number) => {
    setResolved(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const dot: Record<string, string> = { critical: 'bg-red-500', warning: 'bg-amber-400', recommendation: 'bg-blue-400' }
  const allIssues = report?.issues ?? []
  const displayScore = report ? calcScore(report.score, allIssues, resolved) : null
  const filtered = allIssues.filter((i, idx) => {
    if (filter !== 'all' && i.severity !== filter) return false
    return true
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">SEO Audit — {site.name}</h1>
          {report && (
            <p className="text-xs text-gray-400 mt-0.5">
              {report.pagesChecked} pages · {report.auditedAt.slice(0, 10)}
              {resolved.size > 0 && <span className="ml-1 text-green-600">· {resolved.size} resolved</span>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={runAudit} disabled={running}
            className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {running ? 'Running…' : 'Run audit'}
          </button>
          <button onClick={runAllFixes} disabled={running || !report}
            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            Apply all fixes
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-white border-b border-gray-100 px-8 flex gap-4 shrink-0">
        {(['report', 'run'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 text-xs font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t === 'run' ? 'Live output' : 'Report'}
          </button>
        ))}
      </div>

      {tab === 'run' && (
        <div className="flex-1 bg-gray-50 overflow-hidden">
          <LogViewer lines={lines} running={running} />
        </div>
      )}

      {tab === 'report' && (
        <div className="flex-1 overflow-auto px-8 py-6 relative">
          {!report ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-3">◎</p>
              <p className="text-sm">No audit report yet. Click "Run audit" to start.</p>
            </div>
          ) : (
            <>
              {/* Score card */}
              <div className="sticky top-0 z-10 bg-white border border-gray-100 rounded-xl px-6 py-4 mb-6 flex items-center gap-6 shadow-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-1">SEO Score</p>
                  <p className={`text-3xl font-semibold transition-colors ${displayScore! >= 80 ? 'text-green-600' : displayScore! >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                    {displayScore}<span className="text-lg text-gray-300">/100</span>
                  </p>
                  {resolved.size > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      was {report.score} · +{displayScore! - report.score} estimated
                    </p>
                  )}
                </div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${displayScore! >= 80 ? 'bg-green-400' : displayScore! >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${displayScore}%` }}
                  />
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex gap-4 text-xs text-gray-500">
                    {['critical', 'warning', 'recommendation'].map(s => {
                      const total = allIssues.filter(i => i.severity === s).length
                      const done  = allIssues.filter((i, idx) => i.severity === s && resolved.has(idx)).length
                      return (
                        <span key={s}>
                          {done > 0 ? <span className="text-green-600">{total - done}</span> : total - done}
                          /{total} {s === 'recommendation' ? 'recs' : s + 's'}
                        </span>
                      )
                    })}
                  </div>
                  {resolved.size > 0 && (
                    <button
                      onClick={() => runCmd(`audit ${site.url}`, reloadReport)}
                      disabled={running}
                      className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {running ? 'Auditing…' : `Re-audit to confirm (${resolved.size})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex gap-2 mb-4">
                {['all', 'critical', 'warning', 'recommendation'].map(f => {
                  const count = f === 'all' ? allIssues.length : allIssues.filter(i => i.severity === f).length
                  return (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors capitalize ${filter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                      {f === 'all' ? `All (${count})` : `${f} (${count})`}
                    </button>
                  )
                })}
              </div>

              {/* Issue list */}
              <div className="space-y-2">
                {filtered.map((issue, filteredIdx) => {
                  const globalIdx = allIssues.indexOf(issue)
                  const isResolved = resolved.has(globalIdx)
                  const isFixing = fixingIdx === globalIdx

                  return (
                    <div key={globalIdx}
                      className={`bg-white border rounded-xl px-5 py-4 transition-opacity ${isResolved ? 'opacity-50 border-green-100' : 'border-gray-100'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${isResolved ? 'bg-green-400' : dot[issue.severity]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium ${isResolved ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {issue.rule}
                            </p>
                            {issue.autoFixable && !isResolved && (
                              <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full">auto-fixable</span>
                            )}
                            {isResolved && (
                              <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full">✓ resolved</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{issue.page}</p>
                          <p className={`text-xs mt-1 ${isResolved ? 'text-gray-300' : 'text-gray-600'}`}>{issue.detail}</p>
                          <p className={`text-xs mt-1 ${isResolved ? 'text-gray-300' : 'text-gray-400'}`}>→ {issue.fix}</p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {issue.autoFixable && !isResolved && (
                            <button
                              onClick={() => autoFixOne(globalIdx, issue)}
                              disabled={running || isFixing}
                              className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {isFixing ? 'Fixing…' : 'Auto-fix'}
                            </button>
                          )}
                          <button
                            onClick={() => toggleResolved(globalIdx)}
                            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors whitespace-nowrap ${
                              isResolved
                                ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                                : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                            }`}
                          >
                            {isResolved ? '✓ Done' : 'Mark resolved'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
