import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId') ?? ''
  const stage = req.nextUrl.searchParams.get('stage') ?? ''
  if (!siteId || !stage) return NextResponse.json(null)

  const { data, error } = await supabase
    .from('run_logs')
    .select('lines, ran_at')
    .eq('site_id', siteId)
    .eq('stage', stage)
    .single()

  if (error || !data) return NextResponse.json(null)

  return NextResponse.json({ lines: data.lines, ranAt: data.ran_at })
}
