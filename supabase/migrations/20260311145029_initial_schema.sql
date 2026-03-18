-- ============================================================
-- BDM Prospector - Full Database Schema
-- Run this in your Supabase project: SQL Editor → New query → Run
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. USERS (profile data extending Supabase auth.users)
-- ============================================================
create table public.users (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  full_name               text,
  agency_name             text,
  -- Salesforce OAuth tokens (stored encrypted via Supabase vault in prod)
  salesforce_access_token  text,
  salesforce_refresh_token text,
  salesforce_instance_url  text,
  -- Gmail OAuth tokens
  gmail_access_token      text,
  gmail_refresh_token     text,
  -- Onboarding state
  onboarding_completed    boolean not null default false,
  onboarding_step         integer not null default 0,
  -- Deduplication rule: 'email' | 'name_and_company' | 'salesforce_id'
  dedup_rule              text not null default 'email',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 2. COMPANIES (target companies from SF or manual entry)
-- ============================================================
create table public.companies (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.users(id) on delete cascade,
  name                  text not null,
  domain                text,
  industry              text,
  size_range            text,  -- e.g. '50-200', '200-1000'
  location              text,
  website               text,
  salesforce_account_id text,
  -- source: 'salesforce' | 'manual' | 'scraped'
  source                text not null default 'manual',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "Users can manage own companies"
  on public.companies for all
  using (auth.uid() = user_id);

create index idx_companies_user_id on public.companies(user_id);
create index idx_companies_domain on public.companies(domain);
create index idx_companies_sf_id on public.companies(salesforce_account_id);


-- ============================================================
-- 3. CONTACTS (individuals at companies)
-- ============================================================
create table public.contacts (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.users(id) on delete cascade,
  company_id            uuid references public.companies(id) on delete set null,
  first_name            text,
  last_name             text,
  email                 text,
  phone                 text,
  title                 text,
  seniority             text,  -- e.g. 'Director', 'VP', 'C-Suite'
  linkedin_url          text,
  salesforce_contact_id text,
  apollo_id             text,
  -- source: 'salesforce' | 'apollo' | 'manual'
  source                text not null default 'manual',
  enriched_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "Users can manage own contacts"
  on public.contacts for all
  using (auth.uid() = user_id);

create index idx_contacts_user_id on public.contacts(user_id);
create index idx_contacts_company_id on public.contacts(company_id);
create index idx_contacts_email on public.contacts(email);
create index idx_contacts_sf_id on public.contacts(salesforce_contact_id);


-- ============================================================
-- 4. JOB_POSTS (job listings found via SerpAPI)
-- ============================================================
create table public.job_posts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  title         text not null,
  description   text,
  url           text,
  location      text,
  -- source: 'serpapi' | 'manual'
  source        text not null default 'serpapi',
  posted_date   date,
  detected_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table public.job_posts enable row level security;

create policy "Users can manage own job posts"
  on public.job_posts for all
  using (auth.uid() = user_id);

create index idx_job_posts_user_id on public.job_posts(user_id);
create index idx_job_posts_company_id on public.job_posts(company_id);
create index idx_job_posts_detected_at on public.job_posts(detected_at desc);


-- ============================================================
-- 5. LEADS (scored prospects ready for outreach)
-- ============================================================
create table public.leads (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete cascade,
  company_id      uuid references public.companies(id) on delete cascade,
  job_post_id     uuid references public.job_posts(id) on delete set null,
  -- Scoring
  score           integer not null default 0,  -- 0-100
  score_reasons   jsonb not null default '[]', -- array of {reason, points}
  priority_rank   integer,
  -- Status: 'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'
  status          text not null default 'new',
  -- Dedup tracking
  is_duplicate    boolean not null default false,
  duplicate_of    uuid references public.leads(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "Users can manage own leads"
  on public.leads for all
  using (auth.uid() = user_id);

create index idx_leads_user_id on public.leads(user_id);
create index idx_leads_contact_id on public.leads(contact_id);
create index idx_leads_company_id on public.leads(company_id);
create index idx_leads_status on public.leads(status);
create index idx_leads_score on public.leads(score desc);
create index idx_leads_priority on public.leads(priority_rank asc nulls last);


-- ============================================================
-- 6. EMAIL_DRAFTS (generated and sent emails)
-- ============================================================
create table public.email_drafts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.users(id) on delete cascade,
  lead_id             uuid not null references public.leads(id) on delete cascade,
  subject             text not null,
  body                text not null,
  template_used       text,
  -- Status: 'draft' | 'sent' | 'opened' | 'replied' | 'bounced'
  status              text not null default 'draft',
  sent_at             timestamptz,
  opened_at           timestamptz,
  replied_at          timestamptz,
  -- External IDs for write-back
  gmail_message_id    text,
  gmail_thread_id     text,
  salesforce_task_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.email_drafts enable row level security;

create policy "Users can manage own email drafts"
  on public.email_drafts for all
  using (auth.uid() = user_id);

create index idx_email_drafts_user_id on public.email_drafts(user_id);
create index idx_email_drafts_lead_id on public.email_drafts(lead_id);
create index idx_email_drafts_status on public.email_drafts(status);


-- ============================================================
-- Auto-update updated_at on all tables
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

create trigger set_companies_updated_at
  before update on public.companies
  for each row execute procedure public.set_updated_at();

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();

create trigger set_leads_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

create trigger set_email_drafts_updated_at
  before update on public.email_drafts
  for each row execute procedure public.set_updated_at();
