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
