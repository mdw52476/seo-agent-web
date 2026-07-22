import { NextRequest } from 'next/server'
import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createClient } from '../../lib/supabase/server'

const activeProcesses = new Map<string, ReturnType<typeof spawn>>()

function ensureAgent(agentRoot: string, send: (text: string, type?: string) => void) {
  const agentIndex = path.join(agentRoot, 'src', 'index.ts')
  if (fs.existsSync(agentIndex)) {
    // Already set up — just pull latest
    const isGitRepo = fs.existsSync(path.join(agentRoot, '.git'))
    if (isGitRepo) {
      try { execSync('git pull --ff-only', { cwd: agentRoot, stdio: 'ignore' }) } catch {}
    } else {
      const masterSrc = path.join(os.homedir(), 'seo-agent', 'src')
      if (fs.existsSync(masterSrc)) {
        try { fs.cpSync(masterSrc, path.join(agentRoot, 'src'), { recursive: true, force: true }) } catch {}
      }
    }
    return true
  }

  // Need to set up from scratch
  const agentSrc = path.join(os.homedir(), 'seo-agent')
  if (fs.existsSync(agentSrc)) {
    send('Setting up agent (local copy)…\n', 'system')
    fs.mkdirSync(agentRoot, { recursive: true })
    fs.cpSync(agentSrc, agentRoot, {
      recursive: true,
      filter: (src) => !src.includes('node_modules') && !src.includes('.git'),
    })
  } else {
    send('Cloning agent from GitHub…\n', 'system')
    // Preserve .env written by the sites route before wiping the directory
    const envPath = path.join(agentRoot, '.env')
    const savedEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''
    if (fs.existsSync(agentRoot)) fs.rmSync(agentRoot, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(agentRoot), { recursive: true })
    try {
      execSync(`git clone https://github.com/mdw52476/seo-agent.git "${agentRoot}"`, { stdio: 'pipe' })
    } catch (err: any) {
      send(`Clone failed: ${err.message}\n`, 'stderr')
      return false
    }
    // Restore .env after clone (git doesn't track it)
    if (savedEnv) fs.writeFileSync(envPath, savedEnv)
  }

  send('Installing dependencies (this takes ~30s on first run)…\n', 'system')
  try {
    execSync('npm install', { cwd: agentRoot, stdio: 'ignore', timeout: 120000 })
    send('Setup complete.\n', 'system')
  } catch (err: any) {
    send(`npm install failed: ${err.message}\n`, 'stderr')
    return false
  }

  return true
}

export async function POST(req: NextRequest) {
  const { cmd, runId, siteId } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Look up the site server-side rather than trusting agentRoot/env from the
  // client body — RLS makes a non-owned siteId come back as "not found".
  const { data: site, error: siteError } = await supabase.from('sites').select('*').eq('id', siteId).single()
  if (siteError || !site) return new Response('Site not found', { status: 404 })

  const agentRoot = site.agent_root
  const siteUrl = site.url
  const siteType = site.site_type
  const requestEnv: Record<string, string> = site.env ?? {}

  const encoder = new TextEncoder()

  const stage = String(cmd ?? '').trim().split(' ')[0]
  const logLines: { text: string; stream: string }[] = []
  const saveLog = async () => {
    if (!siteId || !stage) return
    try {
      await supabase.from('run_logs').upsert(
        { site_id: siteId, stage, lines: logLines, ran_at: new Date().toISOString() },
        { onConflict: 'site_id,stage' }
      )
    } catch {}
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string, type = 'stdout') => {
        logLines.push({ text, stream: type })
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, type })}\n\n`))
      }

      const ready = ensureAgent(agentRoot, send)
      if (!ready) {
        send('\n[Setup failed — check your agent configuration]\n', 'system')
        saveLog().finally(() => controller.close())
        return
      }

      // Always rewrite .env from request data so it survives Railway redeploys
      // (ephemeral filesystem wipes ~/.seo-agent on every deploy)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
      const userEnvLines = Object.entries(requestEnv ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
      const envContent = [
        userEnvLines,
        siteUrl  ? `SITE_URL=${siteUrl}`   : '',
        siteType ? `SITE_TYPE=${siteType}` : '',
        siteId   ? `SITE_ID=${siteId}`     : '',
        supabaseUrl ? `SUPABASE_URL=${supabaseUrl}` : '',
        supabaseKey ? `SUPABASE_ANON_KEY=${supabaseKey}` : '',
        supabaseServiceKey ? `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}` : '',
      ].filter(Boolean).join('\n') + '\n'
      fs.writeFileSync(path.join(agentRoot, '.env'), envContent)

      // Build child env — merge parsed .env so vars exist before ESM module init
      const siteEnvVars: Record<string, string> = {}
      for (const line of envContent.split('\n')) {
        const m = line.match(/^([^#=][^=]*)=(.*)$/)
        if (m) siteEnvVars[m[1].trim()] = m[2].trim()
      }

      const child = spawn('npx', ['tsx', 'src/index.ts', ...cmd.split(' ')], {
        cwd: agentRoot,
        env: { ...process.env, ...siteEnvVars, FORCE_COLOR: '0' },
        shell: true,
      })

      if (runId) activeProcesses.set(runId, child)

      child.stdout.on('data', (d) => send(d.toString(), 'stdout'))
      child.stderr.on('data', (d) => send(d.toString(), 'stderr'))
      child.on('close', (code) => {
        send(`\n[Process exited with code ${code}]\n`, 'system')
        if (runId) activeProcesses.delete(runId)
        saveLog().finally(() => controller.close())
      })
      child.on('error', (err) => {
        send(`Error: ${err.message}\n`, 'stderr')
        saveLog().finally(() => controller.close())
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
