import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId') ?? ''
  const stage = req.nextUrl.searchParams.get('stage') ?? ''
  if (!siteId) return NextResponse.json(null)

  // No stage given — return a lightweight summary of every stage's last run for this site
  if (!stage) {
    const { data, error } = await supabase
      .from('run_logs')
      .select('stage, ran_at')
      .eq('site_id', siteId)
      .order('ran_at', { ascending: false })

    if (error) return NextResponse.json([])
    return NextResponse.json(data.map(r => ({ stage: r.stage, ranAt: r.ran_at })))
  }

  const { data, error } = await supabase
    .from('run_logs')
    .select('lines, ran_at')
    .eq('site_id', siteId)
    .eq('stage', stage)
    .single()

  if (error || !data) return NextResponse.json(null)

  return NextResponse.json({ lines: data.lines, ranAt: data.ran_at })
}
