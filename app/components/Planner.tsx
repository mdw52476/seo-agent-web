'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import type { AppCtx } from '../AppContext'
import LogViewer from './LogViewer'

interface DayEntry {
  day: number
  type: 'article' | 'directory'
  keyword: string
  title: string
  articleType: string
  outline: string[]
  status: 'planned' | 'published' | 'skipped'
  publishedAt?: string
}

interface Plan {
  site_id: string
  cycle: number
  days: DayEntry[]
  created_at: string
}

interface LogLine { text: string; stream: string }

export default function Planner({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [plan, setPlan]           = useState<Plan | null>(null)
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genLines, setGenLines]   = useState<LogLine[]>([])
  const [publishingDay, setPublishingDay] = useState<number | null>(null)
  const [pubLines, setPubLines]   = useState<LogLine[]>([])
  const [expanded, setExpanded]   = useState<Set<number>>(new Set())
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  const fetchPlan = useCallback(() => {
    fetch(`/api/plan?siteId=${encodeURIComponent(site.id)}`)
      .then(r => r.json())
      .then(d => { setPlan(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [site.id])

  useEffect(() => {
    setLoading(true)
    setPlan(null)
    fetchPlan()
  }, [site.id])

  const runStream = async (
    cmd: string,
    onLine: (l: LogLine) => void,
    onDone: () => void
  ) => {
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
          try { onLine(JSON.parse(line.slice(6))) } catch {}
        }
      }
    }
    onDone()
  }

  const generatePlan = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    setGenLines([])
    const cycle = plan ? plan.cycle + 1 : 1
    await runStream(
      `day-guide ${site.url} --cycle ${cycle}`,
      l => setGenLines(prev => [...prev, l]),
      () => { setGenerating(false); fetchPlan() }
    )
  }, [generating, plan, site.url, site.agentRoot, fetchPlan])

  const publishDay = useCallback(async (day: DayEntry) => {
    if (publishingDay !== null) return
    setPublishingDay(day.day)
    setPubLines([])
    const cmd = day.type === 'directory'
      ? `publish-dir ${site.url} --count 1`
      : `publish ${site.url} --count 1`
    await runStream(
      cmd,
      l => setPubLines(prev => [...prev, l]),
      async () => {
        await fetch('/api/plan', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId: site.id, cycle: plan!.cycle, day: day.day, status: 'published' }),
        })
        setPublishingDay(null)
        fetchPlan()
      }
    )
  }, [publishingDay, site.url, site.agentRoot, site.id, plan, fetchPlan])

  const skipDay = useCallback(async (day: DayEntry) => {
    await fetch('/api/plan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: site.id, cycle: plan!.cycle, day: day.day, status: 'skipped' }),
    })
    fetchPlan()
  }, [site.id, plan, fetchPlan])

  const toggleExpand = (day: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  const days      = plan?.days ?? []
  const done      = days.filter(d => d.status === 'published').length
  const total     = days.length
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone   = total > 0 && done === total

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Content Planner — {site.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {plan ? `Cycle ${plan.cycle} · ${done}/${total} days complete` : '30-day publishing schedule'}
          </p>
        </div>
        <button
          onClick={generatePlan}
          disabled={generating}
          className="px-4 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating…' : plan ? `Start Cycle ${plan.cycle + 1}` : 'Generate 30-Day Plan'}
        </button>
      </div>

      {/* Generation log */}
      {(genLines.length > 0 || generating) && (
        <div className="h-48 shrink-0 border-b border-gray-100 bg-gray-50 overflow-hidden">
          <LogViewer lines={genLines} running={generating} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
        ) : !plan ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">▦</p>
            <p className="text-sm font-medium text-gray-600 mb-1">No plan yet</p>
            <p className="text-xs">Click "Generate 30-Day Plan" to build your content schedule.</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-4">
            {/* Progress bar */}
            <div className="bg-white border border-gray-100 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">{done}/{total} days complete</span>
                <span className="text-xs text-gray-400">{pct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              {allDone && (
                <p className="text-xs text-green-600 mt-2 font-medium">
                  Cycle {plan.cycle} complete! Click "Start Cycle {plan.cycle + 1}" to plan the next 30 days.
                </p>
              )}
            </div>

            {/* Day list */}
            {days.map(day => (
              <DayCard
                key={day.day}
                day={day}
                expanded={expanded.has(day.day)}
                publishing={publishingDay === day.day}
                pubLines={publishingDay === day.day ? pubLines : []}
                onToggle={() => toggleExpand(day.day)}
                onPublish={() => publishDay(day)}
                onSkip={() => skipDay(day)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DayCard({
  day, expanded, publishing, pubLines, onToggle, onPublish, onSkip,
}: {
  day: DayEntry
  expanded: boolean
  publishing: boolean
  pubLines: LogLine[]
  onToggle: () => void
  onPublish: () => void
  onSkip: () => void
}) {
  const isPublished = day.status === 'published'
  const isSkipped   = day.status === 'skipped'
  const typeBadge   = day.type === 'directory'
    ? 'bg-purple-50 text-purple-700'
    : 'bg-blue-50 text-blue-700'

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-opacity ${isSkipped ? 'opacity-40' : ''} ${isPublished ? 'border-green-100' : 'border-gray-100'}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: day info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex flex-col items-center justify-center">
              <span className="text-xs text-gray-400 leading-none">Day</span>
              <span className="text-sm font-bold text-gray-900 leading-none">{day.day}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
                  {day.type === 'directory' ? 'Directory' : 'Article'}
                </span>
                {isPublished && <span className="text-xs text-green-600 font-medium">✓ Published{day.publishedAt ? ` · ${day.publishedAt.slice(0, 10)}` : ''}</span>}
                {isSkipped && <span className="text-xs text-gray-400">Skipped</span>}
              </div>
              <p className={`text-sm font-medium text-gray-900 leading-snug ${isSkipped ? 'line-through' : ''}`}>{day.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">"{day.keyword}"</p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onToggle} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors">
              {expanded ? 'Hide outline' : 'Outline'}
            </button>
            {!isPublished && !isSkipped && (
              <>
                <button
                  onClick={onPublish}
                  disabled={publishing}
                  className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {publishing ? 'Publishing…' : 'Publish Now'}
                </button>
                <button
                  onClick={onSkip}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </div>

        {/* Outline */}
        {expanded && (
          <div className="mt-3 ml-13 pl-1 border-l-2 border-gray-100 ml-[52px]">
            {day.outline.map((section, i) => (
              <p key={i} className="text-xs text-gray-500 py-0.5">
                <span className="text-gray-300 mr-2">H2</span>{section}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Publish log strip */}
      {publishing && pubLines.length > 0 && (
        <div className="border-t border-gray-100 h-32 bg-gray-50 overflow-hidden">
          <LogViewer lines={pubLines} running={publishing} />
        </div>
      )}
    </div>
  )
}
