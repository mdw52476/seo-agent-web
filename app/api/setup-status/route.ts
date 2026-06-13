import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const agentRoot = req.nextUrl.searchParams.get('agentRoot') ?? ''
  if (!agentRoot) return NextResponse.json({ ready: false, analyzed: false, hasApiKey: false })

  const ready    = fs.existsSync(path.join(agentRoot, 'src', 'index.ts'))
  const analyzed = fs.existsSync(path.join(agentRoot, 'site-profile.json'))

  // Check if ANTHROPIC_API_KEY is present in the site's .env
  let hasApiKey = false
  const envPath = path.join(agentRoot, '.env')
  if (fs.existsSync(envPath)) {
    const envContents = fs.readFileSync(envPath, 'utf-8')
    hasApiKey = /ANTHROPIC_API_KEY=.+/.test(envContents)
  }

  return NextResponse.json({ ready, analyzed, hasApiKey })
}
