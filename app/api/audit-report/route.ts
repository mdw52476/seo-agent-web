import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId') ?? ''
  if (!siteId) return NextResponse.json(null)

  const { data, error } = await supabase
    .from('audit_reports')
    .select('*')
    .eq('site_id', siteId)
    .order('audited_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json(null)

  return NextResponse.json({
    siteUrl:       data.site_id,
    auditedAt:     data.audited_at,
    pagesChecked:  data.pages_checked,
    issues:        data.issues,
    score:         data.score,
  })
}
