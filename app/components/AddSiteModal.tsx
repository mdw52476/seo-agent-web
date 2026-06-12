'use client'
import { useState } from 'react'
import type { Site, SiteType } from '../types'

interface Props {
  onAdd: (site: Site) => void
  onClose: () => void
}

type Step = 'basic' | 'type' | 'keys' | 'paths'

const STEPS: { id: Step; label: string }[] = [
  { id: 'basic', label: 'Site details' },
  { id: 'type',  label: 'Site type' },
  { id: 'keys',  label: 'API keys' },
  { id: 'paths', label: 'Content paths' },
]

export default function AddSiteModal({ onAdd, onClose }: Props) {
  const [step, setStep] = useState<Step>('basic')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('https://')
  const [siteType, setSiteType] = useState<SiteType>('nextjs')
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState(false)
  const [env, setEnv] = useState({
    ANTHROPIC_API_KEY: '',
    GITHUB_TOKEN: '',
    GITHUB_REPO: '',
    GITHUB_BRANCH: 'main',
    GITHUB_CONTENT_PATH: '',
    GITHUB_DIRECTORY_PATH: '',
  })

  const stepIndex = STEPS.findIndex(s => s.id === step)

  const setEnvField = (key: keyof typeof env, value: string) =>
    setEnv(prev => ({ ...prev, [key]: value }))

  const detectPaths = async () => {
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return
    setDetecting(true)
    try {
      const res = await fetch('/api/detect-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || 'main' }),
      })
      const data = await res.json()
      setSiteType(data.siteType ?? siteType)
      setEnv(prev => ({
        ...prev,
        GITHUB_CONTENT_PATH: data.contentPath ?? prev.GITHUB_CONTENT_PATH,
        GITHUB_DIRECTORY_PATH: data.directoryPath ?? prev.GITHUB_DIRECTORY_PATH,
      }))
      setDetected(true)
    } catch {}
    setDetecting(false)
  }

  const goNext = async () => {
    if (step === 'basic') { setStep('type'); return }
    if (step === 'type')  { setStep('keys'); return }
    if (step === 'keys')  {
      // Auto-detect paths before showing the paths step
      await detectPaths()
      setStep('paths')
      return
    }
  }

  const handleCreate = () => {
    const id = crypto.randomUUID()
    const site: Site = {
      id,
      name: name.trim(),
      url: url.trim().replace(/\/$/, ''),
      agentRoot: '',
      siteType,
      env: {
        ...env,
        GITHUB_CONTENT_PATH: env.GITHUB_CONTENT_PATH || (siteType === 'nextjs' ? 'content/posts' : 'blog'),
        GITHUB_DIRECTORY_PATH: env.GITHUB_DIRECTORY_PATH || (siteType === 'nextjs' ? 'content/directories' : 'directories'),
      },
    }
    onAdd(site)
    onClose()
  }

  const envField = (key: keyof typeof env, label: string, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={env[key]}
        onChange={e => setEnvField(key, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 font-mono"
      />
    </div>
  )

  const canNext =
    step === 'basic' ? name.trim() && url.trim() && url !== 'https://' :
    step === 'type'  ? true :
    step === 'keys'  ? !!env.ANTHROPIC_API_KEY :
    true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Add new site</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {STEPS.map(({ id, label }, i) => (
              <div key={id} className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium shrink-0 ${
                  i < stepIndex ? 'bg-green-500 text-white' :
                  i === stepIndex ? 'bg-gray-900 text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${i === stepIndex ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
                {i < STEPS.length - 1 && <span className="text-gray-200 mx-1 text-xs">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {step === 'basic' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Site name</label>
                <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="My Site"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Site URL</label>
                <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
            </>
          )}

          {step === 'type' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">What technology powers your site?</p>
              {([
                { value: 'nextjs', title: 'Next.js / MDX', desc: 'Site uses Next.js or another JS framework — articles are committed as .mdx files with frontmatter' },
                { value: 'html',   title: 'Basic HTML',    desc: 'Site is plain HTML — articles are committed as standalone .html files' },
              ] as { value: SiteType; title: string; desc: string }[]).map(opt => (
                <button key={opt.value} onClick={() => setSiteType(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${siteType === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}>
                  <p className="text-sm font-medium text-gray-900">{opt.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          )}

          {step === 'keys' && (
            <>
              {envField('ANTHROPIC_API_KEY', 'Anthropic API Key', 'password', 'sk-ant-api03-…')}
              {envField('GITHUB_TOKEN', 'GitHub Token', 'password', 'ghp_…')}
              {envField('GITHUB_REPO', 'GitHub Repo', 'text', 'owner/repo')}
              {envField('GITHUB_BRANCH', 'Branch', 'text', 'main')}
            </>
          )}

          {step === 'paths' && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">
                  {detected ? '✓ Paths auto-detected from your repo.' : 'Set where articles are stored in your repo.'}
                </p>
                <button onClick={detectPaths} disabled={detecting || !env.GITHUB_TOKEN || !env.GITHUB_REPO}
                  className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-40 transition-colors">
                  {detecting ? 'Detecting…' : 'Re-detect'}
                </button>
              </div>
              {envField('GITHUB_CONTENT_PATH', 'Blog posts path', 'text', siteType === 'nextjs' ? 'content/posts' : 'blog')}
              {envField('GITHUB_DIRECTORY_PATH', 'Directories path', 'text', siteType === 'nextjs' ? 'content/directories' : 'directories')}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-between items-center">
          {stepIndex > 0 ? (
            <button onClick={() => setStep(STEPS[stepIndex - 1].id)} className="text-sm text-gray-400 hover:text-gray-700">
              ← Back
            </button>
          ) : (
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700">Cancel</button>
          )}

          {step === 'paths' ? (
            <button onClick={handleCreate}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors">
              Create site
            </button>
          ) : (
            <button onClick={goNext} disabled={!canNext}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors">
              {step === 'keys' && detecting ? 'Detecting paths…' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
