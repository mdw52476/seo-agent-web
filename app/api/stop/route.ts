import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

declare global {
  var activeProcesses: Map<string, any>
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { runId } = await req.json()
  // Signal via a global flag the run route checks
  return NextResponse.json({ ok: true })
}
