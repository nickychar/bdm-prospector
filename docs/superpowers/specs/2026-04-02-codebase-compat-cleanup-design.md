# Codebase Compatibility & Clean Foundation

**Date:** 2026-04-02
**Status:** Approved

## Context

BDM Prospector has two deployed services (Next.js on Vercel, scraper on Railway) sharing a Supabase database. They have diverged in type definitions, carry dead code from an abandoned queue system, and lack basic consistency in Node versioning, env validation, and linting.

Current data is disposable — no migration-safe changes needed.

## Changes

### 1. Enum Alignment + Shared Types

Create `shared/db-enums.ts` at the project root as the single source of truth for database enums used by both apps.

Unified enums:
- `ContactSource`: `'salesforce' | 'apollo' | 'hunter' | 'manual' | 'kvk' | 'companies_house' | 'google' | 'website' | 'press'`
- Plus: `Confidence`, `PersonaType`, `Seniority`, `ContractType`, `PipelineStage`, `SizeBand`

Both `tsconfig.json` files get a `@shared/*` path alias. `src/types/database.ts` and `scraper/src/types.ts` import from shared instead of hardcoding.

### 2. Delete `schema.sql` + Clean Migrations

Delete `supabase/schema.sql` (contradicts migrations, legacy scraper schema). Add a one-paragraph `supabase/README.md` stating migrations are the source of truth.

### 3. Remove Dead Queue Code from Scraper

Delete:
- `scraper/src/queue/` (poller, timeout-checker)
- `scraper/src/scoring/` (compute, upsert-lead)
- `scraper/src/contacts/` (entire waterfall enrichment pipeline — web app uses Hunter.io instead)
- `handleScrapeJob()`, `startPoller()`, `startTimeoutChecker()` from `scraper/src/index.ts`

The scraper becomes a focused HTTP service: receive queries, scrape boards, return results.

### 4. Node Version Alignment

- Add `.nvmrc` with `20` at project root
- Add `"engines": { "node": ">=20" }` to root `package.json`

### 5. Env Validation

- `src/lib/env.ts` — validates required Next.js env vars at import time, warns for optional ones
- `scraper/src/env.ts` — validates required scraper env vars at startup

### 6. ESLint Config Fix

Add `scraper/**` to `globalIgnores` in `eslint.config.mjs`.

## Out of Scope

- Monorepo/workspace restructure (premature)
- Auto-generated Supabase types
- Feature work (email drafts, Hunter integration completeness)
- Test coverage
