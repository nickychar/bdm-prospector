# Codebase Compatibility Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the scraper and Next.js app so they share types, remove dead code, and settle all foundational inconsistencies.

**Architecture:** Two independent deployed services (Next.js on Vercel, scraper on Railway) sharing a Supabase database. We add a `shared/` directory at the repo root for shared enums, clean up the scraper to only its HTTP-server role, and add basic env validation + linting fixes.

**Tech Stack:** TypeScript 5, Next.js 16, Express 5, Supabase, Vitest

---

## File Structure

### New files
- `shared/db-enums.ts` — Single source of truth for all database enums
- `.nvmrc` — Pins Node 20 at repo root
- `src/lib/env.ts` — Next.js env validation
- `scraper/src/env.ts` — Scraper env validation
- `supabase/README.md` — One-paragraph note that migrations are source of truth

### Modified files
- `package.json` — Add `engines` field
- `tsconfig.json` — Add `@shared/*` path alias
- `scraper/tsconfig.json` — Add `@shared/*` path alias
- `scraper/package.json` — Add `@shared/*` path mapping (for tsx runtime)
- `scraper/src/types.ts` — Import enums from shared, remove local duplicates
- `scraper/src/index.ts` — Gut dead code, keep only HTTP server startup
- `scraper/src/server.ts` — Import env validation
- `src/types/database.ts` — Import enums from shared, use in type definitions
- `src/lib/supabase/client.ts` — Import validated env vars
- `src/lib/supabase/server.ts` — Import validated env vars
- `eslint.config.mjs` — Add `scraper/**` to globalIgnores

### Deleted files
- `supabase/schema.sql`
- `scraper/src/queue/poller.ts`
- `scraper/src/queue/poller.test.ts`
- `scraper/src/queue/timeout-checker.ts`
- `scraper/src/queue/timeout-checker.test.ts`
- `scraper/src/scoring/compute.ts`
- `scraper/src/scoring/compute.test.ts`
- `scraper/src/scoring/upsert-lead.ts`
- `scraper/src/scoring/upsert-lead.test.ts`
- `scraper/src/scoring/score-band.ts`
- `scraper/src/scoring/score-band.test.ts`
- `scraper/src/contacts/confidence.ts`
- `scraper/src/contacts/confidence.test.ts`
- `scraper/src/contacts/contact-dedup.ts`
- `scraper/src/contacts/contact-dedup.test.ts`
- `scraper/src/contacts/email-patterns.ts`
- `scraper/src/contacts/email-patterns.test.ts`
- `scraper/src/contacts/persona.ts`
- `scraper/src/contacts/persona.test.ts`
- `scraper/src/contacts/types.ts`
- `scraper/src/contacts/waterfall.ts`
- `scraper/src/contacts/waterfall.test.ts`
- `scraper/src/contacts/steps/companies-house.ts`
- `scraper/src/contacts/steps/companies-house.test.ts`
- `scraper/src/contacts/steps/google-search.ts`
- `scraper/src/contacts/steps/kvk.ts`
- `scraper/src/contacts/steps/kvk.test.ts`
- `scraper/src/contacts/steps/smtp-verify.ts`
- `scraper/src/contacts/steps/smtp-verify.test.ts`
- `scraper/src/contacts/steps/website.ts`
- `scraper/src/contacts/steps/website.test.ts`
- `scraper/src/db/companies.ts`
- `scraper/src/db/companies.test.ts`
- `scraper/src/db/contacts.ts`
- `scraper/src/db/contacts.test.ts`
- `scraper/src/db/job-signals.ts`
- `scraper/src/db/job-signals.test.ts`
- `scraper/src/db/client.test.ts`

---

## Chunk 1: Shared Enums + Type Alignment

### Task 1: Create shared enum file

**Files:**
- Create: `shared/db-enums.ts`

- [ ] **Step 1: Create `shared/db-enums.ts`**

```ts
// shared/db-enums.ts
// Single source of truth for database enums used by both the Next.js app and the scraper.

export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type PipelineStage = 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'proposal_sent' | 'won' | 'dead'

// Union of all sources that either service can write
export type ContactSource =
  | 'salesforce' | 'apollo' | 'hunter' | 'manual'   // web app sources
  | 'kvk' | 'companies_house' | 'google' | 'website' | 'press'  // scraper sources

export type CompanySource = 'salesforce' | 'manual' | 'scraped'
export type JobPostSource = 'serpapi' | 'manual'
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'
export type EmailDraftStatus = 'draft' | 'sent' | 'opened' | 'replied' | 'bounced'
```

- [ ] **Step 2: Commit**

```bash
git add shared/db-enums.ts
git commit -m "feat: add shared/db-enums.ts as single source of truth for DB enums"
```

### Task 2: Wire shared enums into Next.js tsconfig

**Files:**
- Modify: `tsconfig.json:22-27` (paths section)

- [ ] **Step 1: Add `@shared/*` path alias to `tsconfig.json`**

In the `paths` object (line 23), add a new entry:

```json
"paths": {
  "@/*": ["./src/*"],
  "@shared/*": ["./shared/*"]
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add @shared/* path alias to root tsconfig"
```

### Task 3: Wire shared enums into scraper tsconfig

**Files:**
- Modify: `scraper/tsconfig.json` (add paths)

- [ ] **Step 1: Add path alias and baseUrl to `scraper/tsconfig.json`**

The scraper uses `NodeNext` module resolution. TypeScript path aliases require `baseUrl`. Update to:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "../shared"]
}
```

Note: `tsx` (the dev runner) handles path aliases from tsconfig automatically. For `tsc` build output, the scraper's `build` script compiles to `dist/` — we need to add `tsc-alias` or use relative imports at build time. Since the scraper uses `tsx watch` for dev and the build runs `tsc`, the simplest approach is to use **relative imports** in the scraper source (e.g., `../shared/db-enums.js`) and skip the alias there. This avoids adding a build dependency.

**Revised approach:** Don't add paths to scraper tsconfig. Instead, have the scraper import with relative paths (`../../shared/db-enums.js`). Update only the `include` to cover `../shared`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "..",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "../shared"]
}
```

Wait — changing `rootDir` to `..` would change the output structure. Better approach: keep `rootDir` as `src`, and have the scraper's `types.ts` re-export from a relative path. This way the build stays clean:

**Final approach for scraper:** In `scraper/src/types.ts`, import and re-export the shared enums using a relative path. The scraper `tsconfig` adds `../shared` to `include` so tsc type-checks it, but the actual import uses a relative path that works with both `tsx` and compiled output.

```json
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

The scraper's `src/types.ts` will copy-paste the enum types from shared (with a comment pointing to the source of truth) rather than importing across project boundaries. This is pragmatic — the enums change rarely and the alternative requires build tool changes.

- [ ] **Step 2: Commit**

```bash
git add scraper/tsconfig.json
git commit -m "chore: update scraper tsconfig include for shared types"
```

### Task 4: Update `src/types/database.ts` to use shared enums

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add imports from shared and replace hardcoded string unions**

Add at top of file:

```ts
import type {
  ContactSource,
  CompanySource,
  JobPostSource,
  LeadStatus,
  EmailDraftStatus,
} from '@shared/db-enums'
```

Replace these hardcoded unions throughout the file:
- `'salesforce' | 'manual' | 'scraped'` → `CompanySource` (lines 161, 175, 189)
- `'salesforce' | 'apollo' | 'hunter' | 'manual'` → `ContactSource` (lines 209, 227)
- `'salesforce' | 'apollo' | 'manual'` → `ContactSource` (line 245 — this was a bug, missing 'hunter')
- `'serpapi' | 'manual'` → `JobPostSource` (lines 261, 274, 287)
- `'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'` → `LeadStatus` (lines 304, 319, 334)
- `'draft' | 'sent' | 'opened' | 'replied' | 'bounced'` → `EmailDraftStatus` (lines 350, 367, 384)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "refactor: use shared enums in database.ts instead of hardcoded unions"
```

### Task 5: Update scraper `types.ts` to align with shared enums

**Files:**
- Modify: `scraper/src/types.ts`

- [ ] **Step 1: Replace local enum definitions with copies from shared**

Replace lines 1-9 of `scraper/src/types.ts` with:

```ts
// These types mirror shared/db-enums.ts (the single source of truth).
// We duplicate rather than import to avoid cross-project build complexity.
// If you change an enum here, update shared/db-enums.ts too.
export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource =
  | 'salesforce' | 'apollo' | 'hunter' | 'manual'
  | 'kvk' | 'companies_house' | 'google' | 'website' | 'press'
export type PipelineStage = 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'proposal_sent' | 'won' | 'dead'
```

Remove `ScrapeJobStatus` (dead code after queue removal).

- [ ] **Step 2: Remove `ScrapeJob` interface** (lines 19-30, dead after queue removal)

Keep only `SearchFilters`, `RawJobResult`, and `DedupedJobResult`.

- [ ] **Step 3: Verify scraper compiles**

Run: `cd scraper && npx tsc --noEmit`
Expected: Errors about missing imports (queue/scoring/contacts) — expected, we delete those in Task 7.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/types.ts
git commit -m "refactor: align scraper enums with shared/db-enums.ts"
```

---

## Chunk 2: Delete Dead Code

### Task 6: Delete legacy schema.sql

**Files:**
- Delete: `supabase/schema.sql`
- Create: `supabase/README.md`

- [ ] **Step 1: Delete `supabase/schema.sql`**

```bash
rm supabase/schema.sql
```

- [ ] **Step 2: Create `supabase/README.md`**

```md
# Supabase

Database migrations in `migrations/` are the source of truth for the schema. Run them in order. Do not use `schema.sql` (deleted — it was a legacy snapshot that diverged from migrations).
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql supabase/README.md
git commit -m "chore: delete stale schema.sql, add README pointing to migrations"
```

### Task 7: Delete dead scraper modules (queue, scoring, contacts, db layer)

**Files:**
- Delete: All files listed in "Deleted files" section above

- [ ] **Step 1: Delete queue directory**

```bash
rm -rf scraper/src/queue
```

- [ ] **Step 2: Delete scoring directory**

```bash
rm -rf scraper/src/scoring
```

- [ ] **Step 3: Delete contacts directory**

```bash
rm -rf scraper/src/contacts
```

- [ ] **Step 4: Delete scraper DB modules** (companies, contacts, job-signals — only keep client.ts)

```bash
rm scraper/src/db/companies.ts scraper/src/db/companies.test.ts
rm scraper/src/db/contacts.ts scraper/src/db/contacts.test.ts
rm scraper/src/db/job-signals.ts scraper/src/db/job-signals.test.ts
rm scraper/src/db/client.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead queue, scoring, contacts, and DB write modules from scraper"
```

### Task 8: Rewrite `scraper/src/index.ts` as HTTP-only entrypoint

**Files:**
- Modify: `scraper/src/index.ts`

- [ ] **Step 1: Replace entire file with minimal HTTP server startup**

```ts
import 'dotenv/config'
import './env.js'  // validate env vars on startup (created in Task 11)
import { createServer } from './server.js'

const port = parseInt(process.env.PORT ?? '3002', 10)

createServer().listen(port, () => {
  console.log(`Scraper HTTP server listening on port ${port}`)
})
```

- [ ] **Step 2: Verify scraper compiles**

Run: `cd scraper && npx tsc --noEmit`
Expected: Error about missing `./env.js` — expected, we create it in Task 11. All other errors should be gone.

- [ ] **Step 3: Commit**

```bash
git add scraper/src/index.ts
git commit -m "refactor: simplify scraper entrypoint to HTTP-only server"
```

### Task 9: Clean up `scraper/src/server.ts` comment

**Files:**
- Modify: `scraper/src/server.ts:2`

- [ ] **Step 1: Update the file comment**

Change line 2 from:
```ts
// HTTP server for synchronous scan requests from the web app.
// Runs alongside the queue poller in the same process.
```
to:
```ts
// HTTP server for scan requests from the web app.
```

- [ ] **Step 2: Commit**

```bash
git add scraper/src/server.ts
git commit -m "chore: remove stale queue reference from server.ts comment"
```

---

## Chunk 3: Node Version + Env Validation + ESLint

### Task 10: Pin Node version at repo root

**Files:**
- Create: `.nvmrc`
- Modify: `package.json:1-5`

- [ ] **Step 1: Create `.nvmrc` at project root**

```
20
```

- [ ] **Step 2: Add `engines` to root `package.json`**

After `"private": true,` (line 4), add:

```json
"engines": { "node": ">=20" },
```

- [ ] **Step 3: Commit**

```bash
git add .nvmrc package.json
git commit -m "chore: pin Node >=20 at repo root via .nvmrc and engines"
```

### Task 11: Add scraper env validation

**Files:**
- Create: `scraper/src/env.ts`

- [ ] **Step 1: Create `scraper/src/env.ts`**

```ts
// Validates required environment variables on startup.
// Import this module early in index.ts (side-effect import).

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SCRAPER_KEY'] as const
const optional = ['PORT'] as const

const missing = required.filter(key => !process.env[key])
if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`)
}

for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`[env] Optional var ${key} is not set`)
  }
}
```

- [ ] **Step 2: Verify scraper compiles**

Run: `cd scraper && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add scraper/src/env.ts
git commit -m "feat: add startup env validation for scraper service"
```

### Task 12: Add Next.js env validation

**Files:**
- Create: `src/lib/env.ts`
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/server.ts`

- [ ] **Step 1: Create `src/lib/env.ts`**

```ts
// Validates environment variables used by the Next.js app.
// Server-only vars are checked lazily (they're undefined in browser context).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Server-side only — check these lazily in server actions, not at module load
export function requireServerEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing server env var: ${key}`)
  return val
}
```

- [ ] **Step 2: Update `src/lib/supabase/client.ts` to use validated env**

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}
```

- [ ] **Step 3: Update `src/lib/supabase/server.ts` to use validated env**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll called from Server Component — can be ignored
        }
      },
    },
  })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "feat: add env validation for Next.js app, use in Supabase clients"
```

### Task 13: Fix ESLint config to ignore scraper

**Files:**
- Modify: `eslint.config.mjs:9-15`

- [ ] **Step 1: Add `scraper/**` to globalIgnores**

Update the `globalIgnores` call to include `scraper/**`:

```js
globalIgnores([
  // Default ignores of eslint-config-next:
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  // Scraper has its own project config:
  "scraper/**",
  // Shared types (no lint rules needed):
  "shared/**",
]),
```

- [ ] **Step 2: Verify lint runs without errors**

Run: `npx eslint .`
Expected: No errors from scraper files

- [ ] **Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: exclude scraper/ and shared/ from Next.js ESLint config"
```

---

## Chunk 4: Verify Everything Works

### Task 14: Full build verification

- [ ] **Step 1: Verify Next.js TypeScript**

Run: `npx tsc --noEmit`
Expected: Clean — no errors

- [ ] **Step 2: Verify scraper TypeScript**

Run: `cd scraper && npx tsc --noEmit`
Expected: Clean — no errors

- [ ] **Step 3: Run scraper tests**

Run: `cd scraper && npx vitest run`
Expected: All remaining tests pass (normalise, scrapers). Tests for deleted modules are gone.

- [ ] **Step 4: Verify ESLint**

Run: `npx eslint .`
Expected: No errors

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any remaining build issues from cleanup"
```
