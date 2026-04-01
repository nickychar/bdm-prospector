# Scraper Wiring + Domain Fix — Design Spec
Date: 2026-04-01

## Problem

Two separate pipelines currently exist and are disconnected:

1. **Web app scan** (`job-posts/actions.ts`): calls SerpAPI Killer directly, writes to `job_posts`. Only 1 board, weak data.
2. **Scraper service** (Railway): 7 fast Cheerio boards + SerpAPI Killer, writes to its own schema (`job_signals`, `companies` without `user_id`). Never triggered by the web app.

Additionally, the scraper guesses company domains as `companyname.com`, which is almost always wrong for Dutch companies. This breaks the contact waterfall downstream.

## Goals

- Wire the dashboard "Scan" button to the full 7-board scraper pipeline (synchronous, no queue UX)
- Fix domain resolution using Clearbit instead of guessing
- Expand search keywords with related Dutch terms via Groq before scanning
- Replace `job_posts` display with richer `job_signals` data

## Out of Scope

- SerpAPI Killer (Puppeteer) board: too slow for synchronous path, excluded
- Contact waterfall changes
- Multi-user scoping beyond what's needed for MVP

---

## Schema Changes

Run in Supabase SQL editor:

```sql
-- 1. scrape_jobs: lightweight audit log (created by web app, read-only after)
create table if not exists public.scrape_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  query        text,
  filters      jsonb default '{}',
  status       text not null default 'done',
  result_count int default 0,
  error        text,
  created_at   timestamptz not null default now()
);
alter table public.scrape_jobs enable row level security;
create policy "users manage own scrape_jobs"
  on public.scrape_jobs for all using (auth.uid() = user_id);

-- 2. job_signals: richer than job_posts
create table if not exists public.job_signals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  scrape_job_id uuid references public.scrape_jobs(id) on delete set null,
  title         text,
  contract_type text,
  board         text,
  posted_date   date,
  raw_snippet   text,
  boards_count  int default 1,
  created_at    timestamptz not null default now()
);
alter table public.job_signals enable row level security;
create policy "users manage own job_signals"
  on public.job_signals for all using (auth.uid() = user_id);
create index idx_job_signals_user_id on public.job_signals(user_id);
create index idx_job_signals_company_id on public.job_signals(company_id);
create index idx_job_signals_created_at on public.job_signals(created_at desc);

-- 3. unique constraint so scraper can upsert companies per user
alter table public.companies
  add constraint if not exists companies_user_domain_unique unique (user_id, domain);
```

---

## Scraper Service Changes

### New HTTP endpoint: `POST /scan`

Add to the Express server in the scraper service. Receives:
```json
{ "queries": ["finance manager", "financieel directeur"], "filters": {} }
```
Runs `fanOut(query, filters)` for each query in parallel, merges + deduplicates results, returns:
```json
{ "results": [ DedupedJobResult, ... ] }
```

No auth needed on this endpoint — it sits behind Railway's private network and is called only by the web app via `SCRAPER_URL` env var. Add a shared secret header (`x-scraper-key`) for basic protection.

### Remove seniority from pipeline

- Remove `seniorityRaw` from `RawJobResult` in `types.ts`
- Remove `normaliseSeniority` call in `index.ts`
- Remove `seniority` from `insertJobSignal` input

### No other scraper service changes

The scraper's internal queue (poller, heartbeat, timeout checker) and waterfall remain untouched — they handle a different use case (background enrichment). The new `/scan` endpoint is additive.

---

## Web App Changes

### `src/app/dashboard/job-posts/actions.ts` — rewrite `scanJobs()`

New flow:
1. Load user's keywords + locations from `users` table
2. Call Groq (`llama-3.3-70b`) to expand each keyword into 3–5 related Dutch search terms
3. `POST {SCRAPER_URL}/scan` with expanded queries + filters, await response (45s timeout)
4. For each result: resolve domain via Clearbit autocomplete (reuse logic from `companies/actions.ts`); skip domain if Clearbit returns nothing (don't guess)
5. Upsert company into `companies` (conflict on `user_id, domain` if domain present; plain insert if no domain)
6. Insert `job_signals` rows (with `user_id`, `company_id`, `scrape_job_id`)
7. Insert one `scrape_jobs` audit row (status='done', result_count=N)
8. Return `{ count: N }`

Remove all existing SerpAPI inline logic. Remove `parsePostedDate` helper (it moves into the scraper service).

### `src/app/dashboard/job-posts/page.tsx` — switch to `job_signals`

Query:
```sql
select job_signals.*, companies(name, domain, location)
from job_signals
where user_id = $1
order by created_at desc
limit 200
```

Display columns: job title, company name, board badge, contract type, posted date, snippet (truncated).
Remove all references to `job_posts`.

### `src/types/database.ts` — add new tables

Add `scrape_jobs` and `job_signals` table types (Row / Insert / Update).

### Environment variables

Add to `.env.local` and Vercel:
```
SCRAPER_URL=http://localhost:3002   # Railway URL in production
SCRAPER_KEY=some-shared-secret
```

---

## Keyword Expansion

Groq prompt (system):
> You are a Dutch job market assistant. Given a job role keyword, return 3–5 related search terms commonly used on Dutch job boards. Include Dutch equivalents. Return a JSON array of strings only, no explanation.

Example: `"finance manager"` → `["finance manager", "financieel manager", "financieel directeur", "controller", "CFO"]`

If Groq fails or times out, fall back to the original keyword only (non-blocking).

---

## Domain Resolution

Per scraped company, call Clearbit autocomplete:
```
GET https://autocomplete.clearbit.com/v1/companies/suggest?query={companyName}
```
Take `results[0].domain` if returned. If empty or request fails, `domain = null`.

Do NOT guess `.nl` or `.com` suffixes. A missing domain is better than a wrong one.

---

## Data Flow (after changes)

```
User clicks "Scan"
  → scanJobs() [Next.js server action]
      → Groq: expand keywords
      → POST /scan → Railway scraper
          → 7 Cheerio boards in parallel (~5–10s)
          → dedup results
          → return DedupedJobResult[]
      → for each result:
          → Clearbit: resolve domain
          → upsert companies
          → insert job_signals
      → insert scrape_jobs audit row
      → revalidatePath('/dashboard/job-posts')
  → Page re-renders with job_signals
```

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/schema.sql` | Add scrape_jobs, job_signals tables + companies constraint |
| `supabase/migrations/007_scrape_jobs_and_signals.sql` | Migration file for the above |
| `src/types/database.ts` | Add scrape_jobs + job_signals types |
| `src/app/dashboard/job-posts/actions.ts` | Rewrite scanJobs() |
| `src/app/dashboard/job-posts/page.tsx` | Switch to job_signals |
| `scraper/src/types.ts` | Remove seniorityRaw from RawJobResult |
| `scraper/src/normalise/nl-terms.ts` | Remove normaliseSeniority (or keep, unused) |
| `scraper/src/index.ts` | Remove seniority normalisation call |
| `scraper/src/scrapers/*.ts` | Remove seniorityRaw from returned objects |
| `scraper/src/server.ts` (new) | Express server with POST /scan endpoint |
| `.env.local` | Add SCRAPER_URL, SCRAPER_KEY |

---

## What Gets Removed

- `job_posts` table usage (table itself stays in DB to avoid migration risk, just unused)
- Inline SerpAPI logic in `job-posts/actions.ts`
- `parsePostedDate` in web app (already in scraper service)
- SerpAPI Killer board from synchronous scan path
