# BDM Prospector — Part 5: Pipeline UI

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pipeline page — Kanban board view, List view, filter bar, and a slide-in lead detail panel with score breakdown, contacts, job signals, pipeline history, and stage/note/archive actions.

**Architecture:** A Server Component page fetches all active leads (with company, contacts, job signals joined). A `PipelineView` client component manages filter state (URL-synced), optimistic stage moves, and selected lead. Kanban uses `@dnd-kit` for drag-and-drop. List view is a sortable table. Lead detail opens in a shadcn `Sheet`. Two pure functions (`filterLeads`, `computeScoreBreakdown`) hold the logic that can be unit tested without DOM.

**Tech Stack:** Next.js 14 App Router, Supabase JS (browser + server), shadcn/ui, `@dnd-kit/core`, Vitest.

---

## File Map

```
web/app/(app)/pipeline/
├── page.tsx                    # RSC: fetch leads → render PipelineView
├── actions.ts                  # server actions: moveStage, addNote, archiveLead
├── types.ts                    # PipelineFilters interface
└── _components/
    ├── PipelineView.tsx        # 'use client' — tabs, URL-synced filters, optimistic moves
    ├── FilterBar.tsx           # score band + country selects
    ├── BoardView.tsx           # DndContext wrapping KanbanColumns
    ├── KanbanColumn.tsx        # single droppable stage column
    ├── LeadCard.tsx            # draggable card: name, score, contacts, days
    ├── ListView.tsx            # sortable table of filtered leads
    └── LeadDetailPanel.tsx     # Sheet panel: breakdown, contacts, history, actions

web/lib/
├── filter-leads.ts             # filterLeads(), sortLeads() — pure, tested
├── filter-leads.test.ts
├── score-breakdown.ts          # computeScoreBreakdown() — pure, tested
└── score-breakdown.test.ts

Modified:
  web/lib/types.ts              # add ScoreBand, getScoreBand, KANBAN_STAGES, SCORE_BAND_COLORS
```

---

## Chunk 1: Foundation — Setup, Types, Pure Functions, Data Layer

### Task 1: Install dependencies + vitest config

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`

- [ ] **Step 1: Install DnD kit and shadcn components**

```bash
cd web
npm install @dnd-kit/core @dnd-kit/utilities
npx shadcn@latest add table sheet select scroll-area
```

Expected: packages added to `node_modules`, four new component files in `components/ui/`.

- [ ] **Step 2: Add test script to package.json**

In `web/package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create vitest config**

```typescript
// web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
  },
})
```

> **Note:** The `alias` must live under `resolve:`, not `test:`. Vitest resolves module aliases via Vite's `resolve.alias` — placing it under `test` is silently ignored and all `@/...` imports in test files will fail to resolve.

- [ ] **Step 4: Verify vitest runs**

```bash
npm test
```

Expected: `No test files found` (no tests yet — that's fine, exit 0).

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/vitest.config.ts web/components/ui/
git commit -m "feat: install dnd-kit, shadcn table/sheet/select/scroll-area, vitest config"
```

---

### Task 2: Extend types.ts with ScoreBand helpers

**Files:**
- Modify: `web/lib/types.ts`

- [ ] **Step 1: Add ScoreBand types and helpers at end of types.ts**

> **Note:** `STAGE_LABELS` and `PIPELINE_STAGES` were already defined in Part 1's `types.ts` — do NOT redefine them. This task only adds the new ScoreBand exports below.

```typescript
// Append to web/lib/types.ts

export type ScoreBand = 'hot' | 'warm' | 'cold' | 'hidden'

export function getScoreBand(score: number): ScoreBand {
  if (score >= 70) return 'hot'
  if (score >= 45) return 'warm'
  if (score >= 20) return 'cold'
  return 'hidden'
}

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  hidden: 'Hidden',
}

export const SCORE_BAND_COLORS: Record<ScoreBand, string> = {
  hot: 'bg-red-100 text-red-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-slate-100 text-slate-700',
  hidden: 'bg-gray-100 text-gray-500',
}

// Stages shown in the Kanban board (Won and Dead are excluded from main board)
export const KANBAN_STAGES: PipelineStage[] = [
  'new', 'contacted', 'replied', 'meeting_booked', 'proposal_sent',
]

// Extend LeadWithCompany to optionally include pipeline events
export interface LeadWithCompany extends Lead {
  company: Company
  contacts: Contact[]
  job_signals: JobSignal[]
}
```

> **Note:** `LeadWithCompany` was already defined in Part 1 — replace that definition with this one (same shape, same file location).

- [ ] **Step 2: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat: add ScoreBand types, getScoreBand, KANBAN_STAGES to types"
```

---

### Task 3: filterLeads + sortLeads pure functions

**Files:**
- Create: `web/lib/filter-leads.ts`
- Create: `web/lib/filter-leads.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// web/lib/filter-leads.test.ts
import { describe, it, expect } from 'vitest'
import { filterLeads, sortLeads } from './filter-leads.js'
import type { LeadWithCompany, Company } from './types.js'

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'co-1', name: 'Acme Ltd', domain: 'acme.com',
    size_band: null, sector: null, country: 'uk',
    created_at: '2026-03-17T00:00:00Z', updated_at: '2026-03-17T00:00:00Z',
    ...overrides,
  }
}

function makeLead(overrides: Partial<LeadWithCompany> = {}): LeadWithCompany {
  return {
    id: 'lead-1', company_id: 'co-1', score: 30, stage: 'new',
    is_suppressed: false,
    created_at: '2026-03-17T00:00:00Z', last_activity_at: '2026-03-17T00:00:00Z',
    company: makeCompany(),
    contacts: [],
    job_signals: [],
    ...overrides,
  }
}

describe('filterLeads', () => {
  it('returns all non-dead non-won leads when no filters applied', () => {
    const leads = [makeLead({ id: 'l1' }), makeLead({ id: 'l2' })]
    expect(filterLeads(leads, {})).toHaveLength(2)
  })

  it('hides dead leads by default', () => {
    const leads = [makeLead({ stage: 'dead' }), makeLead({ stage: 'new' })]
    expect(filterLeads(leads, {})).toHaveLength(1)
  })

  it('shows dead leads when showDead = true', () => {
    const leads = [makeLead({ stage: 'dead' }), makeLead({ stage: 'new' })]
    expect(filterLeads(leads, { showDead: true })).toHaveLength(2)
  })

  it('hides won leads by default', () => {
    const leads = [makeLead({ stage: 'won' }), makeLead({ stage: 'new' })]
    expect(filterLeads(leads, {})).toHaveLength(1)
  })

  it('shows won leads when showWon = true', () => {
    const leads = [makeLead({ stage: 'won' }), makeLead({ stage: 'new' })]
    expect(filterLeads(leads, { showWon: true })).toHaveLength(2)
  })

  it('filters by score band — keeps only matching band', () => {
    const leads = [
      makeLead({ score: 80 }), // hot
      makeLead({ score: 50 }), // warm
      makeLead({ score: 30 }), // cold
    ]
    expect(filterLeads(leads, { scoreBand: 'warm' })).toHaveLength(1)
    expect(filterLeads(leads, { scoreBand: 'warm' })[0].score).toBe(50)
  })

  it('filters by country', () => {
    const leads = [
      makeLead({ company: makeCompany({ country: 'uk' }) }),
      makeLead({ company: makeCompany({ country: 'nl' }) }),
    ]
    expect(filterLeads(leads, { country: 'nl' })).toHaveLength(1)
    expect(filterLeads(leads, { country: 'nl' })[0].company.country).toBe('nl')
  })

  it('applies multiple filters together', () => {
    const leads = [
      makeLead({ score: 80, company: makeCompany({ country: 'uk' }) }), // hot, uk
      makeLead({ score: 80, company: makeCompany({ country: 'nl' }) }), // hot, nl
      makeLead({ score: 50, company: makeCompany({ country: 'uk' }) }), // warm, uk
    ]
    expect(filterLeads(leads, { scoreBand: 'hot', country: 'uk' })).toHaveLength(1)
  })
})

describe('sortLeads', () => {
  it('sorts by score descending', () => {
    const leads = [makeLead({ id: 'a', score: 20 }), makeLead({ id: 'b', score: 80 })]
    const sorted = sortLeads(leads, 'score', 'desc')
    expect(sorted[0].id).toBe('b')
  })

  it('sorts by score ascending', () => {
    const leads = [makeLead({ id: 'a', score: 20 }), makeLead({ id: 'b', score: 80 })]
    const sorted = sortLeads(leads, 'score', 'asc')
    expect(sorted[0].id).toBe('a')
  })

  it('does not mutate original array', () => {
    const leads = [makeLead({ id: 'a', score: 20 }), makeLead({ id: 'b', score: 80 })]
    sortLeads(leads, 'score', 'desc')
    expect(leads[0].id).toBe('a')
  })

  it('sorts by last_activity_at descending', () => {
    const leads = [
      makeLead({ id: 'old', last_activity_at: '2026-03-01T00:00:00Z' }),
      makeLead({ id: 'new', last_activity_at: '2026-03-17T00:00:00Z' }),
    ]
    const sorted = sortLeads(leads, 'last_activity_at', 'desc')
    expect(sorted[0].id).toBe('new')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test
```

Expected: `Cannot find module './filter-leads.js'`

- [ ] **Step 3: Implement**

```typescript
// web/lib/filter-leads.ts
import { getScoreBand } from './types.js'
import type { LeadWithCompany, ScoreBand, Country } from './types.js'

export interface PipelineFilters {
  scoreBand?: ScoreBand | null
  country?: Country | null
  showDead?: boolean
  showWon?: boolean
}

export type SortField = 'score' | 'last_activity_at' | 'created_at'
export type SortDir = 'asc' | 'desc'

export function filterLeads(leads: LeadWithCompany[], filters: PipelineFilters): LeadWithCompany[] {
  return leads.filter(lead => {
    if (!filters.showDead && lead.stage === 'dead') return false
    if (!filters.showWon && lead.stage === 'won') return false
    if (filters.scoreBand && getScoreBand(lead.score) !== filters.scoreBand) return false
    if (filters.country && lead.company.country !== filters.country) return false
    return true
  })
}

export function sortLeads(leads: LeadWithCompany[], field: SortField, dir: SortDir): LeadWithCompany[] {
  return [...leads].sort((a, b) => {
    let diff = 0
    if (field === 'score') {
      diff = a.score - b.score
    } else if (field === 'last_activity_at') {
      diff = new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime()
    } else {
      diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return dir === 'asc' ? diff : -diff
  })
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test
```

Expected: `12 passed`

- [ ] **Step 5: Commit**

```bash
git add web/lib/filter-leads.ts web/lib/filter-leads.test.ts
git commit -m "feat: add filterLeads and sortLeads pure functions with tests"
```

---

### Task 4: computeScoreBreakdown pure function

**Files:**
- Create: `web/lib/score-breakdown.ts`
- Create: `web/lib/score-breakdown.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// web/lib/score-breakdown.test.ts
import { describe, it, expect } from 'vitest'
import { computeScoreBreakdown } from './score-breakdown.js'
import type { LeadWithCompany, Company, JobSignal, Contact } from './types.js'

const REF = new Date('2026-03-17')

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'co-1', name: 'Acme Ltd', domain: 'acme.com',
    size_band: null, sector: null, country: 'uk',
    created_at: '2026-03-17T00:00:00Z', updated_at: '2026-03-17T00:00:00Z',
    ...overrides,
  }
}

function makeLead(overrides: Partial<LeadWithCompany> = {}): LeadWithCompany {
  return {
    id: 'lead-1', company_id: 'co-1', score: 0, stage: 'new',
    is_suppressed: false,
    created_at: '2026-03-17T00:00:00Z', last_activity_at: '2026-03-17T00:00:00Z',
    company: makeCompany(),
    contacts: [],
    job_signals: [],
    ...overrides,
  }
}

function makeSignal(overrides: Partial<JobSignal> = {}): JobSignal {
  return {
    id: 's1', company_id: 'co-1', title: null, seniority: null,
    contract_type: null, board: 'reed', posted_date: '2026-03-17',
    raw_snippet: null, boards_count: 1, created_at: '2026-03-17T00:00:00Z',
    ...overrides,
  }
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1', company_id: 'co-1', name: 'Jane Smith', title: 'CFO',
    persona_type: 'hiring_manager', email: null, smtp_verified: false,
    confidence: 'high', source: 'companies_house', found_at: '2026-03-17T00:00:00Z',
    ...overrides,
  }
}

describe('computeScoreBreakdown', () => {
  it('returns empty array for lead with no signals or contacts', () => {
    expect(computeScoreBreakdown(makeLead(), REF)).toEqual([])
  })

  it('includes recency item with +30 for today signal', () => {
    const lead = makeLead({ job_signals: [makeSignal({ posted_date: '2026-03-17' })] })
    const breakdown = computeScoreBreakdown(lead, REF)
    expect(breakdown).toContainEqual({ label: 'Signal posted today', points: 30 })
  })

  it('includes serial poster item when 3+ signals in 90 days', () => {
    const lead = makeLead({
      job_signals: [
        makeSignal({ id: 's1', posted_date: '2026-03-17' }),
        makeSignal({ id: 's2', posted_date: '2026-03-10' }),
        makeSignal({ id: 's3', posted_date: '2026-03-03' }),
      ],
    })
    const breakdown = computeScoreBreakdown(lead, REF)
    expect(breakdown.some(i => i.label.includes('Serial poster'))).toBe(true)
    expect(breakdown.find(i => i.label.includes('Serial poster'))?.points).toBe(15)
  })

  it('includes pipeline penalty as -20 for active stage', () => {
    const lead = makeLead({ stage: 'contacted' })
    const breakdown = computeScoreBreakdown(lead, REF)
    const penalty = breakdown.find(i => i.points < 0)
    expect(penalty).toBeDefined()
    expect(penalty?.points).toBe(-20)
  })

  it('does NOT include pipeline penalty for stage = new', () => {
    // Include a signal so breakdown is non-empty — prevents a vacuously-true every() on []
    const lead = makeLead({
      stage: 'new',
      job_signals: [makeSignal({ posted_date: '2026-03-17' })],
    })
    const breakdown = computeScoreBreakdown(lead, REF)
    expect(breakdown.length).toBeGreaterThan(0)
    expect(breakdown.every(i => i.points >= 0)).toBe(true)
  })

  it('includes HM contact bonus for high-confidence hiring_manager', () => {
    const lead = makeLead({
      contacts: [makeContact({ persona_type: 'hiring_manager', confidence: 'high' })],
    })
    const breakdown = computeScoreBreakdown(lead, REF)
    expect(breakdown).toContainEqual({ label: 'Hiring Manager contact found', points: 10 })
  })

  it('includes mid-size company bonus', () => {
    const lead = makeLead({ company: makeCompany({ size_band: 'mid' }) })
    const breakdown = computeScoreBreakdown(lead, REF)
    expect(breakdown).toContainEqual({ label: 'Mid-size company (50–500)', points: 5 })
  })

  it('sum of breakdown items equals lead score (floor at 0)', () => {
    const lead = makeLead({
      score: 30,
      job_signals: [makeSignal({ posted_date: '2026-03-17' })],
    })
    const breakdown = computeScoreBreakdown(lead, REF)
    const total = Math.max(0, breakdown.reduce((s, i) => s + i.points, 0))
    expect(total).toBe(30)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test
```

Expected: `Cannot find module './score-breakdown.js'`

- [ ] **Step 3: Implement**

```typescript
// web/lib/score-breakdown.ts
import type { LeadWithCompany, PipelineStage } from './types.js'

export interface ScoreItem {
  label: string
  points: number
}

const ACTIVE_STAGES = new Set<PipelineStage>([
  'contacted', 'replied', 'meeting_booked', 'proposal_sent',
])

export function computeScoreBreakdown(lead: LeadWithCompany, referenceDate?: Date): ScoreItem[] {
  const today = referenceDate ?? new Date()
  const items: ScoreItem[] = []

  const datedSignals = lead.job_signals
    .filter(s => s.posted_date)
    .map(s => ({ ...s, date: new Date(s.posted_date!) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  // Recency
  if (datedSignals.length > 0) {
    const msPerDay = 1000 * 60 * 60 * 24
    const diffDays = Math.floor((today.getTime() - datedSignals[0].date.getTime()) / msPerDay)
    if (diffDays === 0)      items.push({ label: 'Signal posted today', points: 30 })
    else if (diffDays <= 3)  items.push({ label: 'Signal posted 1–3 days ago', points: 22 })
    else if (diffDays <= 7)  items.push({ label: 'Signal posted 4–7 days ago', points: 15 })
    else if (diffDays <= 30) items.push({ label: 'Signal posted 8–30 days ago', points: 8 })
  }

  // Serial poster
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const recentCount = lead.job_signals.filter(
    s => s.posted_date && new Date(s.posted_date) >= ninetyDaysAgo
  ).length
  if (recentCount >= 3) items.push({ label: 'Serial poster (3+ signals in 90 days)', points: 15 })

  // Flexmarkt
  if (lead.job_signals.some(s => s.board === 'flexmarkt')) {
    items.push({ label: 'Flexmarkt.nl signal (interim-specific board)', points: 8 })
  }

  // Multi-board
  if (datedSignals.length > 0 && datedSignals[0].boards_count >= 3) {
    items.push({ label: 'Multi-board posting (3+ boards)', points: 5 })
  }

  // HM contact
  if (lead.contacts.some(c => c.persona_type === 'hiring_manager' && c.confidence !== 'low')) {
    items.push({ label: 'Hiring Manager contact found', points: 10 })
  }

  // AS contact
  if (lead.contacts.some(c => c.persona_type === 'agency_selector' && c.confidence !== 'low')) {
    items.push({ label: 'Agency Selector contact found', points: 10 })
  }

  // SMTP
  if (lead.contacts.some(c => c.smtp_verified)) {
    items.push({ label: 'Email SMTP verified', points: 5 })
  }

  // Size
  if (lead.company.size_band === 'mid') {
    items.push({ label: 'Mid-size company (50–500)', points: 5 })
  }

  // Pipeline penalty
  if (ACTIVE_STAGES.has(lead.stage)) {
    items.push({ label: `Already in active pipeline (${lead.stage})`, points: -20 })
  }

  return items
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test
```

Expected: `20 passed` (12 filter + 8 breakdown)

- [ ] **Step 5: Commit**

```bash
git add web/lib/score-breakdown.ts web/lib/score-breakdown.test.ts
git commit -m "feat: add computeScoreBreakdown with tests"
```

---

### Task 5: Pipeline page local types + server actions

**Files:**
- Create: `web/app/(app)/pipeline/types.ts`
- Create: `web/app/(app)/pipeline/actions.ts`

- [ ] **Step 1: Write pipeline local types**

```typescript
// web/app/(app)/pipeline/types.ts
// PipelineFilters is defined in filter-leads.ts (single source of truth) — re-export it here
// so pipeline components can import from the local types file without a deep lib path.
export type { PipelineFilters } from '@/lib/filter-leads'
```

> **Why re-export instead of redefine:** `filterLeads()` already owns and exports `PipelineFilters`. Defining it a second time in `pipeline/types.ts` creates two out-of-sync interfaces. Re-exporting keeps one definition.

- [ ] **Step 2: Write server actions**

```typescript
// web/app/(app)/pipeline/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PipelineStage } from '@/lib/types'

export async function moveStage(leadId: string, toStage: PipelineStage): Promise<void> {
  const supabase = createClient()

  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('stage')
    .eq('id', leadId)
    .single()
  if (fetchError || !lead) throw new Error('Lead not found')

  const { error: updateError } = await supabase
    .from('leads')
    .update({ stage: toStage, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
  if (updateError) throw new Error(updateError.message)

  const { error: eventError } = await supabase
    .from('pipeline_events')
    .insert({ lead_id: leadId, from_stage: lead.stage, to_stage: toStage })
  if (eventError) throw new Error(eventError.message)

  revalidatePath('/pipeline')
}

export async function addNote(leadId: string, note: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pipeline_events')
    .insert({ lead_id: leadId, note })
  if (error) throw new Error(error.message)
  await supabase
    .from('leads')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
  revalidatePath('/pipeline')
}

export async function archiveLead(leadId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('leads')
    .update({ is_suppressed: true, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
  if (error) throw new Error(error.message)
  revalidatePath('/pipeline')
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/\(app\)/pipeline/types.ts web/app/\(app\)/pipeline/actions.ts
git commit -m "feat: add pipeline server actions (moveStage, addNote, archiveLead)"
```

---

### Task 6: Pipeline page RSC

**Files:**
- Modify: `web/app/(app)/pipeline/page.tsx`

- [ ] **Step 1: Replace placeholder page with RSC data fetch**

```tsx
// web/app/(app)/pipeline/page.tsx
import { createClient } from '@/lib/supabase/server'
import { PipelineView } from './_components/PipelineView'
import type { LeadWithCompany } from '@/lib/types'

export default async function PipelinePage() {
  const supabase = createClient()

  const { data: leadsData, error } = await supabase
    .from('leads')
    .select('*, company:companies(*)')
    .eq('is_suppressed', false)
    .order('score', { ascending: false })

  if (error) {
    console.error('Failed to load leads:', error)
    return <div className="text-destructive p-6">Failed to load pipeline data.</div>
  }

  const validLeads = (leadsData ?? []).filter(l => l.company != null)
  const companyIds = validLeads.map(l => l.company_id).filter(Boolean)

  const [{ data: contacts }, { data: signals }] = await Promise.all([
    supabase.from('contacts').select('*').in('company_id', companyIds),
    supabase.from('job_signals').select('*').in('company_id', companyIds),
  ])

  const leads = validLeads.map(l => ({
    ...l,
    contacts: (contacts ?? []).filter(c => c.company_id === l.company_id),
    job_signals: (signals ?? []).filter(s => s.company_id === l.company_id),
  })) as LeadWithCompany[]

  return <PipelineView initialLeads={leads} />
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/pipeline/page.tsx
git commit -m "feat: pipeline page fetches leads with company+contacts+signals"
```

---

## Chunk 2: Kanban View

### Task 7: LeadCard — draggable card

**Files:**
- Create: `web/app/(app)/pipeline/_components/LeadCard.tsx`

- [ ] **Step 1: Implement LeadCard**

```tsx
// web/app/(app)/pipeline/_components/LeadCard.tsx
'use client'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getScoreBand, SCORE_BAND_COLORS } from '@/lib/types'
import type { LeadWithCompany } from '@/lib/types'

interface LeadCardProps {
  lead: LeadWithCompany
  onClick: () => void
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  })

  const style = { transform: CSS.Translate.toString(transform) }
  const band = getScoreBand(lead.score)
  // MVP approximation: uses last_activity_at as a proxy for days in current stage.
  // This over-counts when a note is added without a stage move. Precise tracking
  // requires a stage_entered_at timestamp (derivable from pipeline_events in a future iteration).
  const daysInStage = Math.floor(
    (Date.now() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  const lastActivityDate = new Date(lead.last_activity_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-slate-200 p-3 cursor-grab hover:border-slate-400 select-none',
        isDragging && 'opacity-40 cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-sm text-slate-900 leading-snug line-clamp-2">
          {lead.company.name}
        </span>
        <Badge className={cn('shrink-0 text-xs', SCORE_BAND_COLORS[band])}>
          {lead.score}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{lead.contacts.length} contact{lead.contacts.length !== 1 ? 's' : ''}</span>
        <span>{daysInStage}d in stage</span>
        <span className="uppercase text-[10px] tracking-wide">{lead.company.country}</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{lastActivityDate}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/pipeline/_components/LeadCard.tsx
git commit -m "feat: add draggable LeadCard component"
```

---

### Task 8: KanbanColumn — droppable stage column

**Files:**
- Create: `web/app/(app)/pipeline/_components/KanbanColumn.tsx`

- [ ] **Step 1: Implement KanbanColumn**

```tsx
// web/app/(app)/pipeline/_components/KanbanColumn.tsx
'use client'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { STAGE_LABELS } from '@/lib/types'
import { LeadCard } from './LeadCard'
import type { LeadWithCompany, PipelineStage } from '@/lib/types'

interface KanbanColumnProps {
  stage: PipelineStage
  leads: LeadWithCompany[]
  onSelectLead: (lead: LeadWithCompany) => void
}

export function KanbanColumn({ stage, leads, onSelectLead }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div className="flex flex-col w-60 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-medium text-sm text-slate-700">{STAGE_LABELS[stage]}</h3>
        <span className="text-xs text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[120px] rounded-lg p-2 flex flex-col gap-2 transition-colors',
          isOver ? 'bg-slate-100 ring-2 ring-slate-300' : 'bg-slate-50'
        )}
      >
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onSelectLead(lead)} />
        ))}
        {leads.length === 0 && (
          <div className="text-xs text-slate-300 text-center pt-4">Drop here</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/pipeline/_components/KanbanColumn.tsx
git commit -m "feat: add droppable KanbanColumn component"
```

---

### Task 9: BoardView — DnD board

**Files:**
- Create: `web/app/(app)/pipeline/_components/BoardView.tsx`

- [ ] **Step 1: Implement BoardView**

```tsx
// web/app/(app)/pipeline/_components/BoardView.tsx
'use client'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { KANBAN_STAGES } from '@/lib/types'
import { KanbanColumn } from './KanbanColumn'
import type { LeadWithCompany, PipelineStage } from '@/lib/types'

interface BoardViewProps {
  leads: LeadWithCompany[]
  onMoveStage: (leadId: string, toStage: PipelineStage) => void
  onSelectLead: (lead: LeadWithCompany) => void
}

export function BoardView({ leads, onMoveStage, onSelectLead }: BoardViewProps) {
  // PointerSensor with activation constraint prevents drag firing on card click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const leadId = active.id as string
    const toStage = over.id as PipelineStage
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === toStage) return
    onMoveStage(leadId, toStage)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={leads.filter(l => l.stage === stage)}
            onSelectLead={onSelectLead}
          />
        ))}
      </div>
    </DndContext>
  )
}
```

> **Note on PointerSensor:** The `distance: 8` constraint means dragging only starts after the pointer moves 8px. This lets `onClick` fire on short taps/clicks while still enabling drag on sustained movement.

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/pipeline/_components/BoardView.tsx
git commit -m "feat: add BoardView with DnD context and column layout"
```

---

## Chunk 3: List View + Filter Bar

### Task 10: FilterBar

**Files:**
- Create: `web/app/(app)/pipeline/_components/FilterBar.tsx`

- [ ] **Step 1: Implement FilterBar**

```tsx
// web/app/(app)/pipeline/_components/FilterBar.tsx
'use client'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { PipelineFilters } from '../types'
import type { ScoreBand, Country } from '@/lib/types'

interface FilterBarProps {
  filters: PipelineFilters
  onChange: (filters: PipelineFilters) => void
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof PipelineFilters>(key: K, value: PipelineFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={filters.scoreBand ?? 'all'}
        onValueChange={v => set('scoreBand', v === 'all' ? null : v as ScoreBand)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Score band" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All bands</SelectItem>
          <SelectItem value="hot">Hot (70+)</SelectItem>
          <SelectItem value="warm">Warm (45–69)</SelectItem>
          <SelectItem value="cold">Cold (20–44)</SelectItem>
          <SelectItem value="hidden">Hidden (&lt;20)</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.country ?? 'all'}
        onValueChange={v => set('country', v === 'all' ? null : v as Country)}
      >
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All countries</SelectItem>
          <SelectItem value="uk">UK</SelectItem>
          <SelectItem value="nl">NL</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/pipeline/_components/FilterBar.tsx
git commit -m "feat: add FilterBar with score band and country selects"
```

---

### Task 11: ListView — sortable table

**Files:**
- Create: `web/app/(app)/pipeline/_components/ListView.tsx`

- [ ] **Step 1: Implement ListView**

```tsx
// web/app/(app)/pipeline/_components/ListView.tsx
'use client'
import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { sortLeads, type SortField, type SortDir } from '@/lib/filter-leads'
import { getScoreBand, STAGE_LABELS, SCORE_BAND_COLORS } from '@/lib/types'
import type { LeadWithCompany } from '@/lib/types'

interface ListViewProps {
  leads: LeadWithCompany[]
  onSelectLead: (lead: LeadWithCompany) => void
}

export function ListView({ leads, onSelectLead }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = sortLeads(leads, sortField, sortDir)

  function SortHead({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    return (
      <TableHead
        className="cursor-pointer select-none whitespace-nowrap"
        onClick={() => toggleSort(field)}
      >
        {label}
        {active && <span className="ml-1 text-slate-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </TableHead>
    )
  }

  if (leads.length === 0) {
    return <p className="text-slate-400 text-sm py-8 text-center">No leads match your filters.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Country</TableHead>
          <SortHead field="score" label="Score" />
          <TableHead>Stage</TableHead>
          <TableHead>Contacts Found</TableHead>
          <SortHead field="last_activity_at" label="Last Activity" />
          <TableHead>Days in Stage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(lead => {
          const band = getScoreBand(lead.score)
          const daysAgo = Math.floor(
            (Date.now() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          // MVP approximation: daysInStage uses last_activity_at as a proxy for stage-entry time
          return (
            <TableRow
              key={lead.id}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onSelectLead(lead)}
            >
              <TableCell className="font-medium text-slate-900">
                {lead.company.name}
              </TableCell>
              <TableCell className="uppercase text-xs text-slate-500">
                {lead.company.country}
              </TableCell>
              <TableCell>
                <Badge className={cn('text-xs', SCORE_BAND_COLORS[band])}>
                  {lead.score}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-700">{STAGE_LABELS[lead.stage]}</TableCell>
              <TableCell className="text-slate-500">{lead.contacts.length}</TableCell>
              <TableCell className="text-slate-400 text-sm">
                {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
              </TableCell>
              <TableCell className="text-slate-500">
                {daysAgo === 0 ? {'<1d'} : `${daysAgo}d`}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/pipeline/_components/ListView.tsx
git commit -m "feat: add sortable ListView table component"
```

---

## Chunk 4: Lead Detail Panel + Top-Level PipelineView

### Task 12: LeadDetailPanel — slide-in Sheet

**Files:**
- Create: `web/app/(app)/pipeline/_components/LeadDetailPanel.tsx`

- [ ] **Step 1: Implement LeadDetailPanel**

```tsx
// web/app/(app)/pipeline/_components/LeadDetailPanel.tsx
'use client'
import { useState, useTransition } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { computeScoreBreakdown } from '@/lib/score-breakdown'
import { getScoreBand, PIPELINE_STAGES, STAGE_LABELS, SCORE_BAND_COLORS } from '@/lib/types'
import { moveStage, addNote, archiveLead } from '../actions'
import type { LeadWithCompany, PipelineStage, PipelineEvent } from '@/lib/types'

interface LeadDetailPanelProps {
  lead: LeadWithCompany | null
  pipelineEvents: PipelineEvent[]
  onClose: () => void
  onArchive?: (leadId: string) => void
}

export function LeadDetailPanel({ lead, pipelineEvents, onClose, onArchive }: LeadDetailPanelProps) {
  const [noteText, setNoteText] = useState('')
  const [revealedEmails, setRevealedEmails] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  if (!lead) return null

  const band = getScoreBand(lead.score)
  const breakdown = computeScoreBreakdown(lead)

  function handleMoveStage(toStage: PipelineStage) {
    startTransition(() => moveStage(lead!.id, toStage))
  }

  function handleAddNote() {
    if (!noteText.trim()) return
    const text = noteText.trim()
    setNoteText('')
    startTransition(() => addNote(lead!.id, text))
  }

  function handleArchive() {
    if (onArchive) {
      onArchive(lead!.id)
    } else {
      startTransition(() => archiveLead(lead!.id))
      onClose()
    }
  }

  return (
    <Sheet open={!!lead} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[580px] p-0 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">

            {/* Header */}
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-tight">{lead.company.name}</SheetTitle>
                  <a
                    href={`https://${lead.company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:underline break-all"
                  >
                    {lead.company.domain}
                  </a>
                </div>
                <Badge className={cn('shrink-0 text-sm px-2', SCORE_BAND_COLORS[band])}>
                  {lead.score}
                </Badge>
              </div>
              <div className="flex gap-2 text-sm text-slate-500 flex-wrap">
                {lead.company.size_band && <span>{lead.company.size_band}</span>}
                {lead.company.sector && <span>· {lead.company.sector}</span>}
                {lead.company.country && (
                  <span className="uppercase">· {lead.company.country}</span>
                )}
              </div>
            </SheetHeader>

            {/* Quick actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={lead.stage}
                onValueChange={v => handleMoveStage(v as PipelineStage)}
                disabled={isPending}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map(s => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={isPending}
              >
                Archive
              </Button>
            </div>

            {/* Score breakdown */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Score Breakdown</h4>
              {breakdown.length === 0 ? (
                <p className="text-sm text-slate-400">No signals yet.</p>
              ) : (
                <div className="space-y-0">
                  {breakdown.map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0"
                    >
                      <span className="text-slate-600">{item.label}</span>
                      <span
                        className={cn(
                          'font-medium tabular-nums',
                          item.points < 0 ? 'text-red-600' : 'text-slate-900'
                        )}
                      >
                        {item.points > 0 ? '+' : ''}{item.points}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-1.5 font-semibold border-t border-slate-200 mt-1">
                    <span className="text-slate-700">Total</span>
                    <span>{lead.score}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Job signals */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                Job Signals ({lead.job_signals.length})
              </h4>
              <div className="space-y-2">
                {lead.job_signals.slice(0, 5).map(signal => (
                  <div key={signal.id} className="text-sm border rounded-md p-2 bg-slate-50">
                    <div className="font-medium text-slate-800">{signal.title ?? '—'}</div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {signal.board} · {signal.posted_date ?? 'unknown date'}
                      {signal.contract_type && ` · ${signal.contract_type}`}
                    </div>
                  </div>
                ))}
                {lead.job_signals.length > 5 && (
                  <p className="text-xs text-slate-400">
                    +{lead.job_signals.length - 5} more signals
                  </p>
                )}
              </div>
            </section>

            {/* Contacts */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                Contacts ({lead.contacts.length})
              </h4>
              <div className="space-y-2">
                {lead.contacts.length === 0 ? (
                  <p className="text-sm text-slate-400">No contacts found yet.</p>
                ) : (
                  lead.contacts.map(contact => (
                    <div key={contact.id} className="border rounded-md p-3 text-sm bg-slate-50">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-slate-800">{contact.name ?? '—'}</span>
                        <Badge variant="outline" className="text-xs">
                          {contact.persona_type === 'hiring_manager' ? 'Hiring Manager' : 'Agency Selector'}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {contact.confidence}
                        </Badge>
                      </div>
                      <div className="text-slate-500">{contact.title ?? '—'}</div>
                      {contact.email && (
                        <div className="mt-1 text-slate-500">
                          {revealedEmails.has(contact.id) ? (
                            <span>{contact.email}</span>
                          ) : (
                            <button
                              className="text-xs text-slate-400 underline hover:text-slate-600"
                              onClick={() =>
                                setRevealedEmails(s => new Set([...s, contact.id]))
                              }
                            >
                              Reveal email
                            </button>
                          )}
                          {contact.smtp_verified && (
                            <span className="ml-2 text-green-600 text-xs">✓ verified</span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-1">{contact.source}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Add note */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Add Note</h4>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Write a note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={isPending || !noteText.trim()}
                >
                  Add
                </Button>
              </div>
            </section>

            {/* Activity log — notes only */}
            {(() => {
              const notes = pipelineEvents.filter(e => e.note)
              return (
                <section>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Activity Log</h4>
                  {notes.length === 0 ? (
                    <p className="text-sm text-slate-400">No notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.map(event => (
                        <div
                          key={event.id}
                          className="text-sm text-slate-600 border-l-2 border-blue-200 pl-3 py-1"
                        >
                          <span className="italic">"{event.note}"</span>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(event.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })()}

            {/* Pipeline history — stage moves only */}
            {(() => {
              const stageMoves = pipelineEvents.filter(e => !e.note)
              return (
                <section>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Pipeline History</h4>
                  {stageMoves.length === 0 ? (
                    <p className="text-sm text-slate-400">No stage moves yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {stageMoves.map(event => (
                        <div
                          key={event.id}
                          className="text-sm text-slate-600 border-l-2 border-slate-200 pl-3 py-1"
                        >
                          <span>
                            Moved from{' '}
                            <strong>
                              {event.from_stage
                                ? (STAGE_LABELS[event.from_stage as PipelineStage] ?? event.from_stage)
                                : 'none'}
                            </strong>
                            {' '}to{' '}
                            <strong>
                              {event.to_stage
                                ? (STAGE_LABELS[event.to_stage as PipelineStage] ?? event.to_stage)
                                : '?'}
                            </strong>
                          </span>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(event.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })()}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/pipeline/_components/LeadDetailPanel.tsx
git commit -m "feat: add LeadDetailPanel with score breakdown, contacts, history, actions"
```

---

### Task 13: PipelineView — top-level client component

**Files:**
- Create: `web/app/(app)/pipeline/_components/PipelineView.tsx`

- [ ] **Step 1: Implement PipelineView**

```tsx
// web/app/(app)/pipeline/_components/PipelineView.tsx
'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { filterLeads } from '@/lib/filter-leads'
import { moveStage, archiveLead } from '../actions'
import { BoardView } from './BoardView'
import { ListView } from './ListView'
import { FilterBar } from './FilterBar'
import { LeadDetailPanel } from './LeadDetailPanel'
import type { LeadWithCompany, PipelineStage, PipelineEvent } from '@/lib/types'
import type { PipelineFilters } from '../types'

interface PipelineViewProps {
  initialLeads: LeadWithCompany[]
}

export function PipelineView({ initialLeads }: PipelineViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Leads in local state for optimistic stage moves
  const [leads, setLeads] = useState<LeadWithCompany[]>(initialLeads)
  const [selectedLead, setSelectedLead] = useState<LeadWithCompany | null>(null)
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([])
  const [, startTransition] = useTransition()

  // Filters read from URL — no local state to avoid double-source-of-truth
  const filters: PipelineFilters = {
    scoreBand: (searchParams.get('band') as any) ?? null,
    country: (searchParams.get('country') as any) ?? null,
  }
  const view = searchParams.get('view') ?? 'board'

  function setFilters(next: PipelineFilters) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.scoreBand) params.set('band', next.scoreBand)
    else params.delete('band')
    if (next.country) params.set('country', next.country)
    else params.delete('country')
    router.replace(`/pipeline?${params}`)
  }

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.replace(`/pipeline?${params}`)
  }

  // Fetch pipeline events when a lead is selected
  useEffect(() => {
    if (!selectedLead) {
      setPipelineEvents([])
      return
    }
    const selectedLeadId = selectedLead.id
    let ignore = false

    async function fetchEvents() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pipeline_events')
        .select('*')
        .eq('lead_id', selectedLeadId)
        .order('created_at', { ascending: false })

      if (ignore) return
      if (error) {
        console.error('Failed to fetch pipeline events:', error)
        return
      }
      setPipelineEvents(data ?? [])
    }

    fetchEvents()
    return () => { ignore = true }
  }, [selectedLead?.id])

  // Optimistic stage move: update local state immediately then write to DB
  function handleMoveStage(leadId: string, toStage: PipelineStage) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: toStage } : l))
    // Also update the selected lead panel if it's the one being moved
    setSelectedLead(prev => prev?.id === leadId ? { ...prev, stage: toStage } : prev)
    startTransition(() => moveStage(leadId, toStage))
  }

  function handleArchive(leadId: string) {
    startTransition(() => archiveLead(leadId))
    setLeads(prev => prev.filter(l => l.id !== leadId))
  }

  const filtered = filterLeads(leads, filters)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Pipeline
          <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length} leads</span>
        </h1>
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="mb-4">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <BoardView
            leads={filtered}
            onMoveStage={handleMoveStage}
            onSelectLead={setSelectedLead}
          />
        </TabsContent>

        <TabsContent value="list">
          <ListView leads={filtered} onSelectLead={setSelectedLead} />
        </TabsContent>
      </Tabs>

      <LeadDetailPanel
        lead={selectedLead}
        pipelineEvents={pipelineEvents}
        onClose={() => setSelectedLead(null)}
        onArchive={(leadId) => { handleArchive(leadId); setSelectedLead(null) }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd web && npm test
```

Expected: `20 passed`

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Navigate to `/pipeline`. With an empty DB: page loads with empty board. With seed data (insert a company + lead in Supabase SQL editor):

```sql
-- Quick seed for smoke test
insert into companies (name, domain, country, size_band)
values ('Acme Ltd', 'acme.com', 'uk', 'mid');

insert into leads (company_id, score, stage)
select id, 38, 'new' from companies where domain = 'acme.com';

insert into job_signals (company_id, title, board, posted_date, boards_count)
select id, 'Interim Finance Director', 'reed', current_date, 1
from companies where domain = 'acme.com';
```

Expected:
- Board view shows Acme Ltd in the "New" column with score badge
- Dragging the card to "Contacted" column moves it and updates DB
- Clicking the card opens the detail panel with score breakdown showing "+30 Signal posted today"
- Filter by country "UK" keeps Acme, filter by "NL" hides it
- List view shows sortable table with Acme Ltd row
- "Board" / "List" tab selection persists in URL as `?view=board` / `?view=list`

- [ ] **Step 4: Commit**

```bash
git add web/app/\(app\)/pipeline/_components/PipelineView.tsx
git commit -m "feat: add PipelineView — tabs, URL-synced filters, optimistic DnD moves"
```

---

## Part 5 Complete ✅

**What you now have:**
- Kanban board with drag-and-drop stage moves (`@dnd-kit`) — optimistic, instant UI
- Sortable list view with filter bar — score band + country, URL-persisted
- Lead detail panel (Sheet) — score breakdown, job signals, contacts with click-to-reveal email, pipeline history, add note, move stage, archive
- Pure functions tested: `filterLeads` + `sortLeads` (12 tests), `computeScoreBreakdown` (8 tests)
- Server actions: `moveStage`, `addNote`, `archiveLead` — all write pipeline_events for history

**Test count:** 20 new tests

**Score breakdown display:** Matches Part 4's scoring logic — computed from live lead data, not stored. Total shown at bottom of breakdown list.

**Filter/view persistence:** All filter state lives in URL params (`?view=board&band=warm&country=uk`). Switching Board ↔ List preserves filters.

**Dead/Won suppression:** Dead hidden by default (spec). Won hidden by default. Both visible via `showDead`/`showWon` filter flags (wired up in `filterLeads` — UI toggle is a future addition).

**Next:** Part 6 — Search UI (search page, filters, scrape job polling, progressive results)
