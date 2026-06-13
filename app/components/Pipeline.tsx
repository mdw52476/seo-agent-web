'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import LogViewer from './LogViewer'
import type { AppCtx } from '../AppContext'

interface LogLine { text: string; stream: string }

type StageId = 'analyze' | 'research' | 'plan' | 'publish' | 'pubdir' | 'audit' | 'fix'

interface Stage {
  id: StageId
  label: string
  desc: string
  cmd: (url: string, count?: number) => string
  countable?: boolean
}

const STAGES: Stage[] = [
  { id: 'analyze',  label: 'Analyze site',       desc: 'Crawl and profile the site',              cmd: (url) => `analyze ${url}` },
  { id: 'research', label: 'Research keywords',   desc: 'Generate and score keyword list',          cmd: (url) => `research ${url}` },
  { id: 'plan',     label: 'Plan content',        desc: 'Build a 4-week content calendar',          cmd: (url) => `plan ${url}` },
  { id: 'publish',  label: 'Publish articles',    desc: 'Write + publish articles to blog',         cmd: (url, n = 1) => `publish ${url} --count ${n}`,     countable: true },
  { id: 'pubdir',   label: 'Publish directories', desc: 'Write + publish niche directory articles',  cmd: (url, n = 1) => `publish-dir ${url} --count ${n}`, countable: true },
  { id: 'audit',    label: 'Audit site',          desc: 'Crawl and score all pages',                cmd: (url) => `audit ${url}` },
  { id: 'fix',      label: 'Apply fixes',         desc: 'Auto-fix issues from last audit',          cmd: (url) => `fix ${url} --yes` },
]

function CountPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <div
      className="flex items-center gap-0.5 bg-gray-100 rounded-md px-1 py-0.5"
      onClick={e => e.stopPropagation()}
    >
      {[1, 2, 3].map(n => (
        <button
          key={n}
          onClick={e => { e.stopPropagation(); onChange(n) }}
          disabled={disabled}
          className={`w-5 h-5 text-xs rounded font-medium transition-colors ${value === n ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function Pipeline({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [running, setRunning] = useState(false)
  const [activeStage, setActiveStage] = useState<StageId | null>(null)
  const [lines, setLines] = useState<LogLine[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({ publish: 1, pubdir: 1 })
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  useEffect(() => () => { readerRef.current?.cancel() }, [])

  // Auto-run analyze when a new site is just added
  useEffect(() => {
    if (ctx.justAdded) {
      ctx.clearJustAdded()
      const analyzeStage = STAGES.find(s => s.id === 'analyze')!
      run(analyzeStage)
    }
  }, [ctx.justAdded])

  const run = useCallback(async (stage: Stage) => {
    if (running) return
    readerRef.current?.cancel()
    setActiveStage(stage.id)
    setRunning(true)
    setLines([])

    const cmd = stage.cmd(site.url, counts[stage.id])

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, agentRoot: site.agentRoot }),
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
  }, [running, site.agentRoot, site.url, counts])

  const activeCmd = activeStage
    ? STAGES.find(s => s.id === activeStage)?.cmd(site.url, counts[activeStage] ?? 1)
    : null

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-white border-r border-gray-100 overflow-y-auto">
        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="text-sm font-semibold text-gray-900">Pipeline</h1>
          <p className="text-xs text-gray-400 mt-0.5">{site.name}</p>
        </div>
        <div className="py-3">
          {STAGES.map(stage => (
            <div
              key={stage.id}
              onClick={() => !running && run(stage)}
              className={`px-5 py-3 transition-colors border-l-2 select-none ${
                activeStage === stage.id ? 'bg-gray-50 border-gray-900' : 'border-transparent hover:bg-gray-50'
              } ${running && activeStage !== stage.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">{stage.label}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {stage.countable && (
                    <CountPicker
                      value={counts[stage.id] ?? 1}
                      onChange={n => setCounts(c => ({ ...c, [stage.id]: n }))}
                      disabled={running}
                    />
                  )}
                  {activeStage === stage.id && running && (
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{stage.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Output panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <p className="text-sm font-medium text-gray-700">
              {activeStage ? STAGES.find(s => s.id === activeStage)?.label : 'Select a stage to run'}
            </p>
            {activeCmd && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                npx tsx src/index.ts {activeCmd}
              </p>
            )}
          </div>
          {running && (
            <button onClick={() => { readerRef.current?.cancel(); setRunning(false) }}
              className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
              Stop
            </button>
          )}
        </div>
        <div className="flex-1 bg-gray-50 overflow-hidden">
          <LogViewer lines={lines} running={running} />
        </div>
      </div>
    </div>
  )
}
