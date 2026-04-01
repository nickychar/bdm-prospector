-- Migration 007: scan_runs + job_signals tables, companies unique constraint
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/ighzjcqtvibeezbetyde/sql

-- Audit log for web app scans (NOT the scraper's queue table)
create table if not exists public.scan_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  query_count  int not null default 0,
  result_count int not null default 0,
  error        text,
  created_at   timestamptz not null default now()
);
alter table public.scan_runs enable row level security;
create policy "users manage own scan_runs"
  on public.scan_runs for all using (auth.uid() = user_id);
create index idx_scan_runs_user_id on public.scan_runs(user_id);
create index idx_scan_runs_created_at on public.scan_runs(created_at desc);

-- Richer job signals — replaces job_posts as primary scan output
create table if not exists public.job_signals (
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
create index idx_job_signals_user_id on public.job_signals(user_id);
create index idx_job_signals_company_id on public.job_signals(company_id);
create index idx_job_signals_created_at on public.job_signals(created_at desc);

-- Unique constraint so web app can upsert companies by (user_id, domain)
alter table public.companies
  add constraint if not exists companies_user_domain_unique unique (user_id, domain);
