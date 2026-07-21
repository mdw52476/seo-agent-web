import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createClient } from '../../lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data, error } = await supabase.from('sites').select('*').order('created_at')
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data.map(dbToSite))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const site = await req.json()

  if (!site.agentRoot) {
    site.agentRoot = path.join(os.homedir(), '.seo-agent', 'sites', site.id)
  }

  // Write .env for the CLI (setup/clone happens on first run)
  const envLines = Object.entries(site.env ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const siteType     = site.siteType ?? 'nextjs'
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

  fs.mkdirSync(site.agentRoot, { recursive: true })
  fs.writeFileSync(
    path.join(site.agentRoot, '.env'),
    envLines +
    '\nSITE_URL=' + site.url +
    '\nSITE_TYPE=' + siteType +
    '\nSITE_ID=' + site.id +
    '\nSUPABASE_URL=' + supabaseUrl +
    '\nSUPABASE_ANON_KEY=' + supabaseKey + '\n'
  )

  // Upsert into Supabase
  const { error } = await supabase.from('sites').upsert({ ...siteToDb(site), user_id: user.id })
  if (error) {
    console.error('Supabase upsert error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, agentRoot: site.agentRoot })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { id } = await req.json()
  await supabase.from('sites').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}

// ── Shape helpers ─────────────────────────────────────────────────────────────

function siteToDb(site: any) {
  return {
    id:         site.id,
    name:       site.name,
    url:        site.url,
    site_type:  site.siteType ?? 'nextjs',
    agent_root: site.agentRoot ?? null,
    env:        site.env ?? {},
  }
}

function dbToSite(row: any) {
  return {
    id:        row.id,
    name:      row.name,
    url:       row.url,
    siteType:  row.site_type,
    agentRoot: row.agent_root ?? '',
    env:       row.env ?? {},
  }
}
