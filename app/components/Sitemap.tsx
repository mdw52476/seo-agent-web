'use client'
import { useCallback, useEffect, useState } from 'react'
import type { AppCtx } from '../AppContext'

export default function Sitemap({ ctx }: { ctx: AppCtx }) {
  const site = ctx.activeSite!
  const [urls, setUrls] = useState<string[]>([])
  const [found, setFound] = useState(true)
  const [loading, setLoading] = useState(true)

  const fetchSitemap = useCallback(() => {
    setLoading(true)
    fetch(`/api/sitemap?siteUrl=${encodeURIComponent(site.url)}`)
      .then(r => r.json())
      .then((d: { urls: string[]; found: boolean } | null) => {
        setUrls(d?.urls ?? [])
        setFound(d?.found ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [site.url])

  useEffect(() => { fetchSitemap() }, [fetchSitemap])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Sitemap — {site.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? 'Loading…' : found ? `${urls.length} page${urls.length === 1 ? '' : 's'} in sitemap.xml` : 'No sitemap found yet'}
          </p>
        </div>
        <button
          onClick={fetchSitemap}
          disabled={loading}
          className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:border-gray-400 disabled:opacity-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
        ) : !found ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">◈</p>
            <p className="text-sm font-medium text-gray-600 mb-1">No sitemap found</p>
            <p className="text-xs max-w-sm mx-auto">
              Sitemaps are created automatically the first time an article or directory is published. Publish something from the Articles or Directories tab, then check back here.
            </p>
          </div>
        ) : urls.length === 0 ? (
          <p className="text-sm text-gray-400">sitemap.xml exists but has no URLs yet.</p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 max-w-3xl">
            {urls.map(url => (
              <div key={url} className="flex items-center justify-between px-4 py-2.5 gap-4">
                <span className="text-sm text-gray-700 font-mono truncate">{url}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline shrink-0">View →</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
