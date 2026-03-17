# BDM Prospector — Scraper-First Design Spec
**Date:** 2026-03-17
**Status:** Awaiting user review
**Scope:** Core functionality MVP — job scraping, contact finding, pipeline management

---

## 1. Direction & Constraints

### What this build is
A web app that helps recruitment agency BDMs (specialising in interim/temp placements) find companies actively hiring interim workers, identify the right contacts at those companies, and track their outreach — all without any external CRM or paid data dependencies.

### Key constraints agreed
- **Scraper-first:** No paid enrichment APIs as a hard dependency. Free waterfall only. Paid enrichment added later as optional upgrade.
- **No integrations:** No Salesforce, HubSpot, or CRM sync. All pipeline management is inside the app.
- **No email sending:** Focus is finding leads and contacts. Email workflows are post-MVP.
- **Search-triggered scraping:** Scraping runs on demand when the user searches. Scheduled scanning is opt-in, off by default.
- **Target markets:** UK and Netherlands.

---

## 2. Architecture

### Service split: Next.js + Node.js scraper + Supabase

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│   Next.js App (Vercel)      │     │   Scraper Service (VPS)      │
│                             │     │                              │
│  • All UI                   │     │  • Job board scrapers        │
│  • Pipeline management      │     │  • Contact waterfall         │
│  • Search interface         │     │  • SMTP verification         │
│  • Auth (Supabase Auth)     │     │  • Optional: scheduled scan  │
└──────────┬──────────────────┘     └──────────────┬───────────────┘
           │                                        │
           └──────────────┬─────────────────────────┘
                          │
           ┌──────────────▼──────────────┐
           │      Supabase (Postgres)     │
           └─────────────────────────────┘
```

**Communication contract between services:**
- Next.js writes a row to `scrape_jobs` with status `queued`. It never calls the scraper directly.
- The scraper claims jobs **atomically** using: `UPDATE scrape_jobs SET status='running', started_at=now() WHERE id=(SELECT id FROM scrape_jobs WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`. This prevents two scraper instances from claiming the same job simultaneously.
- The scraper writes results directly to `companies`, `job_signals`, `contacts`, and `leads` as they arrive. It updates `scrape_jobs.updated_at` every 20 seconds as a heartbeat.
- Next.js polls `scrape_jobs` every 2 seconds until `status = 'done'` or `status = 'failed'`, then reads results from the relevant tables.
- No direct HTTP between Next.js and the scraper. Supabase is the only shared interface. No authentication needed between services beyond Supabase service role key on the scraper.
- **Timeout enforcement (owned by the scraper service):** on startup and every 5 minutes, the scraper runs: `UPDATE scrape_jobs SET status='failed', error='timeout' WHERE status='running' AND updated_at < now() - interval '3 minutes'`. This ensures stalled jobs are recovered even if a user closed their tab. Next.js shows an error when it polls a failed job.

### Concurrent score writes
The `leads` table has `UNIQUE(company_id)`. If two searches surface the same company concurrently, both will attempt to write a score. To avoid last-writer-wins corruption, score is always recomputed **from raw signals at write time** in a single transaction per lead: read current `job_signals` + `contacts` for the company, compute score, upsert `leads.score`. Concurrent writes to the same lead are serialised by Postgres row-level locking (the upsert will queue behind the first writer). No advisory locks needed.

**Tech stack:**
- Frontend: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- Database: Supabase (PostgreSQL + Auth)
- Scraper service: Node.js (long-running process, not serverless)
- Hosting: Vercel (frontend) + Railway (scraper service, free tier)

---

## 3. Job Scraping Engine

### Sources

| Source | Market | Notes |
|---|---|---|
| Reed.co.uk | UK | Clean HTML, highly scrapable |
| Totaljobs | UK | Major UK board |
| Indeed.co.uk | UK | High volume |
| Indeed.nl | NL | High volume |
| Nationale Vacaturebank | NL | Major NL board |
| Monsterboard.nl | NL | Large general board |
| Intermediair.nl | NL | Professional/manager level |
| Stepstone.nl | NL | European board, strong NL |
| Jobbird.com | NL | Aggregator — 50+ smaller boards |
| Flexmarkt.nl | NL | Interim/detachering-specific — highest NL signal |
| Company career pages | Both | On-demand when user searches a company name |

LinkedIn Jobs excluded (anti-scraping, legally grey).

### Performance expectations
- **What "fast" means:** companies + job signals appear within 10–15 seconds of search. Contact enrichment runs async and fills in over the following 30–60 seconds. The UI shows a loading state per contact card, not a full-page block.
- There is no expectation that SMTP verification or the full contact waterfall completes within 10 seconds. Contacts load progressively.

### Language handling
NL boards are Dutch-language. The scraper includes a normalisation layer that maps Dutch role/contract terms to internal English enum values before storage:
- Contract type: "detachering / interim / tijdelijk / flex" → `interim`; "tijdelijk" → `temp`; "vast" → `permanent` (filtered out)
- Seniority: "directeur / hoofd / manager / senior" mapped to seniority enum

### Deduplication
- Canonical company domain is extracted from the job posting URL or company name using domain-normalisation rules (strip www, lowercase, country TLD kept).
- Within a single search run, duplicate company domains are merged into one company record; `boards_count` is incremented per additional board.
- Across runs, the same company domain maps to the same `companies` row (upsert on domain).
- Company name conflicts (same domain, different display names) resolve by keeping the most recently scraped name.

### Historical pattern tracking
Every scraped job signal is stored in `job_signals` with its `posted_date` and `company_id`. The scoring engine queries this table to compute:
- `recent_post_count`: number of job signals for this company in the last 90 days
- `last_post_date`: most recent signal date (for recency scoring)
This is recomputed at score time, not cached. No separate "pattern" table needed.

### Serial poster definition
A company is a **serial poster** when `recent_post_count >= 3` within 90 days. This triggers the +15 bonus in scoring.

### NL language normalisation fallback
If a Dutch term does not match the normalisation mapping, the value is stored as `'other'` for `contract_type` and `'other'` for `seniority` — never dropped, never passed through as raw Dutch. Terms mapped to `contract_type = 'permanent'` are filtered out of results entirely (not relevant to interim BDMs). Unknown terms are logged to a `normalisation_misses` table (board, raw_term, field, created_at) so the mapping can be improved over time.

---

## 4. Contact Finding Engine

### Two target personas

| Persona | Target titles |
|---|---|
| **Hiring Manager** — whose team needs the interim worker | Finance Director, CFO, HR Director, Operations Director, Head of Finance, Head of HR |
| **Agency Selector** — who decides which recruitment agency to use | Head of Talent, Talent Acquisition Manager, HR Business Partner, Procurement Director, Chief People Officer |

Goal: 2–3 contacts per company, covering both personas where possible.

### Role of Companies House / KvK
Companies House (UK) and KvK (NL) are used for **company verification and director lookup** — not as a primary contact source for all target personas.

What they reliably return: formally filed directors (CEO, CFO, Finance Director, Company Secretary). These map well to the **Hiring Manager** persona at mid-size companies.

What they do not return: Head of Talent, HR Business Partners, Procurement Managers. These are found via steps 2–4 of the waterfall.

### The waterfall — termination rules

The waterfall runs steps sequentially. After **each step completes**, it checks the accumulated contact list. If 3 or more High-confidence contacts have been found at that point, the waterfall stops — remaining steps are skipped. Otherwise it continues to the next step. Results from all completed steps are merged by deduplicating on `(name, company_id)` (case-insensitive name match). Three is the cap for MVP — additional contacts beyond 3 are discarded.

```
Step 1: Companies House API (UK) / KvK (NL)
        → Query by company domain → get filed directors
        → Map titles to persona types
        → If CFO/Finance Director found → Hiring Manager candidate (High confidence)
        → Free, instant

Step 2: Google search scraping
        → Query: site:linkedin.com "[company name]" "[target title]"
        → Run one query per persona type (2 queries per company)
        → Parse name + title from result snippet
        → Confidence: Medium (name confirmed, email not yet)

Step 3: Company website scraping
        → Fetch domain homepage, follow links matching: /about, /team, /people, /leadership, /contact
        → Parse named individuals with titles from page text
        → Confidence: High if title matches target persona, Medium otherwise

Step 4: Press release scraping
        → Google News query: "[company name]" "appoints" OR "joins as"
        → Parse name + title + date from snippets
        → Confidence: High (formal announcement)

Step 5: Email pattern generation
        → Requires a confirmed name from steps 1–4
        → Generate variants using company domain:
            firstname@domain, f.lastname@domain, firstname.lastname@domain,
            firstname_lastname@domain, flastname@domain
        → Maximum 5 patterns per contact

Step 6: SMTP verification
        → For each generated email pattern, open SMTP connection to domain's MX server
        → Issue RCPT TO command — server accepts or rejects without a message being sent
        → Mark accepted emails as smtp_verified = true
        → Confidence upgrade: Medium → Medium (name from Google/website + verified email)
        → If Companies House name + SMTP verified → High confidence
```

### Confidence assignment

| Source combination | Confidence |
|---|---|
| Companies House / KvK name + any email | High |
| Company website name + SMTP verified email | High |
| Press release name + any email | High |
| Google search name + SMTP verified email | Medium |
| Google search name + unverified email pattern | Low |
| Email pattern only (no confirmed name) | Low — shown but clearly flagged |

### Contact output per record
- `name` (string)
- `title` (string)
- `persona_type` enum: `hiring_manager` | `agency_selector`
- `email` (string, nullable)
- `smtp_verified` (boolean)
- `confidence` enum: `high` | `medium` | `low`
- `source` (string — e.g. "Companies House", "Company website")
- `found_at` (timestamp)
- `company_id` (foreign key)

---

## 5. Scoring Logic

Score is 0–100, stored on the `leads` row, recomputed every time a search surfaces or refreshes a lead.

### Recency (mutually exclusive — use the highest applicable)

| Signal | Points |
|---|---|
| Most recent job post: today | 30 |
| Most recent job post: 2–3 days ago | 22 |
| Most recent job post: 4–7 days ago | 15 |
| Most recent job post: 8–30 days ago | 8 |
| No post in last 30 days | 0 |

### Score computation order of operations
To avoid a race condition where the UI briefly shows an inflated score before the pipeline penalty is applied, the score is always computed in a single transaction in this exact order:
1. Read all `job_signals` for the company → compute recency + bonuses
2. Read all `contacts` for the company → add contact bonuses
3. Read current `leads.stage` → apply penalty if applicable
4. Write final score to `leads.score`

The UI never shows a score that hasn't had the pipeline penalty applied.

### Additive bonuses (stackable)

| Signal | Points | Definition |
|---|---|---|
| Serial poster | +15 | `recent_post_count >= 3` in last 90 days |
| Flexmarkt.nl signal | +8 | At least one job signal sourced from Flexmarkt.nl (explicit interim market) |
| Multi-board signal | +5 | `boards_count >= 3` for the most recent post |
| Hiring Manager contact found | +10 | At least one contact with `persona_type = hiring_manager` and `confidence != low` |
| Agency Selector contact found | +10 | At least one contact with `persona_type = agency_selector` and `confidence != low` |
| Email SMTP verified | +5 | At least one contact has `smtp_verified = true` |
| Company size 50–500 | +5 | `size_band = 'mid'` (set during company scraping) |

### Penalty

| Signal | Points | Definition |
|---|---|---|
| Already in active pipeline | −20 | Lead exists with stage in (Contacted, Replied, Meeting Booked, Proposal Sent) — not New, not Won, not Dead |

Rationale: New leads in pipeline still score normally (they may not have been actioned yet). Dead and Won leads are suppressed entirely from search results, not penalised.

### Score bands

| Score | Badge | Shown by default |
|---|---|---|
| 70–100 | 🔴 Hot | Yes |
| 45–69 | 🟡 Warm | Yes |
| 20–44 | ⚪ Cold | Yes |
| Below 20 | — | Hidden — shown via "Show all" toggle |

---

## 6. Pipeline Management

### Two views (tab toggle at top of pipeline page)

**Board view (Kanban)**
- One column per stage
- Lead cards show: company name, score badge, contact count, days in current stage, last activity date
- Drag and drop to move between stages
- Quick-add note directly from card

**List view (Table)**
- Columns (all sortable): Company, Country, Score, Stage, Contacts Found, Last Activity, Days in Stage
- Filter bar: by stage, score band, country, sector
- Bulk actions: move stage, archive
- Both views operate on the same filtered set. Filters applied in list view persist when switching to board view (stored in URL params).

### Pipeline stages

Fixed for MVP. Customisable per user in future.

`New` → `Contacted` → `Replied` → `Meeting Booked` → `Proposal Sent` → `Won` → `Dead`

Leads enter at `New` when first added from search results or manually created.

### Lead detail panel (opens on click, either view)
- **Company:** name, domain, size band, sector, country, website link
- **Job signals:** all scraped postings — title, board, posted date, contract type
- **Score breakdown:** itemised list of which signals contributed and how many points each
- **Contacts:** list of all found contacts — name, title, persona badge, confidence badge, email (obfuscated until clicked), source, found date
- **Pipeline history:** stage changes with timestamps (from `pipeline_events`)
- **Activity log:** notes and manual entries, newest first
- **Quick actions:** Move stage / Add note / Archive

### Suppression
- `Dead` stage: hidden from pipeline views by default. Reappear in search results (so user can see company has been approached). Appear in pipeline only via "Show Dead" toggle.
- `Won` stage: hidden from active pipeline. Shown in a separate "Clients" filtered view.
- Archived leads: fully removed from default views. Recoverable via search.

---

## 7. Search & Discovery

### Search flow
1. User enters query + optional filters, submits
2. Next.js writes a `scrape_jobs` row (`status = queued`, `query`, `filters`)
3. Scraper picks it up, fans out to all relevant sources in parallel, writes results to DB as they arrive
4. Next.js polls `scrape_jobs` every 2s; as results land in DB, the UI updates progressively
5. Companies appear first (fast), contacts fill in as the waterfall completes (slower)
6. Job is marked `done` when all scrapers and waterfall steps have completed or timed out per-source

### Search query parsing
Free text is used as-is for board keyword searches. The scraper does not parse intent — it passes the query string directly to each job board's search. Structured filters are applied as post-scrape filters on the returned results.

### Structured filters
- Country: UK / NL / Both
- Sector: dropdown (Finance, HR, Operations, Logistics, Legal, Technology, Other)
- Company size: Small (10–50) / Mid (50–500) / Large (500+)
- Role type: Interim / Temp / Contract / Any
- Date posted: Today / This week / This month / Any

### Filters JSONB schema
Both `saved_searches.filters` and `scrape_jobs.filters` use the same structure. This is the canonical contract shared between Next.js and the scraper:
```json
{
  "country": "uk" | "nl" | "both",
  "sector": "finance" | "hr" | "operations" | "logistics" | "legal" | "technology" | "other" | null,
  "size_band": "small" | "mid" | "large" | null,
  "role_type": "interim" | "temp" | "contract" | null,
  "date_posted": "today" | "week" | "month" | null
}
```
All fields are optional (null = no filter applied). Unknown keys are ignored.

### Saved searches (ICP templates)
- User can name and save any search query + filter combination
- Saved searches appear as one-click shortcuts above the search bar
- Stored in `saved_searches` table
- Used as the trigger for optional scheduled scans

### Scheduled scanning (opt-in, off by default)
- Enabled in Settings per saved search
- User picks a time of day and days of week
- On schedule: scraper service triggers the saved search automatically, deposits results as `New` leads in pipeline
- Implemented as a cron expression stored on `saved_searches` (`schedule_cron` field, nullable)
- Scraper service evaluates due schedules on startup and every 15 minutes

---

## 8. Data Model

```sql
-- Core entities
CREATE TABLE companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  domain      text UNIQUE NOT NULL,         -- canonical, normalised
  size_band   text,                         -- 'small' | 'mid' | 'large'
  sector      text,
  country     text,                         -- 'uk' | 'nl'
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE job_signals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid REFERENCES companies(id),
  title          text,
  seniority      text,                      -- 'director' | 'head' | 'manager' | 'other'
  contract_type  text,                      -- 'interim' | 'temp' | 'contract'
  board          text,                      -- source board name
  posted_date    date,
  raw_snippet    text,
  boards_count   int DEFAULT 1,             -- how many boards posted same role
  scrape_job_id  uuid REFERENCES scrape_jobs(id),
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid REFERENCES companies(id),
  name          text,
  title         text,
  persona_type  text,                       -- 'hiring_manager' | 'agency_selector'
  email         text,
  smtp_verified boolean DEFAULT false,
  confidence    text,                       -- 'high' | 'medium' | 'low'
  source        text,                       -- 'companies_house' | 'website' | 'google' | 'press'
  found_at      timestamptz DEFAULT now()
);

CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) UNIQUE,
  score           int DEFAULT 0,
  stage           text DEFAULT 'new',       -- pipeline stage enum
  is_suppressed   boolean DEFAULT false,    -- true when archived
  created_at      timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now()
);

CREATE TABLE pipeline_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid REFERENCES leads(id),
  from_stage  text,
  to_stage    text,
  note        text,
  created_at  timestamptz DEFAULT now()
);

-- Search infrastructure
CREATE TABLE saved_searches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  query           text,
  filters         jsonb DEFAULT '{}',
  schedule_cron   text,                     -- null = not scheduled
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE scrape_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query          text,
  filters        jsonb DEFAULT '{}',
  status         text DEFAULT 'queued',     -- 'queued' | 'running' | 'done' | 'failed'
  started_at     timestamptz,
  completed_at   timestamptz,
  updated_at     timestamptz DEFAULT now(), -- used to detect stalled jobs
  result_count   int DEFAULT 0,
  error          text,                      -- populated on failure
  created_at     timestamptz DEFAULT now()
);
```

**Key relationships:**
- One company → many job_signals, many contacts, one lead
- One lead → many pipeline_events
- One scrape_job → many job_signals (via scrape_job_id)
- Scores live on `leads.score` — recomputed and updated each time a search surfaces a company

**Stalled job detection:**
Next.js checks: if `status = 'running'` AND `updated_at < now() - interval '3 minutes'` → mark `failed`, show error to user.

---

## 9. What Replaces the Original Spec

| Original item | Status | Reason |
|---|---|---|
| Salesforce integration | Post-MVP | Too complex. Add later. |
| Gmail OAuth / email sending | Post-MVP | Focus on finding leads first. |
| Apollo.io enrichment | Optional later | Free waterfall covers most cases. |
| SerpAPI only for job scraping | Replaced | 10-source multi-board scraper. |
| 100-point flat SF-dependent scoring | Replaced | Recency-decay scoring, self-contained. |
| Single contact per company | Replaced | 2–3 contacts, two personas. |
| Mandatory 7am daily cron | Replaced | Search-triggered default, opt-in schedule. |

---

## 10. Out of Scope (Post-MVP)

- CRM sync (Salesforce, HubSpot)
- Email sending and sequence automation
- Paid enrichment API layer (Apollo, Hunter)
- Mobile UI
- Multi-tenant / team accounts
- AI-personalised email drafting
- Analytics dashboard
- CSV export / bulk import
- Customisable pipeline stage names
