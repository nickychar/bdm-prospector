-- Migration 007: scan_runs, job_signals, and schema repair
-- Run date: 2026-04-02
-- NOTE: This migration was run as a repair script (all statements are idempotent)

-- 1. Add scan config columns to users
alter table public.users
  add column if not exists scan_keywords  text[] not null default '{}',
  add column if not exists scan_locations text[] not null default '{}';

-- 2. scan_runs — audit log for each web-app scan
create table if not exists public.scan_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  query_count  int  not null default 0,
  result_count int  not null default 0,
  error        text,
  created_at   timestamptz not null default now()
);
alter table public.scan_runs enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scan_runs'
    and policyname = 'users manage own scan_runs'
  ) then
    create policy "users manage own scan_runs"
      on public.scan_runs for all using (auth.uid() = user_id);
  end if;
end $$;
create index if not exists idx_scan_runs_user_id    on public.scan_runs(user_id);
create index if not exists idx_scan_runs_created_at on public.scan_runs(created_at desc);

-- 3. job_signals — drop old scraper version (no user_id), create web-app version
drop table if exists public.job_signals cascade;
create table public.job_signals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  scan_run_id   uuid references public.scan_runs(id) on delete set null,
  title         text,
  contract_type text,
  board         text,
  posted_date   date,
  raw_snippet   text,
  boards_count  int not null default 1,
  created_at    timestamptz not null default now(),
  unique (user_id, company_id, title, board)
);
alter table public.job_signals enable row level security;
create policy "users manage own job_signals"
  on public.job_signals for all using (auth.uid() = user_id);
create index idx_job_signals_user_id    on public.job_signals(user_id);
create index idx_job_signals_company_id on public.job_signals(company_id);
create index idx_job_signals_created_at on public.job_signals(created_at desc);

-- 4. companies: unique (user_id, domain) for upsert-by-domain
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_user_domain_unique'
    and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_user_domain_unique unique (user_id, domain);
  end if;
end $$;

-- 5. leads: unique contact_id for upsert in generateLeads()
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_contact_id_unique'
    and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_contact_id_unique unique (contact_id);
  end if;
end $$;

-- 6. crm_connections — OAuth tokens for Gmail / Salesforce (needed by onboarding)
create table if not exists public.crm_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  provider          text not null,
  access_token      text not null,
  refresh_token     text,
  provider_metadata jsonb not null default '{}',
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, provider)
);
alter table public.crm_connections enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'crm_connections'
    and policyname = 'users manage own crm_connections'
  ) then
    create policy "users manage own crm_connections"
      on public.crm_connections for all using (auth.uid() = user_id);
  end if;
end $$;
create index if not exists idx_crm_connections_user_id on public.crm_connections(user_id);
