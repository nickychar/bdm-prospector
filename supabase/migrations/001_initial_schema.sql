-- supabase/migrations/001_initial_schema.sql

create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text unique not null,
  size_band   text check (size_band in ('small', 'mid', 'large')),
  sector      text,
  country     text check (country in ('uk', 'nl')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table scrape_jobs (
  id           uuid primary key default gen_random_uuid(),
  query        text,
  filters      jsonb default '{}',
  status       text default 'queued' check (status in ('queued','running','done','failed')),
  started_at   timestamptz,
  completed_at timestamptz,
  updated_at   timestamptz default now(),
  result_count int default 0,
  error        text,
  created_at   timestamptz default now()
);

create table job_signals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id) on delete cascade,
  title         text,
  seniority     text check (seniority in ('director','head','manager','other')),
  contract_type text check (contract_type in ('interim','temp','contract','other')),
  board         text,
  posted_date   date,
  raw_snippet   text,
  boards_count  int default 1,
  scrape_job_id uuid references scrape_jobs(id) on delete set null,
  created_at    timestamptz default now()
);

create table contacts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id) on delete cascade,
  name          text,
  title         text,
  persona_type  text check (persona_type in ('hiring_manager','agency_selector')),
  email         text,
  smtp_verified boolean default false,
  confidence    text check (confidence in ('high','medium','low')),
  source        text check (source in ('companies_house','kvk','website','google','press')),
  found_at      timestamptz default now()
);

create table leads (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references companies(id) on delete cascade unique,
  score            int default 0,
  stage            text default 'new' check (stage in (
                     'new','contacted','replied','meeting_booked',
                     'proposal_sent','won','dead'
                   )),
  is_suppressed    boolean default false,
  created_at       timestamptz default now(),
  last_activity_at timestamptz default now()
);

create table pipeline_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  from_stage  text,
  to_stage    text,
  note        text,
  created_at  timestamptz default now()
);

create table saved_searches (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  query         text,
  filters       jsonb default '{}',
  schedule_cron text,
  created_at    timestamptz default now()
);

-- indexes for common queries
create index on job_signals (company_id, posted_date desc);
create index on job_signals (board);
create index on contacts (company_id);
create index on leads (stage);
create index on leads (score desc);
create index on scrape_jobs (status, created_at);
create index on pipeline_events (lead_id, created_at desc);
