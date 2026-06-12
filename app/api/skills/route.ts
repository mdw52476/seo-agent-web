import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SKILL_FILES = ['voice-guide.md', 'SKILL.md'] as const

export async function GET(req: NextRequest) {
  const agentRoot = req.nextUrl.searchParams.get('agentRoot')
  if (!agentRoot) return NextResponse.json({ error: 'agentRoot required' }, { status: 400 })

  const files: Record<string, string> = {}
  for (const name of SKILL_FILES) {
    const p = path.join(agentRoot, name)
    files[name] = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
  }
  return NextResponse.json(files)
}

export async function POST(req: NextRequest) {
  const { agentRoot, filename, content } = await req.json()
  if (!agentRoot || !filename) return NextResponse.json({ error: 'agentRoot and filename required' }, { status: 400 })
  if (!SKILL_FILES.includes(filename)) return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })

  fs.writeFileSync(path.join(agentRoot, filename), content ?? '', 'utf-8')
  return NextResponse.json({ ok: true })
}
