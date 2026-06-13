import { NextRequest } from 'next/server'
import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

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
  const { cmd, agentRoot, runId } = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string, type = 'stdout') => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, type })}\n\n`))
      }

      const ready = ensureAgent(agentRoot, send)
      if (!ready) {
        send('\n[Setup failed — check your agent configuration]\n', 'system')
        controller.close()
        return
      }

      // Parse site-specific .env and merge into child env so vars are present
      // before any module initializes (ESM imports hoist before dotenv runs)
      const siteEnv: Record<string, string> = {}
      const siteEnvPath = path.join(agentRoot, '.env')
      if (fs.existsSync(siteEnvPath)) {
        for (const line of fs.readFileSync(siteEnvPath, 'utf-8').split('\n')) {
          const m = line.match(/^([^#=][^=]*)=(.*)$/)
          if (m) siteEnv[m[1].trim()] = m[2].trim()
        }
      }

      const child = spawn('npx', ['tsx', 'src/index.ts', ...cmd.split(' ')], {
        cwd: agentRoot,
        env: { ...process.env, ...siteEnv, FORCE_COLOR: '0' },
        shell: true,
      })

      if (runId) activeProcesses.set(runId, child)

      child.stdout.on('data', (d) => send(d.toString(), 'stdout'))
      child.stderr.on('data', (d) => send(d.toString(), 'stderr'))
      child.on('close', (code) => {
        send(`\n[Process exited with code ${code}]\n`, 'system')
        if (runId) activeProcesses.delete(runId)
        controller.close()
      })
      child.on('error', (err) => {
        send(`Error: ${err.message}\n`, 'stderr')
        controller.close()
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
