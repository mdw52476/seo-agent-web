import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

// Store active processes by a run ID
const activeProcesses = new Map<string, ReturnType<typeof spawn>>()

export async function POST(req: NextRequest) {
  const { cmd, agentRoot, runId } = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string, type = 'stdout') => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, type })}\n\n`))
      }

      // Keep site folder's src/ in sync with the master seo-agent source
      const masterSrc = path.join(require('os').homedir(), 'seo-agent', 'src')
      const siteSrc   = path.join(agentRoot, 'src')
      try {
        require('fs').cpSync(masterSrc, siteSrc, { recursive: true, force: true })
      } catch { /* non-fatal — run with whatever is there */ }

      const child = spawn('npx', ['tsx', 'src/index.ts', ...cmd.split(' ')], {
        cwd: agentRoot,
        env: { ...process.env, FORCE_COLOR: '0' },
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
