import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

const RANGES: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1yr': 365 }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId') ?? ''
  const range  = req.nextUrl.searchParams.get('range') ?? '30d'
  if (!siteId) return NextResponse.json(null)

  const days = RANGES[range] ?? 30
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [auditRes, articleRes] = await Promise.all([
    supabase
      .from('audit_reports')
      .select('score, pages_checked, audited_at')
      .eq('site_id', siteId)
      .gte('audited_at', since)
      .order('audited_at'),
    supabase
      .from('articles')
      .select('article_type, published_at')
      .eq('site_id', siteId)
      .gte('published_at', since)
      .order('published_at'),
  ])

  return NextResponse.json({
    audits:   auditRes.data  ?? [],
    articles: articleRes.data ?? [],
  })
}
