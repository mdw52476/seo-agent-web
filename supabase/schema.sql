-- Sites
create table if not exists sites (
  id          text primary key,
  name        text not null,
  url         text not null,
  site_type   text not null default 'nextjs',
  agent_root  text,
  env         jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Published articles + directories
create table if not exists articles (
  id           uuid primary key default gen_random_uuid(),
  site_id      text not null references sites(id) on delete cascade,
  keyword      text,
  slug         text not null,
  title        text not null,
  url          text,
  article_type text not null default 'article',  -- 'article' | 'directory'
  published_at timestamptz not null default now()
);

create index if not exists articles_site_id on articles(site_id);

-- Audit reports (one per run; latest is current)
create table if not exists audit_reports (
  id             uuid primary key default gen_random_uuid(),
  site_id        text not null references sites(id) on delete cascade,
  score          integer not null default 0,
  pages_checked  integer not null default 0,
  issues         jsonb not null default '[]'::jsonb,
  audited_at     timestamptz not null default now()
);

create index if not exists audit_reports_site_id on audit_reports(site_id);

-- 30-day content plans (one row per site per cycle)
create table if not exists content_plans (
  id         uuid primary key default gen_random_uuid(),
  site_id    text not null references sites(id) on delete cascade,
  cycle      int not null default 1,
  days       jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (site_id, cycle)
);

create index if not exists content_plans_site_id on content_plans(site_id);

-- Pipeline run logs (one row per site per stage; latest run overwrites)
create table if not exists run_logs (
  id       uuid primary key default gen_random_uuid(),
  site_id  text not null references sites(id) on delete cascade,
  stage    text not null,
  lines    jsonb not null default '[]'::jsonb,
  ran_at   timestamptz not null default now(),
  unique (site_id, stage)
);

create index if not exists run_logs_site_id on run_logs(site_id);

-- ── Multi-tenancy: Part 1 — add ownership column (safe against live traffic) ──
-- Run this first, standalone. Leave nullable until existing rows are backfilled
-- with the site owner's auth.users id, then run:
--   alter table sites alter column user_id set not null;
alter table sites add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists sites_user_id on sites(user_id);

-- ── Multi-tenancy: Part 2 — RLS (run only after backfilling user_id above) ───
alter table sites          enable row level security;
alter table articles       enable row level security;
alter table audit_reports  enable row level security;
alter table content_plans  enable row level security;
alter table run_logs       enable row level security;

create policy "sites_select_own" on sites for select using (user_id = auth.uid());
create policy "sites_insert_own" on sites for insert with check (user_id = auth.uid());
create policy "sites_update_own" on sites for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sites_delete_own" on sites for delete using (user_id = auth.uid());

create policy "articles_all_own" on articles for all
  using (exists (select 1 from sites where sites.id = articles.site_id and sites.user_id = auth.uid()))
  with check (exists (select 1 from sites where sites.id = articles.site_id and sites.user_id = auth.uid()));

create policy "audit_reports_all_own" on audit_reports for all
  using (exists (select 1 from sites where sites.id = audit_reports.site_id and sites.user_id = auth.uid()))
  with check (exists (select 1 from sites where sites.id = audit_reports.site_id and sites.user_id = auth.uid()));

create policy "content_plans_all_own" on content_plans for all
  using (exists (select 1 from sites where sites.id = content_plans.site_id and sites.user_id = auth.uid()))
  with check (exists (select 1 from sites where sites.id = content_plans.site_id and sites.user_id = auth.uid()));

create policy "run_logs_all_own" on run_logs for all
  using (exists (select 1 from sites where sites.id = run_logs.site_id and sites.user_id = auth.uid()))
  with check (exists (select 1 from sites where sites.id = run_logs.site_id and sites.user_id = auth.uid()));
