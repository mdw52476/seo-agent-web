import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId') ?? ''
  if (!siteId) return NextResponse.json(null)

  const { data } = await supabase
    .from('content_plans')
    .select('*')
    .eq('site_id', siteId)
    .order('cycle', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json(data ?? null)
}

export async function PATCH(req: NextRequest) {
  const { siteId, cycle, day, status } = await req.json()
  if (!siteId || !day || !status) return NextResponse.json({ ok: false })

  // Fetch current plan
  const { data } = await supabase
    .from('content_plans')
    .select('days')
    .eq('site_id', siteId)
    .eq('cycle', cycle)
    .single()

  if (!data) return NextResponse.json({ ok: false })

  const days = (data.days as any[]).map((d: any) =>
    d.day === day ? { ...d, status, publishedAt: status === 'published' ? new Date().toISOString() : d.publishedAt } : d
  )

  await supabase
    .from('content_plans')
    .update({ days })
    .eq('site_id', siteId)
    .eq('cycle', cycle)

  return NextResponse.json({ ok: true })
}
