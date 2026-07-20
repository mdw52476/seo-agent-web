'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import LogViewer from './LogViewer'
import type { AppCtx } from '../AppContext'

interface LogLine { text: string; stream: string }

type StageId = 'analyze' | 'research'

interface Stage {
  id: StageId
  label: string
  desc: string
  cmd: (url: string) => string
}

const STAGES: Stage[] = [
  { id: 'analyze',  label: 'Analyze site',     desc: 'Crawl and profile the site',      cmd: (url) => `analyze ${url}` },
  { id: 'research', label: 'Research keywords', desc: 'Generate and score keyword list', cmd: (url) => `research ${url}` },
]

export default function Pipeline({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [running, setRunning] = useState(false)
  const [activeStage, setActiveStage] = useState<StageId | null>(null)
  const [lines, setLines] = useState<LogLine[]>([])
  const [lastLogs, setLastLogs] = useState<Partial<Record<StageId, { lines: LogLine[]; ranAt: string | null }>>>({})
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const autoRunDone = useRef(false)
  useEffect(() => () => { readerRef.current?.cancel() }, [])

  const fetchLastLog = useCallback((stageId: StageId) => {
    fetch(`/api/run-log?siteId=${encodeURIComponent(site.id)}&stage=${stageId}`)
      .then(r => r.json())
      .then((data: { lines: LogLine[]; ranAt: string } | null) => {
        setLastLogs(prev => ({ ...prev, [stageId]: { lines: data?.lines ?? [], ranAt: data?.ranAt ?? null } }))
      })
      .catch(() => {})
  }, [site.id])

  useEffect(() => {
    STAGES.forEach(s => fetchLastLog(s.id))
  }, [fetchLastLog])

  // Auto-run analyze if site hasn't been analyzed yet and API key is present
  useEffect(() => {
    if (autoRunDone.current || !site.agentRoot) return
    fetch(`/api/setup-status?agentRoot=${encodeURIComponent(site.agentRoot)}`)
      .then(r => r.json())
      .then(({ analyzed, hasApiKey }: { analyzed: boolean; hasApiKey: boolean }) => {
        if (!analyzed && !autoRunDone.current) {
          if (hasApiKey) {
            autoRunDone.current = true
            run(STAGES.find(s => s.id === 'analyze')!)
          } else {
            setLines([{ text: 'Add your Anthropic API key in Settings, then click Analyze site.\n', stream: 'system' }])
          }
        }
      })
      .catch(() => {})
  }, [site.id])

  const run = useCallback(async (stage: Stage) => {
    if (running) return
    readerRef.current?.cancel()
    setActiveStage(stage.id)
    setRunning(true)
    setLines([])

    const cmd = stage.cmd(site.url)

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
    fetchLastLog(stage.id)
  }, [running, site.agentRoot, site.url, fetchLastLog])

  const viewLastLog = useCallback((stage: Stage) => {
    setActiveStage(stage.id)
    setLines(lastLogs[stage.id]?.lines ?? [])
  }, [lastLogs])

  // Auto-run analyze once when Pipeline mounts for a just-added site
  useEffect(() => {
    if (localStorage.getItem('seo_autoAnalyze') === '1' && !autoRunDone.current) {
      autoRunDone.current = true
      localStorage.removeItem('seo_autoAnalyze')
      run(STAGES.find(s => s.id === 'analyze')!)
    }
  }, [run])

  const activeStageObj = activeStage ? STAGES.find(s => s.id === activeStage) : null

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-white border-r border-gray-100 overflow-y-auto">
        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="text-sm font-semibold text-gray-900">Site Metrics</h1>
          <p className="text-xs text-gray-400 mt-0.5">{site.name}</p>
        </div>
        <div className="py-3">
          {STAGES.map(stage => (
            <div
              key={stage.id}
              onClick={() => { if (!running) viewLastLog(stage) }}
              className={`px-5 py-3 transition-colors border-l-2 select-none ${
                activeStage === stage.id ? 'bg-gray-50 border-gray-900' : 'border-transparent hover:bg-gray-50'
              } ${running && activeStage !== stage.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">{stage.label}</p>
                {activeStage === stage.id && running && (
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                )}
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
              {activeStageObj ? activeStageObj.label : 'Select a stage to view'}
            </p>
            {activeStageObj && !running && (
              <p className="text-xs text-gray-400 mt-0.5">
                {lastLogs[activeStageObj.id]?.ranAt ? `Last run: ${new Date(lastLogs[activeStageObj.id]!.ranAt!).toLocaleString()}` : 'Not yet run'}
              </p>
            )}
          </div>
          {running ? (
            <button onClick={() => { readerRef.current?.cancel(); setRunning(false) }}
              className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
              Stop
            </button>
          ) : activeStageObj && (
            <button onClick={() => run(activeStageObj)}
              className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
              Run {activeStageObj.label.toLowerCase()}
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
