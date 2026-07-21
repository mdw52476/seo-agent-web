'use client'
import { useState, useEffect } from 'react'
import type { AppCtx } from '../AppContext'
import type { Site } from '../types'

export default function SiteSettings({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [draft, setDraft] = useState<Site>({ ...site, env: { ...site.env } })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setDraft({ ...site, env: { ...site.env } })
    setSaved(false); setSaveError(null); setConfirmDelete(false)
  }, [site.id])

  const setEnv = (key: string, value: string) => setDraft(d => ({ ...d, env: { ...d.env, [key]: value } }))

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    const result = await ctx.updateSite(draft)
    setSaving(false)
    if (result.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      setSaveError(result.error ?? 'Unknown error')
    }
  }

  const field = (key: string, label: string, type = 'text', placeholder = '', isEnv = false) => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type}
        value={isEnv ? (draft.env[key] ?? '') : (draft as any)[key] ?? ''}
        onChange={e => isEnv ? setEnv(key, e.target.value) : setDraft(d => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 font-mono" />
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Site Settings — {site.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{site.url}</p>
        </div>
        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-red-500">Save failed: {saveError}</span>}
          <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
          {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Remove this site?</span>
                <button onClick={() => ctx.deleteSite(site.id)} className="text-xs text-red-500 hover:underline">Yes, remove</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:underline">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove site</button>
            )}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-xl space-y-8">
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">General</h2>
            {field('name', 'Site name', 'text', 'My Site')}
            {field('url', 'Site URL', 'text', 'https://yoursite.com')}
            {field('agentRoot', 'Agent directory', 'text', 'C:\\Users\\you\\seo-agent')}
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Keys</h2>
            {field('ANTHROPIC_API_KEY', 'Anthropic API Key', 'password', 'sk-ant-…', true)}
            {field('GITHUB_TOKEN', 'GitHub Token', 'password', 'ghp_…', true)}
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GitHub</h2>
            {field('GITHUB_REPO', 'Repository', 'text', 'owner/repo', true)}
            {field('GITHUB_BRANCH', 'Branch', 'text', 'main', true)}
            {field('GITHUB_CONTENT_PATH', 'Content path', 'text', 'content/posts', true)}
          </section>
        </div>
      </div>
    </div>
  )
}
