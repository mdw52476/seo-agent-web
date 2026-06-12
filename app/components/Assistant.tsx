'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { AppCtx } from '../AppContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { name: string; input: Record<string, string>; result?: string }[]
}

const TOOL_LABELS: Record<string, (input: Record<string, string>) => string> = {
  read_file:      i => `Reading ${i.path}`,
  list_directory: i => `Listing ${i.path || 'repo root'}`,
  write_file:     i => `Writing ${i.path}`,
  run_pipeline:   i => `Running: ${i.command}`,
}

export default function Assistant({ ctx }: { ctx: AppCtx }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const site = ctx.activeSite

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Reset when site changes
  useEffect(() => {
    setMessages([])
  }, [site?.id])

  const send = useCallback(async () => {
    if (!input.trim() || loading || !site) return
    const userText = input.trim()
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: userText }
    const assistantMsg: Message = { role: 'assistant', content: '', toolCalls: [] }

    setMessages(prev => [...prev, userMsg, assistantMsg])

    const apiMessages = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, site }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text') {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + event.text,
                }
                return updated
              })
            } else if (event.type === 'tool_call') {
              setMessages(prev => {
                const updated = [...prev]
                const last = { ...updated[updated.length - 1] }
                last.toolCalls = [...(last.toolCalls ?? []), { name: event.name, input: event.input }]
                updated[updated.length - 1] = last
                return updated
              })
            } else if (event.type === 'tool_result') {
              setMessages(prev => {
                const updated = [...prev]
                const last = { ...updated[updated.length - 1] }
                const calls = [...(last.toolCalls ?? [])]
                const idx = calls.findLastIndex(c => c.name === event.name && !c.result)
                if (idx >= 0) calls[idx] = { ...calls[idx], result: event.result }
                last.toolCalls = calls
                updated[updated.length - 1] = last
                return updated
              })
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }
        return updated
      })
    }

    setLoading(false)
  }, [input, loading, messages, site])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-lg transition-all ${open ? 'bg-gray-900 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
      >
        {open ? '×' : '✦'}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-96 h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Assistant</p>
              <p className="text-xs text-gray-400">{site?.name ?? 'No site selected'}</p>
            </div>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="text-xs text-gray-400 hover:text-gray-600">
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">✦</p>
                <p className="text-sm text-gray-500 mb-1">Ask me anything about your site</p>
                <p className="text-xs text-gray-400">I can read and edit files, run the pipeline, and make changes to your repo.</p>
                <div className="mt-4 space-y-1.5">
                  {[
                    'Add a directories link to the homepage',
                    'Publish a new directory article',
                    'What articles have been published?',
                  ].map(suggestion => (
                    <button key={suggestion} onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                      className="block w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-gray-900 text-white rounded-2xl rounded-tr-sm px-3 py-2' : ''}`}>
                  {/* Tool calls */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {msg.toolCalls.map((tc, j) => (
                        <div key={j} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${tc.result ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                          <span>{tc.result ? '✓' : '⟳'}</span>
                          <span>{TOOL_LABELS[tc.name]?.(tc.input) ?? tc.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text content */}
                  {msg.content && (
                    <div className={msg.role === 'user'
                      ? 'text-sm text-white'
                      : 'text-sm text-gray-800 bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2 whitespace-pre-wrap'
                    }>
                      {msg.content}
                      {msg.role === 'assistant' && loading && i === messages.length - 1 && !msg.content && (
                        <span className="inline-block w-1.5 h-3.5 bg-gray-400 rounded-sm animate-pulse ml-0.5" />
                      )}
                    </div>
                  )}

                  {/* Loading indicator when no content yet */}
                  {msg.role === 'assistant' && loading && i === messages.length - 1 && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0) && (
                    <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2">
                      <span className="inline-flex gap-1">
                        {[0,1,2].map(n => <span key={n} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask me to make a change…"
                rows={1}
                disabled={loading || !site}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-gray-400 disabled:opacity-50 max-h-28 overflow-y-auto"
                style={{ height: 'auto', minHeight: '38px' }}
                onInput={e => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 112) + 'px'
                }}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim() || !site}
                className="w-9 h-9 shrink-0 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-gray-700 disabled:opacity-40 transition-colors text-sm"
              >
                ↑
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-1.5 ml-1">Enter to send · Shift+Enter for newline</p>
          </div>
        </div>
      )}
    </>
  )
}
