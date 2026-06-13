'use client'
import { useEffect, useRef, useState } from 'react'
import type { AppCtx } from '../AppContext'

type Range = '7d' | '30d' | '90d' | '1yr'

interface AuditPoint { score: number; audited_at: string }
interface ArticleRow  { article_type: string; published_at: string }

interface AnalyticsData {
  audits:   AuditPoint[]
  articles: ArticleRow[]
}

const RANGES: { id: Range; label: string }[] = [
  { id: '7d',  label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '1yr', label: '1 year' },
]

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ScoreChart({ audits }: { audits: AuditPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    let Chart: any
    import('chart.js/auto').then(mod => {
      Chart = mod.default
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      if (!canvasRef.current) return

      const labels = audits.map(a => fmt(a.audited_at))
      const data   = audits.map(a => a.score)

      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'SEO Score',
            data,
            borderColor: '#111827',
            backgroundColor: 'rgba(17,24,39,0.06)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => ` Score: ${ctx.parsed.y}`,
              },
            },
          },
          scales: {
            y: {
              min: 0, max: 100,
              ticks: { stepSize: 20, color: '#9ca3af', font: { size: 11 } },
              grid: { color: '#f3f4f6' },
            },
            x: {
              ticks: { color: '#9ca3af', font: { size: 11 }, maxTicksLimit: 10 },
              grid: { display: false },
            },
          },
        },
      })
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [audits])

  if (audits.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">
        No audit data yet — run an audit to start tracking score over time.
      </div>
    )
  }

  return <div className="h-64 relative"><canvas ref={canvasRef} /></div>
}

export default function Analytics({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [range, setRange] = useState<Range>('30d')
  const [data, setData]   = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics?siteId=${site.id}&range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [site.id, range])

  const latestScore   = data?.audits.at(-1)?.score ?? null
  const firstScore    = data?.audits.at(0)?.score  ?? null
  const scoreDelta    = latestScore != null && firstScore != null ? latestScore - firstScore : null
  const totalArticles = data?.articles.filter(a => a.article_type === 'article').length ?? 0
  const totalDirs     = data?.articles.filter(a => a.article_type === 'directory').length ?? 0
  const auditCount    = data?.audits.length ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Analytics — {site.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">SEO score and content over time</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${range === r.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Current Score" value={latestScore != null ? `${latestScore}` : '—'}
            sub={scoreDelta != null ? `${scoreDelta >= 0 ? '+' : ''}${scoreDelta} over period` : 'No data'} />
          <StatCard label="Audits Run" value={`${auditCount}`} sub={`in last ${range}`} />
          <StatCard label="Articles Published" value={`${totalArticles}`} sub={`in last ${range}`} />
          <StatCard label="Directories Published" value={`${totalDirs}`} sub={`in last ${range}`} />
        </div>

        {/* Score chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">SEO Score Over Time</h2>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : (
            <ScoreChart audits={data?.audits ?? []} />
          )}
        </div>

        {/* Audit history table */}
        {(data?.audits.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Audit History</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {[...(data?.audits ?? [])].reverse().map((a, i, arr) => {
                  const prev  = arr[i + 1]?.score
                  const delta = prev != null ? a.score - prev : null
                  return (
                    <tr key={a.audited_at} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-600">{fmt(a.audited_at)}</td>
                      <td className="py-2 font-semibold text-gray-900">{a.score}</td>
                      <td className="py-2">
                        {delta != null ? (
                          <span className={delta >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {delta >= 0 ? '+' : ''}{delta}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
