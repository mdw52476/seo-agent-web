import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parse as parseEnv } from 'dotenv'
import { spawn } from 'child_process'

const MASTER_AGENT = path.join(os.homedir(), 'seo-agent')

function getSiteEnv(agentRoot: string): Record<string, string> {
  const envPath = path.join(agentRoot, '.env')
  if (!fs.existsSync(envPath)) return {}
  return parseEnv(fs.readFileSync(envPath, 'utf-8'))
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

async function ghFetch(apiPath: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  return res
}

async function ghReadFile(token: string, repo: string, branch: string, filePath: string): Promise<string> {
  const res = await ghFetch(`/repos/${repo}/contents/${filePath}?ref=${branch}`, token)
  if (res.status === 404) return `File not found: ${filePath}`
  if (!res.ok) return `Error reading ${filePath}: ${res.status}`
  const data = await res.json() as { content: string; encoding: string }
  return Buffer.from(data.content, 'base64').toString('utf-8')
}

async function ghListDir(token: string, repo: string, branch: string, dirPath: string): Promise<string> {
  const res = await ghFetch(`/repos/${repo}/contents/${dirPath || ''}?ref=${branch}`, token)
  if (res.status === 404) return `Directory not found: ${dirPath}`
  if (!res.ok) return `Error listing ${dirPath}: ${res.status}`
  const data = await res.json() as { name: string; type: string; path: string }[]
  if (!Array.isArray(data)) return `Not a directory: ${dirPath}`
  return data.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`).join('\n')
}

async function ghWriteFile(token: string, repo: string, branch: string, filePath: string, content: string, message: string): Promise<string> {
  // Get existing SHA if file exists
  const existing = await ghFetch(`/repos/${repo}/contents/${filePath}?ref=${branch}`, token)
  const existingSha = existing.ok ? (await existing.json() as { sha: string }).sha : undefined

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  }
  if (existingSha) body.sha = existingSha

  const res = await ghFetch(`/repos/${repo}/contents/${filePath}`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    return `Error writing ${filePath}: ${res.status} — ${err}`
  }
  return `✓ Committed ${filePath}: "${message}"`
}

// ── Pipeline runner ───────────────────────────────────────────────────────────

async function runPipeline(agentRoot: string, command: string): Promise<string> {
  return new Promise((resolve) => {
    // Sync src from master before running
    try {
      fs.cpSync(path.join(MASTER_AGENT, 'src'), path.join(agentRoot, 'src'), { recursive: true, force: true } as any)
    } catch { /* non-fatal */ }

    const child = spawn('npx', ['tsx', 'src/index.ts', ...command.split(' ')], {
      cwd: agentRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      shell: true,
    })

    const lines: string[] = []
    child.stdout.on('data', d => lines.push(d.toString()))
    child.stderr.on('data', d => lines.push(d.toString()))
    child.on('close', code => resolve(lines.join('').trim() + `\n[exited ${code}]`))
    child.on('error', err => resolve(`Error: ${err.message}`))

    // Timeout after 3 minutes
    setTimeout(() => { child.kill(); resolve(lines.join('').trim() + '\n[timed out]') }, 180_000)
  })
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read a file from the site\'s GitHub repository.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'File path relative to repo root, e.g. src/app/page.tsx' } },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory of the site\'s GitHub repository.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Directory path, or empty string for repo root' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write or update a file in the site\'s GitHub repository and commit it. Vercel will auto-deploy after the commit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:           { type: 'string', description: 'File path relative to repo root' },
        content:        { type: 'string', description: 'Full file content to write' },
        commit_message: { type: 'string', description: 'Git commit message' },
      },
      required: ['path', 'content', 'commit_message'],
    },
  },
  {
    name: 'run_pipeline',
    description: 'Run an SEO agent pipeline command. Use for publishing articles, running audits, or keyword research. Do NOT use for file changes — use write_file instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Pipeline command, e.g. "publish https://example.com --count 1" or "audit https://example.com"' },
      },
      required: ['command'],
    },
  },
]

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(site: { name: string; url: string; siteType?: string; env?: Record<string, string> }) {
  return `You are a helpful AI assistant for an SEO content management tool. You help the user manage their website and content pipeline.

Current site:
- Name: ${site.name}
- URL: ${site.url}
- Type: ${site.siteType ?? 'nextjs'}
- GitHub repo: ${site.env?.GITHUB_REPO ?? 'unknown'}
- Branch: ${site.env?.GITHUB_BRANCH ?? 'main'}
- Blog posts path: ${site.env?.GITHUB_CONTENT_PATH ?? 'content/posts'}
- Directories path: ${site.env?.GITHUB_DIRECTORY_PATH ?? 'content/directories'}

You have tools to read and write files in the GitHub repo, and to run pipeline commands.

Guidelines:
- Before editing a file, always read it first so you have the current content.
- When making code changes, make minimal targeted edits — don't rewrite the whole file unless necessary.
- After writing a file, tell the user what you changed and that Vercel will auto-deploy.
- For pipeline tasks (publishing articles, auditing), use run_pipeline.
- Be concise. Don't over-explain unless asked.`
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages, site } = await req.json()

  // Prefer env vars from the request (survives Railway redeploys), fall back to filesystem
  const requestEnv: Record<string, string> = site.env ?? {}
  const fsEnv = getSiteEnv(site.agentRoot)
  const mergedEnv = { ...fsEnv, ...requestEnv }

  const anthropicKey = mergedEnv.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''

  if (!anthropicKey) {
    return new Response(
      `data: ${JSON.stringify({ type: 'text', text: 'No Anthropic API key found. Add it in Site Settings.' })}\ndata: ${JSON.stringify({ type: 'done' })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  const client = new Anthropic({ apiKey: anthropicKey })
  const token  = mergedEnv.GITHUB_TOKEN ?? ''
  const repo   = mergedEnv.GITHUB_REPO ?? ''
  const branch = mergedEnv.GITHUB_BRANCH ?? 'main'

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      const systemPrompt = buildSystemPrompt({ ...site, env: siteEnv })
      let conversationMessages: Anthropic.MessageParam[] = messages

      // Agentic loop — keep going until no more tool calls
      for (let turn = 0; turn < 10; turn++) {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          tools: TOOLS,
          messages: conversationMessages,
        })

        // Stream text blocks as they appear
        for (const block of response.content) {
          if (block.type === 'text') {
            send({ type: 'text', text: block.text })
          }
        }

        if (response.stop_reason === 'end_turn') break

        if (response.stop_reason === 'tool_use') {
          const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const toolUse of toolUseBlocks) {
            const input = toolUse.input as Record<string, string>
            send({ type: 'tool_call', name: toolUse.name, input })

            let result = ''
            try {
              if (toolUse.name === 'read_file') {
                result = await ghReadFile(token, repo, branch, input.path)
              } else if (toolUse.name === 'list_directory') {
                result = await ghListDir(token, repo, branch, input.path)
              } else if (toolUse.name === 'write_file') {
                result = await ghWriteFile(token, repo, branch, input.path, input.content, input.commit_message)
              } else if (toolUse.name === 'run_pipeline') {
                send({ type: 'tool_call', name: 'run_pipeline', input: { command: input.command, status: 'running…' } })
                result = await runPipeline(site.agentRoot, input.command)
              }
            } catch (err) {
              result = `Error: ${err instanceof Error ? err.message : String(err)}`
            }

            send({ type: 'tool_result', name: toolUse.name, result: result.slice(0, 500) })
            toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
          }

          // Add assistant turn + tool results to conversation
          conversationMessages = [
            ...conversationMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ]
        } else {
          break
        }
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
