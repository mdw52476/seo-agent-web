import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

// Common blog/content folder names to look for, in priority order
const BLOG_CANDIDATES = ['content/posts', 'content/blog', 'posts', 'blog', 'articles', '_posts', 'src/content/posts', 'src/posts', 'src/blog']
const DIR_CANDIDATES  = ['content/directories', 'content/dirs', 'directories', 'dirs']

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  return res.json()
}

async function listRepoTree(repo: string, branch: string, token: string): Promise<string[]> {
  const data = await ghFetch(`/repos/${repo}/git/trees/${branch}?recursive=1`, token)
  if (!data?.tree) return []
  return (data.tree as { path: string; type: string }[])
    .filter(item => item.type === 'tree' || item.path.endsWith('.html') || item.path.endsWith('.mdx') || item.path.endsWith('.md'))
    .map(item => item.path)
}

function detectPath(paths: string[], candidates: string[]): string | null {
  // Check exact candidate matches first
  for (const candidate of candidates) {
    if (paths.some(p => p === candidate || p.startsWith(candidate + '/'))) {
      return candidate
    }
  }
  // Fall back: find any folder containing .html or .mdx files
  const folderCounts: Record<string, number> = {}
  for (const p of paths) {
    if (p.endsWith('.html') || p.endsWith('.mdx') || p.endsWith('.md')) {
      const folder = p.includes('/') ? p.substring(0, p.lastIndexOf('/')) : '.'
      folderCounts[folder] = (folderCounts[folder] ?? 0) + 1
    }
  }
  const best = Object.entries(folderCounts).sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : null
}

function detectSiteType(paths: string[]): 'nextjs' | 'html' {
  const hasNext = paths.some(p =>
    p === 'next.config.js' || p === 'next.config.ts' || p === 'next.config.mjs' ||
    p.includes('app/') || p.includes('pages/')
  )
  return hasNext ? 'nextjs' : 'html'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, repo, branch = 'main' } = await req.json()
  if (!token || !repo) return NextResponse.json({ error: 'token and repo required' }, { status: 400 })

  try {
    const paths = await listRepoTree(repo, branch, token)
    if (paths.length === 0) {
      return NextResponse.json({ contentPath: 'blog', directoryPath: 'directories', siteType: 'html', detected: false })
    }

    const siteType = detectSiteType(paths)
    const defaultBlogCandidates = siteType === 'nextjs' ? BLOG_CANDIDATES : ['blog', 'posts', 'articles', ...BLOG_CANDIDATES]
    const defaultDirCandidates  = siteType === 'nextjs' ? DIR_CANDIDATES  : ['directories', 'dirs', ...DIR_CANDIDATES]

    const contentPath   = detectPath(paths, defaultBlogCandidates) ?? (siteType === 'nextjs' ? 'content/posts' : 'blog')
    const directoryPath = detectPath(paths, defaultDirCandidates)  ?? (siteType === 'nextjs' ? 'content/directories' : 'directories')

    return NextResponse.json({ contentPath, directoryPath, siteType, detected: true })
  } catch {
    return NextResponse.json({ contentPath: 'blog', directoryPath: 'directories', siteType: 'html', detected: false })
  }
}
