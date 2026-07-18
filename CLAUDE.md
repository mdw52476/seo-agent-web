@AGENTS.md

# SEO Agent Web Dashboard — Claude Code Guidelines

## What This Is
The Next.js web dashboard for the SEO Agent. Deployed on Railway. Manages multiple client sites, spawns the CLI agent as a child process, and streams output to the browser in real time.

There are two repos — this is the web dashboard:
- **This repo:** `mdw52476/seo-agent-web` at `C:\Users\mdw52\seo-agent-web`
- **CLI agent:** `mdw52476/seo-agent` at `C:\Users\mdw52\seo-agent`

Full CLI architecture is documented in `C:\Users\mdw52\seo-agent\CLAUDE.md`.

## How the Dashboard Works
`/api/run/route.ts` receives a command from the UI, writes a `.env` for the target site, spawns `npx tsx src/index.ts <cmd>` against the CLI agent, and streams stdout/stderr back as Server-Sent Events.

## File Structure
```
app/
├── page.tsx              — root page
├── layout.tsx            — Next.js layout
├── AppContext.tsx         — React context: active site, UI state
├── types.ts              — TypeScript interfaces for web layer
├── lib/supabase.ts       — Supabase client
├── api/
│   ├── run/route.ts      — POST: spawn CLI command, stream SSE output
│   ├── sites/route.ts    — GET/POST/DELETE: manage sites in Supabase
│   ├── skills/route.ts   — GET/POST: read/write voice-guide.md, SKILL.md, site-layout.md
│   ├── published/route.ts
│   ├── plan/route.ts
│   ├── audit-report/route.ts
│   ├── analytics/route.ts
│   ├── chat/route.ts
│   └── stop/route.ts
└── components/
    ├── AppShell.tsx       — main layout shell
    ├── Sidebar.tsx        — site switcher
    ├── Pipeline.tsx       — stage runner (analyze → research → plan → publish)
    ├── Articles.tsx       — article list + count selector + brief textarea
    ├── Directories.tsx    — directory article list
    ├── Skills.tsx         — Site Layout Profile + Voice Guide + AI-Tells Rules
    ├── Audit.tsx          — SEO audit report viewer
    ├── Analytics.tsx      — traffic/performance stats
    ├── Dashboard.tsx      — overview
    ├── SiteSettings.tsx   — GitHub token, repo, content path, site type
    ├── LogViewer.tsx      — real-time terminal output streamer
    └── Assistant.tsx      — chat interface
```

## Key UI Components

### Articles.tsx
- Article list + count selector (1-3) for how many to publish
- **Brief textarea** — user-specified topic/instructions; passes `--brief "..."` to CLI, skips keyword research
- Button becomes "Publish Brief" when brief is entered

### Skills.tsx
Three sections in order:
1. **Site Layout Profile** — read-only `site-layout.md` (agent-generated). "Refresh Site Layout" button streams `fingerprint` CLI command.
2. **Voice Guide** — editable `voice-guide.md`. User's writing tone/style.
3. **AI-Tells Rules** — editable `SKILL.md`. AI-tell patterns to eliminate.

### /api/skills/route.ts
- Readable: `voice-guide.md`, `SKILL.md`, `site-layout.md`
- Writable: `voice-guide.md`, `SKILL.md` only — `site-layout.md` is agent-owned, POST is blocked

## Skill Files (per site, stored in agent root)
| File | Owner | Editable in UI |
|------|-------|---------------|
| `site-layout.md` | Agent (auto-generated) | No — read only |
| `voice-guide.md` | User | Yes |
| `SKILL.md` | User | Yes |

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GITHUB_TOKEN=           # in .env.local — NEVER paste in chat
```

## Supabase Tables
| Table | Purpose |
|-------|---------|
| `sites` | Site metadata, env vars, agent root path |
| `articles` | Published article log per site |
| `audit_reports` | SEO audit results |
| `content_plans` | 30-day content guides |

## Rules
- GitHub tokens must NEVER appear in chat — GitHub secret scanning auto-revokes them
- Token is stored at `.env.local` — edit directly, never paste in chat
- `site-layout.md` is agent-owned — never allow user edits via the UI
- Keep WindshieldMap work in a separate Claude Code session — do not mix projects

