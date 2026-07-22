'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import type { AppCtx } from '../AppContext'

function RefreshLayoutButton({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [log, setLog] = useState('')

  const run = async () => {
    setStatus('running')
    setLog('')
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'fingerprint',
          agentRoot: site.agentRoot,
          siteId: site.id,
          siteUrl: site.url,
          siteType: site.siteType,
          siteEnv: site.env,
        }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        // SSE lines: "data: ...\n\n"
        text.split('\n').forEach(line => {
          if (line.startsWith('data: ')) setLog(l => l + line.slice(6) + '\n')
        })
      }
      setStatus('done')
      // Reload layout content
      setTimeout(() => window.location.reload(), 800)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={status === 'running'}
        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'running' ? 'Analyzing…' : status === 'done' ? '✓ Updated' : 'Refresh Site Layout'}
      </button>
      {log && (
        <pre className="mt-3 text-xs font-mono text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap">
          {log}
        </pre>
      )}
    </div>
  )
}

interface SkillFile {
  name: 'voice-guide.md' | 'SKILL.md'
  label: string
  description: string
  placeholder: string
}

const FILES: SkillFile[] = [
  {
    name: 'voice-guide.md',
    label: 'Voice Guide',
    description: "Describes the author's writing style — tone, sentence structure, vocabulary, things to avoid. Claude reads this before drafting every article.",
    placeholder: "Describe the author's voice here. For example:\n- Conversational but authoritative\n- Short sentences, no filler words\n- Never use passive voice\n- Avoid words like 'delve', 'leverage', 'seamless'",
  },
  {
    name: 'SKILL.md',
    label: 'AI-Tells Rules',
    description: 'A catalogue of AI writing patterns to scrub — hollow openers, filler phrases, overused adjectives. Applied in the reflection pass after drafting. A strong built-in default is used automatically if you leave this blank — fill this in only if you want to override it for this site.',
    placeholder: "List AI writing patterns to eliminate. For example:\n- Never start with 'In today's...'\n- Remove 'it's worth noting that'\n- No 'not only... but also' constructions\n- Ban: crucial, vital, pivotal, game-changer",
  },
]

export default function Skills({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [contents, setContents] = useState<Record<string, string>>({ 'voice-guide.md': '', 'SKILL.md': '' })
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [dragging, setDragging] = useState<Record<string, boolean>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [layoutMd, setLayoutMd] = useState('')

  useEffect(() => {
    fetch(`/api/skills?agentRoot=${encodeURIComponent(site.agentRoot)}`)
      .then(r => r.json())
      .then(data => {
        setContents(data)
        setLayoutMd(data['site-layout.md'] ?? '')
      })
  }, [site.id, site.agentRoot])

  const save = async (filename: string) => {
    setSaving(s => ({ ...s, [filename]: true }))
    await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentRoot: site.agentRoot, filename, content: contents[filename] }),
    })
    setSaving(s => ({ ...s, [filename]: false }))
    setSaved(s => ({ ...s, [filename]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [filename]: false })), 2000)
  }

  const readFile = useCallback((filename: string, file: File) => {
    const reader = new FileReader()
    reader.onload = ev => setContents(c => ({ ...c, [filename]: ev.target?.result as string }))
    reader.readAsText(file)
  }, [])

  const handleUpload = (filename: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    readFile(filename, file)
    e.target.value = ''
  }

  const handleDragOver = (filename: string, e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragging(d => ({ ...d, [filename]: true }))
  }

  const handleDragLeave = (filename: string, e: React.DragEvent) => {
    e.preventDefault()
    setDragging(d => ({ ...d, [filename]: false }))
  }

  const handleDrop = (filename: string, e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragging(d => ({ ...d, [filename]: false }))
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(filename, file)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">Writing Skills — {site.name}</h1>
        <p className="text-xs text-gray-400 mt-0.5">Claude reads these files before writing every article.</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-10 max-w-3xl">

          {/* Site Layout Profile — agent-generated, read-only */}
          <section>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Site Layout Profile</h2>
                <p className="text-xs text-gray-400 mt-0.5 max-w-md">
                  Auto-generated by the agent during site analysis. Describes title patterns, content structure,
                  schema types, and URL conventions. Claude reads this before every article to match your site&apos;s design.
                  Re-run whenever you redesign the site.
                </p>
              </div>
              <div className="shrink-0 ml-4">
                <RefreshLayoutButton ctx={ctx} />
              </div>
            </div>
            <textarea
              value={layoutMd}
              readOnly
              rows={14}
              placeholder="Not yet generated. Run 'Analyze' or click 'Refresh Site Layout' to create this file."
              className="w-full px-4 py-3 text-sm font-mono rounded-xl border border-gray-200 bg-gray-50 text-gray-600 placeholder:text-gray-300 resize-y leading-relaxed focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1.5 font-mono">{site.agentRoot}/site-layout.md</p>
          </section>

          <hr className="border-gray-100" />

          {FILES.map(f => (
            <section key={f.name}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{f.label}</h2>
                  <p className="text-xs text-gray-400 mt-0.5 max-w-md">{f.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <input
                    ref={el => { fileRefs.current[f.name] = el }}
                    type="file"
                    accept=".md,.txt"
                    className="hidden"
                    onChange={e => handleUpload(f.name, e)}
                  />
                  <button
                    onClick={() => fileRefs.current[f.name]?.click()}
                    className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:border-gray-400 transition-colors">
                    Upload .md
                  </button>
                  <button
                    onClick={() => save(f.name)}
                    disabled={saving[f.name]}
                    className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
                    {saved[f.name] ? '✓ Saved' : saving[f.name] ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="relative"
                onDragOver={e => handleDragOver(f.name, e)}
                onDragLeave={e => handleDragLeave(f.name, e)}
                onDrop={e => handleDrop(f.name, e)}
              >
                <textarea
                  value={contents[f.name]}
                  onChange={e => setContents(c => ({ ...c, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={12}
                  className={`w-full px-4 py-3 text-sm font-mono rounded-xl focus:outline-none resize-y bg-white leading-relaxed text-gray-800 placeholder:text-gray-300 transition-colors border ${dragging[f.name] ? 'border-blue-400 bg-blue-50' : 'border-gray-200 focus:border-gray-400'}`}
                />
                {dragging[f.name] && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none">
                    <p className="text-sm text-blue-500 font-medium bg-white/90 px-3 py-1.5 rounded-lg shadow-sm">Drop to load file</p>
                  </div>
                )}
                {contents[f.name] && (
                  <p className="absolute bottom-3 right-3 text-xs text-gray-300 pointer-events-none">
                    {contents[f.name].split('\n').length} lines
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-1.5 font-mono">
                {site.agentRoot}/{f.name}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
