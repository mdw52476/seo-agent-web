'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import type { AppCtx } from '../AppContext'
import type { PublishedEntry } from '../types'
import LogViewer from './LogViewer'

interface LogLine { text: string; stream: string }

const COUNTS = [1, 2, 3]

export default function Articles({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [articles, setArticles] = useState<PublishedEntry[]>([])
  const [running, setRunning] = useState(false)
  const [count, setCount] = useState(1)
  const [lines, setLines] = useState<LogLine[]>([])
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  useEffect(() => {
    setArticles([])
    fetch(`/api/published?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(d => setArticles(d ?? []))
  }, [site.id, site.agentRoot])

  const publish = useCallback(async () => {
    if (running) return
    readerRef.current?.cancel()
    setRunning(true)
    setLines([])

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: `publish ${site.url} --count ${count}`, agentRoot: site.agentRoot, siteId: site.id, siteUrl: site.url, siteType: site.siteType, siteEnv: site.env }),
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
    // Refresh list after publishing
    fetch(`/api/published?siteId=${encodeURIComponent(site.id)}`).then(r => r.json()).then(d => setArticles(d ?? []))
  }, [running, count, site.agentRoot, site.url])

  const sorted = [...articles].reverse()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Articles — {site.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{articles.length} published</p>
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
          <span className="text-xs text-gray-400">{count === 1 ? 'article' : 'articles'}</span>
          <button
            onClick={publish}
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
        </div>
      </div>

      {/* Log output while running */}
      {(lines.length > 0 || running) && (
        <div className="h-48 shrink-0 border-b border-gray-100 bg-gray-50 overflow-hidden">
          <LogViewer lines={lines} running={running} />
        </div>
      )}

      {/* Article list */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {sorted.length === 0 && !running ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">≡</p>
            <p className="text-sm">No articles yet. Click Publish to write your first one.</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {sorted.map(a => (
              <div key={a.slug} className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-snug">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{a.publishedAt.slice(0, 10)} · {a.keyword}</p>
                  <p className="text-xs text-gray-300 mt-0.5 font-mono truncate">/blog/{a.slug}</p>
                </div>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-blue-500 hover:underline mt-0.5">View →</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
