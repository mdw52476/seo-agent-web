import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  const siteUrl = req.nextUrl.searchParams.get('siteUrl') ?? ''
  if (!siteUrl) return NextResponse.json(null)

  try {
    const res = await fetch(`${siteUrl.replace(/\/$/, '')}/sitemap.xml`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return NextResponse.json({ urls: [], found: false })

    const xml = await res.text()
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim())
    return NextResponse.json({ urls, found: true })
  } catch {
    return NextResponse.json({ urls: [], found: false })
  }
}
