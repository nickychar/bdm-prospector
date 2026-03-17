# BDM Prospector — Part 4: Scoring Engine

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute a 0–100 score for each lead from raw job signals and contacts, write it atomically to the `leads` table via a Postgres function, and call it from the scraper after the contact waterfall completes.

**Architecture:** A pure TypeScript `computeScore()` function fully documents and tests the scoring rules. A Postgres function `upsert_lead_score(p_company_id)` performs the actual atomic read-compute-write (locking the company row to prevent last-writer-wins races). The scraper calls `db.rpc('upsert_lead_score')` per company — no TypeScript-level read-compute loop in production. A `getScoreBand()` helper maps raw scores to display tiers.

**Tech Stack:** Node.js + TypeScript, Supabase (Postgres RPC), vitest.

---

## File Map

```
scraper/src/scoring/
├── compute.ts           # computeScore(input) → number — pure, fully tested
├── compute.test.ts
├── score-band.ts        # getScoreBand(score) → ScoreBand — pure, fully tested
├── score-band.test.ts
└── upsert-lead.ts       # upsertLead(companyId) — thin wrapper calling db.rpc()
    upsert-lead.test.ts
supabase/migrations/
└── 005_upsert_lead_score_fn.sql
```

**Modified files:**
- `scraper/src/index.ts` — call `upsertLead(companyId)` after waterfall per company

---

## Chunk 1: Pure Scoring Logic

### Task 1: computeScore — pure scoring function

**Files:**
- Create: `scraper/src/scoring/compute.ts`
- Create: `scraper/src/scoring/compute.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/scoring/compute.test.ts
import { describe, it, expect } from 'vitest'
import { computeScore } from './compute.js'
import type { ScoringInput } from './compute.js'

// Helper: build a signal with today as postedDate by default
function makeSignal(overrides: Partial<ScoringInput['signals'][0]> = {}) {
  return {
    postedDate: new Date().toISOString().split('T')[0], // today
    board: 'reed',
    boardsCount: 1,
    ...overrides,
  }
}

function makeContact(overrides: Partial<ScoringInput['contacts'][0]> = {}) {
  return {
    personaType: 'hiring_manager' as const,
    confidence: 'high' as const,
    smtpVerified: false,
    ...overrides,
  }
}

// Reference date: 2026-03-17 for deterministic tests
const REF = new Date('2026-03-17')

describe('computeScore — recency', () => {
  it('returns 0 for empty signals', () => {
    expect(computeScore({ signals: [], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(0)
  })

  it('scores 30 for signal posted today', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('scores 22 for signal posted 2 days ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-15' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(22)
  })

  it('scores 22 for signal posted 1 day ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-16' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(22)
  })

  it('scores 22 for signal posted 3 days ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-14' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(22)
  })

  it('scores 15 for signal posted 4 days ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-13' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(15)
  })

  it('scores 15 for signal posted 7 days ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-10' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(15)
  })

  it('scores 8 for signal posted 8 days ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-09' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(8)
  })

  it('scores 8 for signal posted 30 days ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-02-15' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(8)
  })

  it('scores 0 for signal posted 31+ days ago', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-02-14' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(0)
  })

  it('uses the most recent signal for recency when multiple signals exist', () => {
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-02-01' }), // old
        makeSignal({ postedDate: '2026-03-17' }), // today
      ],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('ignores signals with null postedDate for recency', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: null })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(0)
  })
})

describe('computeScore — bonuses', () => {
  it('adds +15 for serial poster (3+ signals in last 90 days)', () => {
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-03-17' }),
        makeSignal({ postedDate: '2026-03-10' }),
        makeSignal({ postedDate: '2026-03-03' }),
      ],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    // 30 (today) + 15 (serial)
    expect(computeScore(input)).toBe(45)
  })

  it('does NOT add serial poster bonus for exactly 2 signals in 90 days', () => {
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-03-17' }),
        makeSignal({ postedDate: '2026-03-10' }),
      ],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('serial poster only counts signals within 90 days', () => {
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-03-17' }),
        makeSignal({ postedDate: '2026-03-10' }),
        makeSignal({ postedDate: '2025-12-01' }), // > 90 days ago, excluded
      ],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30) // no serial bonus
  })

  it('serial poster: signal on exactly day 90 IS counted', () => {
    // 2025-12-17 is exactly 90 days before 2026-03-17
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-03-17' }),
        makeSignal({ postedDate: '2026-03-10' }),
        makeSignal({ postedDate: '2025-12-17' }), // exactly 90 days ago — included
      ],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(45) // 30 (today) + 15 (serial)
  })

  it('serial poster: signal on day 91 is NOT counted', () => {
    // 2025-12-16 is 91 days before 2026-03-17
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-03-17' }),
        makeSignal({ postedDate: '2026-03-10' }),
        makeSignal({ postedDate: '2025-12-16' }), // 91 days ago — excluded
      ],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30) // no serial bonus
  })

  it('adds +8 for Flexmarkt signal', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17', board: 'flexmarkt' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(38) // 30 + 8
  })

  it('does NOT add Flexmarkt bonus for non-Flexmarkt board', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17', board: 'reed' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('adds +5 for multi-board (boardsCount >= 3 on most recent signal)', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17', boardsCount: 3 })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(35) // 30 + 5
  })

  it('does NOT add multi-board bonus for boardsCount = 2 on most recent signal', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17', boardsCount: 2 })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('checks boardsCount only on the most recent signal, not older ones', () => {
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-03-17', boardsCount: 1 }), // most recent — no multi-board
        makeSignal({ postedDate: '2026-03-10', boardsCount: 5 }), // older — ignored for this bonus
      ],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30) // no multi-board bonus
  })
})

describe('computeScore — contact bonuses', () => {
  it('adds +10 for hiring manager contact with high confidence', () => {
    const input: ScoringInput = {
      signals: [],
      contacts: [makeContact({ personaType: 'hiring_manager', confidence: 'high' })],
      stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10)
  })

  it('adds +10 for hiring manager contact with medium confidence', () => {
    const input: ScoringInput = {
      signals: [],
      contacts: [makeContact({ personaType: 'hiring_manager', confidence: 'medium' })],
      stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10)
  })

  it('does NOT add hiring manager bonus for low confidence', () => {
    const input: ScoringInput = {
      signals: [],
      contacts: [makeContact({ personaType: 'hiring_manager', confidence: 'low' })],
      stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(0)
  })

  it('adds +10 for agency selector contact (non-low confidence)', () => {
    const input: ScoringInput = {
      signals: [],
      contacts: [makeContact({ personaType: 'agency_selector', confidence: 'medium' })],
      stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10)
  })

  it('adds both HM and AS bonuses when both present', () => {
    const input: ScoringInput = {
      signals: [],
      contacts: [
        makeContact({ personaType: 'hiring_manager', confidence: 'high' }),
        makeContact({ personaType: 'agency_selector', confidence: 'medium' }),
      ],
      stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(20)
  })

  it('adds +5 for SMTP verified contact', () => {
    const input: ScoringInput = {
      signals: [],
      contacts: [makeContact({ smtpVerified: true })],
      stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(15) // +10 HM + +5 SMTP
  })

  it('does NOT add SMTP bonus when no contact is smtp_verified', () => {
    const input: ScoringInput = {
      signals: [],
      contacts: [makeContact({ smtpVerified: false })],
      stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10) // just HM bonus
  })

  it('adds +5 for company size mid', () => {
    const input: ScoringInput = {
      signals: [], contacts: [], stage: null, sizeBand: 'mid', referenceDate: REF,
    }
    expect(computeScore(input)).toBe(5)
  })

  it('does NOT add size bonus for small', () => {
    const input: ScoringInput = {
      signals: [], contacts: [], stage: null, sizeBand: 'small', referenceDate: REF,
    }
    expect(computeScore(input)).toBe(0)
  })

  it('does NOT add size bonus for large', () => {
    const input: ScoringInput = {
      signals: [], contacts: [], stage: null, sizeBand: 'large', referenceDate: REF,
    }
    expect(computeScore(input)).toBe(0)
  })
})

describe('computeScore — pipeline penalty', () => {
  it('deducts 20 for stage = contacted', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: 'contacted', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10) // 30 - 20
  })

  it('deducts 20 for stage = replied', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: 'replied', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10)
  })

  it('deducts 20 for stage = meeting_booked', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: 'meeting_booked', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10)
  })

  it('deducts 20 for stage = proposal_sent', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: 'proposal_sent', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(10)
  })

  it('does NOT deduct for stage = new', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: 'new', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('does NOT deduct for stage = won', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: 'won', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('does NOT deduct for stage = dead', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: 'dead', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('does NOT deduct when stage is null', () => {
    const input: ScoringInput = {
      signals: [makeSignal({ postedDate: '2026-03-17' })],
      contacts: [], stage: null, sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(30)
  })

  it('floors score at 0 — never negative', () => {
    // Only penalty, no signals to build positive score
    const input: ScoringInput = {
      signals: [], contacts: [], stage: 'contacted', sizeBand: null, referenceDate: REF,
    }
    expect(computeScore(input)).toBe(0)
  })
})

describe('computeScore — full example', () => {
  it('computes correct total for a high-value lead', () => {
    const input: ScoringInput = {
      signals: [
        makeSignal({ postedDate: '2026-03-17', board: 'flexmarkt', boardsCount: 4 }),
        makeSignal({ postedDate: '2026-03-10' }),
        makeSignal({ postedDate: '2026-03-03' }),
      ],
      contacts: [
        makeContact({ personaType: 'hiring_manager', confidence: 'high', smtpVerified: true }),
        makeContact({ personaType: 'agency_selector', confidence: 'medium' }),
      ],
      stage: null,
      sizeBand: 'mid',
      referenceDate: REF,
    }
    // 30 (today) + 15 (serial) + 8 (flexmarkt) + 5 (multi-board) + 10 (HM) + 10 (AS) + 5 (SMTP) + 5 (mid) = 88
    expect(computeScore(input)).toBe(88)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
cd scraper && npm test -- scoring/compute
```

Expected: `Cannot find module './compute.js'`

- [ ] **Step 3: Implement**

```typescript
// scraper/src/scoring/compute.ts

export interface SignalRow {
  postedDate: string | null   // ISO date 'YYYY-MM-DD'
  board: string
  boardsCount: number
}

export interface ContactRow {
  personaType: 'hiring_manager' | 'agency_selector'
  confidence: 'high' | 'medium' | 'low'
  smtpVerified: boolean
}

export interface ScoringInput {
  signals: SignalRow[]
  contacts: ContactRow[]
  stage: string | null       // current pipeline stage, null if no lead yet
  sizeBand: string | null    // 'small' | 'mid' | 'large'
  referenceDate?: Date       // defaults to today — override in tests for determinism
}

const ACTIVE_STAGES = new Set(['contacted', 'replied', 'meeting_booked', 'proposal_sent'])

export function computeScore(input: ScoringInput): number {
  const today = input.referenceDate ?? new Date()
  let score = 0

  // ── Recency (mutually exclusive — highest applicable wins) ──
  const datedSignals = input.signals
    .filter(s => s.postedDate)
    .map(s => ({ ...s, date: new Date(s.postedDate!) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  if (datedSignals.length > 0) {
    const msPerDay = 1000 * 60 * 60 * 24
    const diffDays = Math.floor(
      (today.getTime() - datedSignals[0].date.getTime()) / msPerDay
    )
    if (diffDays === 0)       score += 30
    else if (diffDays <= 3)   score += 22
    else if (diffDays <= 7)   score += 15
    else if (diffDays <= 30)  score += 8
  }

  // ── Serial poster (+15 if 3+ signals in last 90 days) ──
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const recentCount = input.signals.filter(
    s => s.postedDate && new Date(s.postedDate) >= ninetyDaysAgo
  ).length
  if (recentCount >= 3) score += 15

  // ── Flexmarkt signal (+8) ──
  if (input.signals.some(s => s.board === 'flexmarkt')) score += 8

  // ── Multi-board signal (+5 if most recent signal has boardsCount >= 3) ──
  if (datedSignals.length > 0 && datedSignals[0].boardsCount >= 3) score += 5

  // ── Contact bonuses ──
  const hasHiringManager = input.contacts.some(
    c => c.personaType === 'hiring_manager' && c.confidence !== 'low'
  )
  const hasAgencySelector = input.contacts.some(
    c => c.personaType === 'agency_selector' && c.confidence !== 'low'
  )
  const hasSmtpVerified = input.contacts.some(c => c.smtpVerified)

  if (hasHiringManager)  score += 10
  if (hasAgencySelector) score += 10
  if (hasSmtpVerified)   score += 5

  // ── Company size bonus (+5 for mid-size 50–500) ──
  if (input.sizeBand === 'mid') score += 5

  // ── Pipeline penalty (−20 if in active pipeline) ──
  if (input.stage && ACTIVE_STAGES.has(input.stage)) score -= 20

  return Math.max(0, score)
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- scoring/compute
```

Expected: `42 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/scoring/compute.ts scraper/src/scoring/compute.test.ts
git commit -m "feat: add pure scoring engine with comprehensive tests"
```

---

### Task 2: getScoreBand — score tier helper

**Files:**
- Create: `scraper/src/scoring/score-band.ts`
- Create: `scraper/src/scoring/score-band.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/scoring/score-band.test.ts
import { describe, it, expect } from 'vitest'
import { getScoreBand } from './score-band.js'

describe('getScoreBand', () => {
  it('100 → hot', () => { expect(getScoreBand(100)).toBe('hot') })
  it('70 → hot (lower boundary)', () => { expect(getScoreBand(70)).toBe('hot') })
  it('69 → warm', () => { expect(getScoreBand(69)).toBe('warm') })
  it('45 → warm (lower boundary)', () => { expect(getScoreBand(45)).toBe('warm') })
  it('44 → cold', () => { expect(getScoreBand(44)).toBe('cold') })
  it('20 → cold (lower boundary)', () => { expect(getScoreBand(20)).toBe('cold') })
  it('19 → hidden', () => { expect(getScoreBand(19)).toBe('hidden') })
  it('0 → hidden', () => { expect(getScoreBand(0)).toBe('hidden') })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- score-band
```

Expected: `Cannot find module './score-band.js'`

- [ ] **Step 3: Implement**

```typescript
// scraper/src/scoring/score-band.ts

export type ScoreBand = 'hot' | 'warm' | 'cold' | 'hidden'

export function getScoreBand(score: number): ScoreBand {
  if (score >= 70) return 'hot'
  if (score >= 45) return 'warm'
  if (score >= 20) return 'cold'
  return 'hidden'
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- score-band
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/scoring/score-band.ts scraper/src/scoring/score-band.test.ts
git commit -m "feat: add score band helper with tests"
```

---

## Chunk 2: Postgres Atomic Upsert

### Task 3: Postgres upsert_lead_score function

**Files:**
- Create: `supabase/migrations/005_upsert_lead_score_fn.sql`

> **Why Postgres:** Computing and writing the score in a single Postgres function prevents a race where (1) scraper reads stage = 'new', (2) user moves lead to 'contacted', (3) scraper writes score without penalty. The function uses `FOR UPDATE` on the company row to serialise concurrent calls.

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/005_upsert_lead_score_fn.sql

create or replace function upsert_lead_score(p_company_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_last_post_date    date;
  v_recent_post_count int;
  v_has_flexmarkt     boolean;
  v_most_recent_boards int;
  v_has_hm            boolean;
  v_has_as            boolean;
  v_has_smtp          boolean;
  v_size_band         text;
  v_stage             text;
  v_score             int := 0;
  v_days_since        int;
begin
  -- Lock company row to serialise concurrent score writes for the same company
  perform id from companies where id = p_company_id for update;

  -- ── Step 1: Read job signals ──
  select
    max(posted_date),
    count(*) filter (where posted_date >= current_date - interval '90 days'),
    coalesce(bool_or(board = 'flexmarkt'), false)
  into v_last_post_date, v_recent_post_count, v_has_flexmarkt
  from job_signals
  where company_id = p_company_id;

  -- boards_count from the most recent dated signal
  select boards_count into v_most_recent_boards
  from job_signals
  where company_id = p_company_id
    and posted_date is not null
  order by posted_date desc
  limit 1;

  -- Recency score (mutually exclusive — highest applicable)
  if v_last_post_date is not null then
    v_days_since := current_date - v_last_post_date;
    if    v_days_since = 0  then v_score := v_score + 30;
    elsif v_days_since <= 3 then v_score := v_score + 22;
    elsif v_days_since <= 7 then v_score := v_score + 15;
    elsif v_days_since <= 30 then v_score := v_score + 8;
    end if;
  end if;

  -- Serial poster bonus
  if v_recent_post_count >= 3 then
    v_score := v_score + 15;
  end if;

  -- Flexmarkt bonus
  if v_has_flexmarkt then
    v_score := v_score + 8;
  end if;

  -- Multi-board bonus (most recent signal boardsCount >= 3)
  if coalesce(v_most_recent_boards, 0) >= 3 then
    v_score := v_score + 5;
  end if;

  -- ── Step 2: Read contacts ──
  -- coalesce: bool_or returns NULL (not false) over zero rows
  select
    coalesce(bool_or(persona_type = 'hiring_manager'  and confidence != 'low'), false),
    coalesce(bool_or(persona_type = 'agency_selector' and confidence != 'low'), false),
    coalesce(bool_or(smtp_verified = true), false)
  into v_has_hm, v_has_as, v_has_smtp
  from contacts
  where company_id = p_company_id;

  if v_has_hm   then v_score := v_score + 10; end if;
  if v_has_as   then v_score := v_score + 10; end if;
  if v_has_smtp then v_score := v_score + 5;  end if;

  -- Company size bonus
  select size_band into v_size_band from companies where id = p_company_id;
  if v_size_band = 'mid' then v_score := v_score + 5; end if;

  -- ── Step 3: Read current pipeline stage ──
  select stage into v_stage from leads where company_id = p_company_id for update;

  if v_stage in ('contacted', 'replied', 'meeting_booked', 'proposal_sent') then
    v_score := v_score - 20;
  end if;

  -- Floor at 0
  v_score := greatest(v_score, 0);

  -- ── Step 4: Upsert lead with final score ──
  -- On conflict: stage is intentionally excluded from SET — preserves user's pipeline stage.
  -- 'new' is only applied on fresh insert; existing leads keep their current stage.
  insert into leads (company_id, score, stage)
  values (p_company_id, v_score, 'new')
  on conflict (company_id) do update
    set score = excluded.score,
        last_activity_at = now();
end;
$$;
```

- [ ] **Step 2: Apply migration**

```bash
cd .. && supabase db push
```

Expected: `Applying migration 005_upsert_lead_score_fn.sql... done`

- [ ] **Step 3: Smoke test the function**

In Supabase SQL Editor, assuming you have a company row already:

```sql
-- Replace with a real company id from your companies table
select upsert_lead_score('your-company-uuid-here');
select id, score, stage from leads;
```

Expected: a row in `leads` with score matching the signals for that company.

Then verify that calling the function again does NOT overwrite a user-set stage:

```sql
-- Move the lead to 'contacted' and re-run
update leads set stage = 'contacted' where company_id = '<your-company-uuid>';
select upsert_lead_score('<your-company-uuid>');
select stage, score from leads where company_id = '<your-company-uuid>';
```

Expected: `stage` is still `'contacted'` (not reset to `'new'`), and `score` reflects the −20 pipeline penalty.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_upsert_lead_score_fn.sql
git commit -m "feat: add atomic upsert_lead_score postgres function"
```

---

### Task 4: upsertLead — TypeScript wrapper

**Files:**
- Create: `scraper/src/scoring/upsert-lead.ts`
- Create: `scraper/src/scoring/upsert-lead.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/scoring/upsert-lead.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({
  db: { rpc: vi.fn() },
}))

import { upsertLead } from './upsert-lead.js'
import { db } from '../db/client.js'

describe('upsertLead', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls db.rpc with upsert_lead_score and company id', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: null } as any)
    await upsertLead('co-1')
    expect(db.rpc).toHaveBeenCalledWith('upsert_lead_score', { p_company_id: 'co-1' })
  })

  it('does not throw when RPC succeeds', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: null } as any)
    await expect(upsertLead('co-1')).resolves.not.toThrow()
  })

  it('throws when RPC returns an error', async () => {
    vi.mocked(db.rpc).mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    } as any)
    await expect(upsertLead('co-1')).rejects.toThrow('function does not exist')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- upsert-lead
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/scoring/upsert-lead.ts
import { db } from '../db/client.js'

/**
 * Atomically compute and upsert a lead score for the given company.
 * Delegates to the Postgres function upsert_lead_score() which reads signals,
 * contacts, and current stage in a single transaction.
 */
export async function upsertLead(companyId: string): Promise<void> {
  const { error } = await db.rpc('upsert_lead_score', { p_company_id: companyId })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- upsert-lead
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/scoring/upsert-lead.ts scraper/src/scoring/upsert-lead.test.ts
git commit -m "feat: add upsertLead wrapper for atomic Postgres score computation"
```

---

## Chunk 3: Wire Into Entry Point

### Task 5: Integrate scoring into entry point

**Files:**
- Modify: `scraper/src/index.ts`

- [ ] **Step 1: Add upsertLead call after waterfall in handleScrapeJob**

```typescript
// scraper/src/index.ts — full replacement (adds upsertLead after waterfall)
import 'dotenv/config'
import { db } from './db/client.js'
import { startPoller } from './queue/poller.js'
import { startTimeoutChecker } from './queue/timeout-checker.js'
import { fanOut } from './scrapers/index.js'
import { upsertCompany } from './db/companies.js'
import { insertJobSignal } from './db/job-signals.js'
import { upsertContact } from './db/contacts.js'
import { runWaterfall } from './contacts/waterfall.js'
import { upsertLead } from './scoring/upsert-lead.js'
import { normaliseContractType, normaliseSeniority, isPermanent } from './normalise/nl-terms.js'
import { normaliseDomain } from './normalise/domain.js'
import type { ScrapeJob } from './types.js'

// Map board name → country for 'both' searches
const NL_BOARDS = new Set([
  'indeed-nl', 'nationale-vacaturebank', 'monsterboard',
  'intermediair', 'stepstone-nl', 'jobbird', 'flexmarkt',
])

function countryForResult(board: string, jobCountry: string | undefined): 'uk' | 'nl' {
  if (jobCountry === 'uk') return 'uk'
  if (jobCountry === 'nl') return 'nl'
  return NL_BOARDS.has(board) ? 'nl' : 'uk'
}

async function handleScrapeJob(job: ScrapeJob): Promise<number> {
  console.log(`[scraper] Processing job ${job.id}: "${job.query}"`)

  const results = await fanOut(job.query ?? '', job.filters)

  // Phase 1: write companies + job signals (fast — UI shows these first)
  const companyMeta: Array<{
    companyId: string
    domain: string
    name: string
    country: 'uk' | 'nl'
  }> = []
  let count = 0

  for (const result of results) {
    const contractType = result.contractTypeRaw
      ? normaliseContractType(result.contractTypeRaw)
      : null
    if (contractType && isPermanent(contractType)) continue

    const seniority = result.seniorityRaw
      ? normaliseSeniority(result.seniorityRaw)
      : null

    const domain = result.companyDomain
      ? normaliseDomain(result.companyDomain)
      : normaliseDomain(result.companyName.toLowerCase().replace(/\s+/g, '') + '.com')

    const country = countryForResult(result.board, job.filters.country)

    const companyId = await upsertCompany({ name: result.companyName, domain, country })
    companyMeta.push({ companyId, domain, name: result.companyName, country })

    await insertJobSignal({
      companyId,
      title: result.jobTitle,
      seniority,
      contractType: contractType as any,
      board: result.board,
      postedDate: result.postedDate,
      snippet: result.snippet,
      boardsCount: result.boardsCount,
      scrapeJobId: job.id,
    })

    count++
  }

  // Phase 2: per company — run waterfall then score
  await Promise.all(
    companyMeta.map(async ({ companyId, domain, name, country }) => {
      try {
        // 2a: contact waterfall (fills contacts table)
        const contacts = await runWaterfall(name, domain, country)
        for (const contact of contacts) {
          await upsertContact(companyId, contact)
        }
        // 2b: compute and upsert score (reads signals + contacts + stage atomically)
        await upsertLead(companyId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[scraper] Phase 2 failed for ${domain}: ${msg}`)
      }
    })
  )

  console.log(`[scraper] Job ${job.id} done — ${count} signals, contacts + scores written`)
  return count
}

async function main() {
  const { error } = await db.from('scrape_jobs').select('id').limit(1)
  if (error) throw new Error(`DB connection failed: ${error.message}`)
  console.log('Scraper service started. DB OK.')

  startTimeoutChecker()
  startPoller(handleScrapeJob)
  console.log('Polling for jobs every 2s...')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run full test suite**

```bash
cd scraper && npm test
```

Expected: all tests pass (Parts 2+3+4 tests combined)

- [ ] **Step 3: Smoke test end-to-end**

```bash
npm run dev
```

Insert a test scrape job in Supabase:
```json
{ "query": "interim finance director", "filters": {"country": "uk"}, "status": "queued" }
```

After processing, check Supabase:
```sql
select c.name, c.domain, l.score, l.stage
from companies c
join leads l on l.company_id = c.id
order by l.score desc
limit 20;
```

Expected: rows with scores reflecting recency of job signals. Companies with today's signal score ≥ 30. Companies already in active pipeline should score 10 lower.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/index.ts
git commit -m "feat: add scoring step to scraper — Phase 2 now: contacts then upsert score"
```

---

## Part 4 Complete ✅

**What you now have:**
- Pure `computeScore()` function (38 tests — covers all recency bands, all bonuses, penalty, floor)
- `getScoreBand()` helper (8 tests)
- Postgres `upsert_lead_score()` function — atomic read-compute-write with company row lock
- `upsertLead()` TypeScript wrapper (3 tests)
- Entry point: Phase 2 = waterfall → upsertContact → upsertLead per company

**Test counts:**
- compute: 42 tests
- score-band: 8 tests
- upsert-lead: 3 tests
- **Total new tests: 53**

**Score range:** 0–88 (max with all bonuses). Penalty can reduce a 30-point lead to 10.
Score bands: Hot ≥70, Warm 45–69, Cold 20–44, Hidden <20.

**What the scraper now does end-to-end:**
1. Claims job atomically via `claim_scrape_job()` RPC
2. Fans out to all relevant boards in parallel
3. Normalises + deduplicates results
4. Phase 1: writes companies + job signals to DB (UI shows companies)
5. Phase 2 per company (concurrent): waterfall → contacts → `upsert_lead_score()` RPC
6. Marks job done

**Next:** Part 5 — Pipeline UI (Kanban + List views, lead detail panel, stage moves)
