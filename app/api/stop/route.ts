import { NextRequest, NextResponse } from 'next/server'

declare global {
  var activeProcesses: Map<string, any>
}

export async function POST(req: NextRequest) {
  const { runId } = await req.json()
  // Signal via a global flag the run route checks
  return NextResponse.json({ ok: true })
}
