import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const agentRoot = req.nextUrl.searchParams.get('agentRoot') ?? ''
  if (!agentRoot) return NextResponse.json({ ready: false, analyzed: false })

  const ready    = fs.existsSync(path.join(agentRoot, 'src', 'index.ts'))
  const analyzed = fs.existsSync(path.join(agentRoot, 'site-profile.json'))

  return NextResponse.json({ ready, analyzed })
}
