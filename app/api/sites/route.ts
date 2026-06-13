import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawn } from 'child_process'
import { supabase } from '../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase.from('sites').select('*').order('created_at')
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data.map(dbToSite))
}

export async function POST(req: NextRequest) {
  const site = await req.json()

  if (!site.agentRoot) {
    site.agentRoot = path.join(os.homedir(), '.seo-agent', 'sites', site.id)
  }

  // Create agent directory — clone from GitHub if src/index.ts is missing
  const agentSrc    = path.join(os.homedir(), 'seo-agent')
  const agentIndex  = path.join(site.agentRoot, 'src', 'index.ts')
  if (!fs.existsSync(agentIndex)) {
    if (fs.existsSync(agentSrc)) {
      // Local dev: copy from sibling folder
      fs.mkdirSync(site.agentRoot, { recursive: true })
      fs.cpSync(agentSrc, site.agentRoot, {
        recursive: true,
        filter: (src) => !src.includes('node_modules') && !src.includes('.git'),
      })
    } else {
      // Production: clone from GitHub (repo must be public)
      if (fs.existsSync(site.agentRoot)) fs.rmSync(site.agentRoot, { recursive: true, force: true })
      fs.mkdirSync(path.dirname(site.agentRoot), { recursive: true })
      execSync(`git clone https://github.com/mdw52476/seo-agent.git "${site.agentRoot}"`, { stdio: 'pipe' })
    }
    try { execSync('npm install', { cwd: site.agentRoot, stdio: 'ignore' }) } catch {}
  }

  // Write .env for the local CLI
  const envLines = Object.entries(site.env ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const siteType = site.siteType ?? 'nextjs'
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
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
  const { error } = await supabase.from('sites').upsert(siteToDb(site))
  if (error) console.error('Supabase upsert error:', error)

  // Fire-and-forget: build site knowledge profile in the background
  const isNewSite = !fs.existsSync(path.join(site.agentRoot, 'site-profile.json'))
  if (isNewSite) {
    const child = spawn('npx', ['tsx', 'src/index.ts', 'analyze', site.url], {
      cwd: site.agentRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      shell: true,
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  }

  return NextResponse.json({ ok: true, agentRoot: site.agentRoot })
}

export async function DELETE(req: NextRequest) {
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
