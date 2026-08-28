import { NextResponse } from 'next/server'

// Force this to actually re-run per request -- a route with no dynamic
// behavior can otherwise get statically evaluated once and cached, which
// would make this diagnostic report stale/wrong env-var state forever.
export const dynamic = 'force-dynamic'

export async function GET() {
  // Booleans only, never values -- lets us confirm a Railway variable actually
  // reached the running container without exposing any secret.
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  return NextResponse.json({ ok: true, env })
}
