'use client'
import { useEffect, useRef } from 'react'

interface LogLine { text: string; stream: string }

export default function LogViewer({ lines, running }: { lines: LogLine[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])

  return (
    <div ref={ref} className="h-full overflow-y-auto font-mono text-xs p-4 bg-gray-950">
      {lines.length === 0 && !running && (
        <p className="text-gray-500">Select a stage to run…</p>
      )}
      {lines.map((l, i) => (
        <span key={i} className={l.stream === 'stderr' ? 'text-red-400' : l.stream === 'system' ? 'text-gray-500' : 'text-green-300'}>
          {l.text}
        </span>
      ))}
      {running && <span className="text-gray-500 animate-pulse">▌</span>}
    </div>
  )
}
