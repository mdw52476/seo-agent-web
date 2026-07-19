import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId') ?? ''
  if (!siteId) return NextResponse.json([])

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', siteId)
    .eq('article_type', 'article')
    .order('published_at')

  if (error) return NextResponse.json([])

  return NextResponse.json(data.map(r => ({
    keyword:     r.keyword ?? '',
    slug:        r.slug,
    title:       r.title,
    publishedAt: r.published_at,
    url:         r.url ?? '',
  })))
}
