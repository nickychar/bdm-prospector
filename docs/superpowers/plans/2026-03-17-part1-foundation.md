# BDM Prospector — Part 1: Foundation

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan.

**Goal:** Scaffold both services, apply the full DB schema, and have a working authenticated Next.js app connected to Supabase.

**Architecture:** Next.js 14 app in `web/`, Node.js scraper service in `scraper/`, shared Supabase project. No monorepo tooling — two independent `package.json` files.

**Tech Stack:** Next.js 14 (App Router), Supabase (Postgres + Auth), Tailwind CSS, shadcn/ui, TypeScript throughout.

---

## File Map

```
bdm-prospector/
├── web/                              # Next.js app
│   ├── app/
│   │   ├── layout.tsx                # root layout
│   │   ├── (auth)/
│   │   │   ├── layout.tsx            # auth layout (no sidebar)
│   │   │   └── login/page.tsx        # email login form
│   │   └── (app)/
│   │       ├── layout.tsx            # app layout (sidebar + auth guard)
│   │       ├── search/page.tsx       # placeholder
│   │       └── pipeline/page.tsx     # placeholder
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # browser Supabase client
│   │   │   └── server.ts             # server Supabase client (for RSC + route handlers)
│   │   └── types.ts                  # DB types matching schema
│   ├── middleware.ts                  # auth redirect middleware
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.ts
├── scraper/
│   ├── src/
│   │   ├── index.ts                  # entry point (placeholder for now)
│   │   ├── db/
│   │   │   └── client.ts             # Supabase service-role client
│   │   └── types.ts                  # shared DB types
│   ├── package.json
│   └── tsconfig.json
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql    # all core tables
        └── 002_normalisation_misses.sql
```

---

## Chunk 1: Supabase Schema

### Task 1: Create Supabase project + write migrations

**Prerequisites (manual steps before running any code):**
1. Go to https://supabase.com → New project → name it `bdm-prospector`
2. Save: Project URL, anon key, service role key
3. Install Supabase CLI: `brew install supabase/tap/supabase`

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_normalisation_misses.sql`

- [ ] **Step 1: Write migration 001**

```sql
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
```

- [ ] **Step 2: Write migration 002**

```sql
-- supabase/migrations/002_normalisation_misses.sql

create table normalisation_misses (
  id         uuid primary key default gen_random_uuid(),
  board      text not null,
  raw_term   text not null,
  field      text not null check (field in ('contract_type','seniority')),
  created_at timestamptz default now()
);

create index on normalisation_misses (field, raw_term);
```

- [ ] **Step 3: Apply migrations**

From project root:
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Expected: `Applying migration 001_initial_schema.sql... done` and `002_normalisation_misses.sql... done`

- [ ] **Step 4: Verify in Supabase dashboard**

Open Table Editor — confirm all 8 tables exist with correct columns.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema migrations"
```

---

## Chunk 2: Next.js App Scaffold

### Task 2: Create and configure the Next.js app

**Files:**
- Create: `web/` (entire directory)
- Create: `web/lib/supabase/client.ts`
- Create: `web/lib/supabase/server.ts`
- Create: `web/lib/types.ts`
- Create: `web/middleware.ts`

- [ ] **Step 1: Scaffold Next.js app**

> **Note:** This pins to Next.js 14 intentionally. `@supabase/ssr` patterns in this plan are written for Next 14's sync cookie API. Do not upgrade to Next 15 without reviewing the SSR client — the cookie API changed.

From project root:
```bash
npx create-next-app@14 web \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-git
```

- [ ] **Step 2: Install dependencies**

```bash
cd web
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
# Choose: Default style, Slate base colour, CSS variables: yes
npx shadcn@latest add button input label card badge separator tabs
```

- [ ] **Step 4: Create `.env.local`**

```bash
# web/.env.local  (never commit this file)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Add `web/.env.local` to `.gitignore`.

- [ ] **Step 5: Write Supabase browser client**

```typescript
// web/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Write Supabase server client**

```typescript
// web/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // ignore in RSC
        },
      },
    }
  )
}
```

- [ ] **Step 7: Write shared DB types**

```typescript
// web/lib/types.ts
export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource = 'companies_house' | 'kvk' | 'website' | 'google' | 'press'
export type PipelineStage =
  | 'new' | 'contacted' | 'replied' | 'meeting_booked'
  | 'proposal_sent' | 'won' | 'dead'
export type ScrapeJobStatus = 'queued' | 'running' | 'done' | 'failed'

export const PIPELINE_STAGES: PipelineStage[] = [
  'new', 'contacted', 'replied', 'meeting_booked',
  'proposal_sent', 'won', 'dead',
]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting_booked: 'Meeting Booked',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  dead: 'Dead',
}

export interface Company {
  id: string
  name: string
  domain: string
  size_band: SizeBand | null
  sector: string | null
  country: Country | null
  created_at: string
  updated_at: string
}

export interface JobSignal {
  id: string
  company_id: string
  scrape_job_id: string | null
  title: string | null
  seniority: Seniority | null
  contract_type: ContractType | null
  board: string | null
  posted_date: string | null
  raw_snippet: string | null
  boards_count: number
  created_at: string
}

export interface Contact {
  id: string
  company_id: string
  name: string | null
  title: string | null
  persona_type: PersonaType | null
  email: string | null
  smtp_verified: boolean
  confidence: Confidence | null
  source: ContactSource | null
  found_at: string
}

export interface Lead {
  id: string
  company_id: string
  score: number
  stage: PipelineStage
  is_suppressed: boolean
  created_at: string
  last_activity_at: string
}

export interface PipelineEvent {
  id: string
  lead_id: string
  from_stage: PipelineStage | null
  to_stage: PipelineStage | null
  note: string | null
  created_at: string
}

export interface SavedSearch {
  id: string
  name: string
  query: string | null
  filters: SearchFilters
  schedule_cron: string | null
  created_at: string
}

export interface ScrapeJob {
  id: string
  query: string | null
  filters: SearchFilters
  status: ScrapeJobStatus
  started_at: string | null
  completed_at: string | null
  updated_at: string
  result_count: number
  error: string | null
  created_at: string
}

export interface SearchFilters {
  country?: 'uk' | 'nl' | 'both' | null
  sector?: string | null
  size_band?: SizeBand | null
  role_type?: 'interim' | 'temp' | 'contract' | null
  date_posted?: 'today' | 'week' | 'month' | null
}

// Enriched types for UI (joins)
export interface LeadWithCompany extends Lead {
  company: Company
  contacts: Contact[]
  job_signals: JobSignal[]
  pipeline_events?: PipelineEvent[]
}
```

- [ ] **Step 8: Write auth middleware**

```typescript
// web/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login')
  // /auth/callback must be reachable without a session — it's how magic link completes
  const isCallback = pathname.startsWith('/auth')

  if (!user && !isAuthRoute && !isCallback) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/search', request.url))
  }

  return supabaseResponse
}

export const config = {
  // Exclude static assets, images, favicon, API routes, and auth callback
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth).*)'],
}
```

- [ ] **Step 9: Commit**

```bash
cd ..
git add web/
git commit -m "feat: scaffold Next.js app with Supabase auth and types"
```

---

### Task 3: Auth pages and app shell

**Files:**
- Create: `web/app/layout.tsx`
- Create: `web/app/(auth)/layout.tsx`
- Create: `web/app/(auth)/login/page.tsx`
- Create: `web/app/(app)/layout.tsx`
- Create: `web/app/(app)/search/page.tsx`
- Create: `web/app/(app)/pipeline/page.tsx`

- [ ] **Step 1: Root layout**

```tsx
// web/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BDM Prospector',
  description: 'Find interim hiring companies and contacts',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Auth layout (centred, no nav)**

```tsx
// web/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Login page**

```tsx
// web/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/search` },
    })
    if (!error) setSent(true)
    setLoading(false)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">BDM Prospector</CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Check your email for a magic link.
          </p>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: App layout with nav**

```tsx
// web/app/(app)/layout.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-sm">BDM Prospector</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/search" className="text-muted-foreground hover:text-foreground">Search</Link>
          <Link href="/pipeline" className="text-muted-foreground hover:text-foreground">Pipeline</Link>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Placeholder pages**

```tsx
// web/app/(app)/search/page.tsx
export default function SearchPage() {
  return <div className="text-muted-foreground text-sm">Search — coming in Part 6</div>
}
```

```tsx
// web/app/(app)/pipeline/page.tsx
export default function PipelinePage() {
  return <div className="text-muted-foreground text-sm">Pipeline — coming in Part 5</div>
}
```

- [ ] **Step 6: Smoke test — run dev server**

```bash
cd web && npm run dev
```

Expected:
- `http://localhost:3000` → redirects to `/login`
- Login form renders
- After magic link → lands on `/search` showing placeholder

- [ ] **Step 7: Commit**

```bash
git add web/app/
git commit -m "feat: add auth flow and app shell with placeholder pages"
```

---

## Chunk 3: Scraper Service Scaffold

### Task 4: Bootstrap the scraper service

**Files:**
- Create: `scraper/package.json`
- Create: `scraper/tsconfig.json`
- Create: `scraper/src/index.ts`
- Create: `scraper/src/db/client.ts`
- Create: `scraper/src/types.ts`
- Create: `scraper/.env`

- [ ] **Step 1: Init scraper package**

```bash
cd ../scraper
npm init -y
npm install @supabase/supabase-js dotenv
npm install -D typescript tsx vitest @types/node
```

- [ ] **Step 2: tsconfig**

```json
// scraper/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: package.json scripts**

```json
// scraper/package.json (scripts section only — merge with existing)
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Env file**

```bash
# scraper/.env  (never commit)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Add `scraper/.env` to root `.gitignore`.

- [ ] **Step 5: Supabase DB client**

> **Security note:** This file uses the service role key and must never be imported by browser code or API routes served to the public. It is backend-only.

```typescript
// scraper/src/db/client.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

export const db = createClient(url, key, {
  auth: { persistSession: false },
})
```

- [ ] **Step 6: Shared types (mirrors web/lib/types.ts)**

```typescript
// scraper/src/types.ts
export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource = 'companies_house' | 'kvk' | 'website' | 'google' | 'press'
export type PipelineStage = 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'proposal_sent' | 'won' | 'dead'
export type ScrapeJobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface SearchFilters {
  country?: 'uk' | 'nl' | 'both' | null
  sector?: string | null
  size_band?: SizeBand | null
  role_type?: 'interim' | 'temp' | 'contract' | null
  date_posted?: 'today' | 'week' | 'month' | null
}

export interface ScrapeJob {
  id: string
  query: string | null
  filters: SearchFilters
  status: ScrapeJobStatus
  started_at: string | null
  completed_at: string | null
  updated_at: string
  result_count: number
  error: string | null
  created_at: string
}

export interface RawJobResult {
  companyName: string
  companyDomain: string | null
  jobTitle: string
  board: string
  postedDate: string | null
  snippet: string | null
  contractTypeRaw: string | null
  seniorityRaw: string | null
}
```

- [ ] **Step 7: Entry point**

```typescript
// scraper/src/index.ts
import 'dotenv/config'
import { db } from './db/client.js'

async function main() {
  // Verify DB connection
  const { error } = await db.from('scrape_jobs').select('id').limit(1)
  if (error) throw new Error(`DB connection failed: ${error.message}`)
  console.log('Scraper service started. DB connection OK.')
  // Queue poller added in Part 2
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 8: Test DB connection**

```bash
cd scraper && npm run dev
```

Expected: `Scraper service started. DB connection OK.`

- [ ] **Step 9: Write connection test**

```typescript
// scraper/src/db/client.test.ts
import { describe, it, expect } from 'vitest'
import { db } from './client.js'

describe('db client', () => {
  it('connects and can query scrape_jobs', async () => {
    const { error } = await db.from('scrape_jobs').select('id').limit(1)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 10: Add vitest config to scraper**

```typescript
// scraper/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 11: Run test**

```bash
npm test
```

Expected: `1 passed`

- [ ] **Step 12: Commit**

```bash
cd ..
git add scraper/
git commit -m "feat: scaffold scraper service with Supabase connection"
```

---

## Chunk 4: Vitest config for Next.js

### Task 5: Configure tests for the web app

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/vitest.setup.ts`

- [ ] **Step 1: Write vitest config**

```typescript
// web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 2: Write setup file**

```typescript
// web/vitest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Add test script to package.json**

In `web/package.json`, ensure:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Write a smoke test for types**

```typescript
// web/lib/types.test.ts
import { describe, it, expect } from 'vitest'
import { PIPELINE_STAGES, STAGE_LABELS } from './types'

describe('types', () => {
  it('has 7 pipeline stages', () => {
    expect(PIPELINE_STAGES).toHaveLength(7)
  })

  it('has a label for every stage', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(STAGE_LABELS[stage]).toBeTruthy()
    })
  })
})
```

- [ ] **Step 5: Run tests**

```bash
cd web && npm test
```

Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add web/vitest.config.ts web/vitest.setup.ts web/lib/types.test.ts web/package.json
git commit -m "feat: configure vitest for Next.js web app"
```

---

## Part 1 Complete ✅

**What you now have:**
- Supabase schema applied with all 8 tables + indexes
- Next.js 14 app with Supabase auth (magic link), middleware redirect, app shell
- Scraper service bootstrapped, connected to DB, tested
- Vitest configured for both services
- All placeholder pages in place for Parts 2–6

**Env files needed (never committed):**
- `web/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `scraper/.env` — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Next:** Part 2 — Scraper Service Core (queue poller, normalisation, job board scrapers)
