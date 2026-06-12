'use client'
import { useState, useCallback, useRef } from 'react'
import LogViewer from './LogViewer'
import type { AppCtx } from '../AppContext'

interface LogLine { text: string; stream: string }

const COUNTS = [1, 2, 3]

export default function Directories({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [running, setRunning] = useState(false)
  const [count, setCount] = useState(1)
  const [lines, setLines] = useState<LogLine[]>([])
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  const publish = useCallback(async (cmd?: string) => {
    if (running) return
    readerRef.current?.cancel()
    setRunning(true)
    setLines([])

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: cmd ?? `publish-dir ${site.url} --count ${count}`, agentRoot: site.agentRoot }),
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
  }, [running, count, site.agentRoot, site.url])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">City Directories — {site.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Publish "Best [Service] in [City]" directory articles to <span className="font-mono">content/directories</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
            {COUNTS.map(n => (
              <button key={n} onClick={() => setCount(n)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${count === n ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{count === 1 ? 'directory' : 'directories'}</span>
          <button
            onClick={() => publish()}
            disabled={running}
            className="px-4 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {running ? 'Publishing…' : 'Publish'}
          </button>
          {running && (
            <button onClick={() => { readerRef.current?.cancel(); setRunning(false) }}
              className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
              Stop
            </button>
          )}
          <button
            onClick={() => publish('migrate-dirs')}
            disabled={running}
            title="Move city-directory articles from content/posts to content/directories"
            className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:border-gray-400 disabled:opacity-50 transition-colors">
            Migrate existing
          </button>
        </div>
      </div>

      {/* Explainer */}
      {lines.length === 0 && !running && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <p className="text-4xl mb-4">⊟</p>
          <p className="text-sm font-medium text-gray-700 mb-2">Local directory articles</p>
          <p className="text-xs text-gray-400 max-w-sm">
            Directories target city-specific searches like "best auto glass shops in Columbus, OH."
            They publish to a separate path (<span className="font-mono">content/directories</span>) so they can have their own page layout on your site.
          </p>
          <p className="text-xs text-gray-400 mt-3 max-w-sm">
            Select how many to publish, then click Publish.
          </p>
        </div>
      )}

      {/* Log output */}
      {(lines.length > 0 || running) && (
        <div className="flex-1 bg-gray-50 overflow-hidden">
          <LogViewer lines={lines} running={running} />
        </div>
      )}
    </div>
  )
}
