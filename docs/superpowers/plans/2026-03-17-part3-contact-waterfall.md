# BDM Prospector — Part 3: Contact Waterfall

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For each company found by the scraper, find 2–3 contacts across two personas (hiring manager + agency selector) using a free 6-step waterfall: Companies House → Google → website → press → email patterns → SMTP verify.

**Architecture:** Each waterfall step returns `FoundContact[]` (name + title, no email yet). After each step, new contacts are enriched with email patterns + SMTP verification, then confidence is assigned. The waterfall stops early if 3+ high-confidence contacts are accumulated. Contacts are written to `contacts` table as they're found. The waterfall runs per-company after job signals are written — companies appear in the UI fast, contacts fill in over 30–60s.

**Tech Stack:** Node.js + TypeScript, undici (HTTP), cheerio (HTML parsing), node:net + node:dns/promises (SMTP), vitest.

---

## File Map

```
scraper/src/contacts/
├── types.ts                    # FoundContact, EnrichedContact, PersonaType, Confidence
├── persona.ts                  # mapTitleToPersona() — pure
├── persona.test.ts
├── email-patterns.ts           # splitName(), generateEmailPatterns() — pure
├── email-patterns.test.ts
├── confidence.ts               # assignConfidence() — pure
├── confidence.test.ts
├── contact-dedup.ts            # deduplicateContacts(), capContacts() — pure
├── contact-dedup.test.ts
├── waterfall.ts                # runWaterfall() orchestrator
├── waterfall.test.ts
└── steps/
    ├── companies-house.ts      # Step 1 UK: Companies House API
    ├── companies-house.test.ts
    ├── kvk.ts                  # Step 1 NL: KvK API stub
    ├── kvk.test.ts
    ├── google-search.ts        # Step 2 (LinkedIn) + Step 4 (press)
    ├── google-search.test.ts
    ├── website.ts              # Step 3: company website
    ├── website.test.ts
    ├── smtp-verify.ts          # Step 6: SMTP RCPT TO check
    └── smtp-verify.test.ts
scraper/src/db/
├── contacts.ts                 # upsertContact() DB writer
└── contacts.test.ts
supabase/migrations/
└── 004_contacts_unique_constraint.sql
```

**Modified files:**
- `scraper/src/index.ts` — add Phase 2 (waterfall) after Phase 1 (signals)
- `scraper/src/types.ts` — ensure ContractType, Seniority, Country, SizeBand types are exported

---

## Chunk 1: Pure Utility Functions

### Task 1: Contact types

**Files:**
- Create: `scraper/src/contacts/types.ts`
- Verify: `scraper/src/types.ts` (ensure base types are exported)

- [ ] **Step 1: Create contact types file**

```typescript
// scraper/src/contacts/types.ts

export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource = 'companies_house' | 'kvk' | 'google' | 'website' | 'press'

/** Contact found with name+title, before email enrichment */
export interface FoundContact {
  name: string
  title: string
  personaType: PersonaType
  source: ContactSource
}

/** Contact after email pattern generation + SMTP verification */
export interface EnrichedContact extends FoundContact {
  email: string | null
  smtpVerified: boolean
  confidence: Confidence
}
```

- [ ] **Step 2: Verify types.ts has required exports**

Open `scraper/src/types.ts`. Ensure these types exist (add if missing):

```typescript
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type Country = 'uk' | 'nl'
export type SizeBand = 'small' | 'mid' | 'large'
```

- [ ] **Step 3: Commit**

```bash
git add scraper/src/contacts/types.ts scraper/src/types.ts
git commit -m "feat: add contact types"
```

---

### Task 2: Persona mapping

**Files:**
- Create: `scraper/src/contacts/persona.ts`
- Create: `scraper/src/contacts/persona.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/persona.test.ts
import { describe, it, expect } from 'vitest'
import { mapTitleToPersona } from './persona.js'

describe('mapTitleToPersona', () => {
  it('maps Finance Director to hiring_manager', () => {
    expect(mapTitleToPersona('Finance Director')).toBe('hiring_manager')
  })
  it('maps CFO to hiring_manager', () => {
    expect(mapTitleToPersona('CFO')).toBe('hiring_manager')
  })
  it('maps Chief Financial Officer to hiring_manager', () => {
    expect(mapTitleToPersona('Chief Financial Officer')).toBe('hiring_manager')
  })
  it('maps HR Director to hiring_manager', () => {
    expect(mapTitleToPersona('HR Director')).toBe('hiring_manager')
  })
  it('maps Operations Director to hiring_manager', () => {
    expect(mapTitleToPersona('Operations Director')).toBe('hiring_manager')
  })
  it('maps Head of Talent to agency_selector', () => {
    expect(mapTitleToPersona('Head of Talent')).toBe('agency_selector')
  })
  it('maps Talent Acquisition Manager to agency_selector', () => {
    expect(mapTitleToPersona('Talent Acquisition Manager')).toBe('agency_selector')
  })
  it('maps HR Business Partner to agency_selector', () => {
    expect(mapTitleToPersona('HR Business Partner')).toBe('agency_selector')
  })
  it('maps Procurement Director to agency_selector', () => {
    expect(mapTitleToPersona('Procurement Director')).toBe('agency_selector')
  })
  it('maps Chief People Officer to agency_selector', () => {
    expect(mapTitleToPersona('Chief People Officer')).toBe('agency_selector')
  })
  it('is case-insensitive', () => {
    expect(mapTitleToPersona('FINANCE DIRECTOR')).toBe('hiring_manager')
    expect(mapTitleToPersona('head of talent')).toBe('agency_selector')
  })
  it('defaults to hiring_manager for Managing Director', () => {
    expect(mapTitleToPersona('Managing Director')).toBe('hiring_manager')
  })
  it('maps Head of People to agency_selector', () => {
    expect(mapTitleToPersona('Head of People')).toBe('agency_selector')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
cd scraper && npm test -- persona
```

Expected: `Cannot find module './persona.js'`

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/persona.ts
import type { PersonaType } from './types.js'

// Agency selector keywords checked first — takes priority over hiring_manager matches
const AGENCY_SELECTOR_KEYWORDS = [
  'talent acquisition', 'head of talent', 'head of people', 'people director',
  'chief people', 'hr business partner', 'hrbp', 'procurement',
  'resourcing', 'recruitment director', 'staffing',
]

const HIRING_MANAGER_KEYWORDS = [
  'finance director', 'chief financial', 'cfo', 'financial director',
  'head of finance', 'hr director', 'human resources director',
  'operations director', 'coo', 'chief operating', 'managing director',
  'director', 'head of hr', 'head of operations',
]

export function mapTitleToPersona(title: string): PersonaType {
  const lower = title.toLowerCase()
  for (const kw of AGENCY_SELECTOR_KEYWORDS) {
    if (lower.includes(kw)) return 'agency_selector'
  }
  for (const kw of HIRING_MANAGER_KEYWORDS) {
    if (lower.includes(kw)) return 'hiring_manager'
  }
  return 'hiring_manager' // default fallback
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- persona
```

Expected: `13 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/persona.ts scraper/src/contacts/persona.test.ts
git commit -m "feat: add persona title mapping with tests"
```

---

### Task 3: Email pattern generator

**Files:**
- Create: `scraper/src/contacts/email-patterns.ts`
- Create: `scraper/src/contacts/email-patterns.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/email-patterns.test.ts
import { describe, it, expect } from 'vitest'
import { generateEmailPatterns, splitName } from './email-patterns.js'

describe('splitName', () => {
  it('splits "John Smith" into first and last', () => {
    expect(splitName('John Smith')).toEqual({ first: 'john', last: 'smith' })
  })
  it('uses first and last word for multi-word names', () => {
    expect(splitName('Mary Jane Watson')).toEqual({ first: 'mary', last: 'watson' })
  })
  it('handles single word name', () => {
    expect(splitName('Madonna')).toEqual({ first: 'madonna', last: '' })
  })
  it('lowercases output', () => {
    expect(splitName('JOHN SMITH')).toEqual({ first: 'john', last: 'smith' })
  })
  it('trims whitespace', () => {
    expect(splitName('  John Smith  ')).toEqual({ first: 'john', last: 'smith' })
  })
})

describe('generateEmailPatterns', () => {
  it('returns 5 patterns for a full name', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toHaveLength(5)
  })
  it('generates firstname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('john@example.com')
  })
  it('generates firstname.lastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('john.smith@example.com')
  })
  it('generates f.lastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('j.smith@example.com')
  })
  it('generates flastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('jsmith@example.com')
  })
  it('generates firstname_lastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('john_smith@example.com')
  })
  it('returns empty array when last name is empty', () => {
    expect(generateEmailPatterns('madonna', '', 'example.com')).toHaveLength(0)
  })
  it('handles Dutch names correctly', () => {
    const patterns = generateEmailPatterns('jan', 'janssen', 'bedrijf.nl')
    expect(patterns).toContain('jan.janssen@bedrijf.nl')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- email-patterns
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/email-patterns.ts

export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().toLowerCase().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts[parts.length - 1] }
}

export function generateEmailPatterns(
  firstName: string,
  lastName: string,
  domain: string
): string[] {
  const f = firstName.toLowerCase().trim()
  const l = lastName.toLowerCase().trim()
  if (!f || !l) return []
  const fi = f[0]
  return [
    `${f}@${domain}`,
    `${f}.${l}@${domain}`,
    `${fi}.${l}@${domain}`,
    `${fi}${l}@${domain}`,
    `${f}_${l}@${domain}`,
  ]
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- email-patterns
```

Expected: `13 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/email-patterns.ts scraper/src/contacts/email-patterns.test.ts
git commit -m "feat: add email pattern generator with tests"
```

---

### Task 4: Confidence assignment

**Files:**
- Create: `scraper/src/contacts/confidence.ts`
- Create: `scraper/src/contacts/confidence.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/confidence.test.ts
import { describe, it, expect } from 'vitest'
import { assignConfidence } from './confidence.js'

describe('assignConfidence', () => {
  it('CH contact with email is high', () => {
    expect(assignConfidence('companies_house', 'john@acme.co.uk', false)).toBe('high')
  })
  it('CH contact without email is medium', () => {
    expect(assignConfidence('companies_house', null, false)).toBe('medium')
  })
  it('KvK contact with email is high', () => {
    expect(assignConfidence('kvk', 'jan@bedrijf.nl', false)).toBe('high')
  })
  it('KvK contact without email is medium', () => {
    expect(assignConfidence('kvk', null, false)).toBe('medium')
  })
  it('press contact with email is high', () => {
    expect(assignConfidence('press', 'jane@co.uk', false)).toBe('high')
  })
  it('press contact without email is low', () => {
    expect(assignConfidence('press', null, false)).toBe('low')
  })
  it('website contact with SMTP verified email is high', () => {
    expect(assignConfidence('website', 'j@co.uk', true)).toBe('high')
  })
  it('website contact with unverified email is medium', () => {
    expect(assignConfidence('website', 'j@co.uk', false)).toBe('medium')
  })
  it('website contact without email is medium', () => {
    expect(assignConfidence('website', null, false)).toBe('medium')
  })
  it('google contact with SMTP verified email is medium', () => {
    expect(assignConfidence('google', 'j@co.uk', true)).toBe('medium')
  })
  it('google contact with unverified email is low', () => {
    expect(assignConfidence('google', 'j@co.uk', false)).toBe('low')
  })
  it('google contact without email is low', () => {
    expect(assignConfidence('google', null, false)).toBe('low')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- confidence
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/confidence.ts
import type { Confidence, ContactSource } from './types.js'

export function assignConfidence(
  source: ContactSource,
  email: string | null,
  smtpVerified: boolean
): Confidence {
  switch (source) {
    case 'companies_house':
    case 'kvk':
      return email ? 'high' : 'medium'
    case 'press':
      return email ? 'high' : 'low'
    case 'website':
      return smtpVerified ? 'high' : 'medium'
    case 'google':
      return smtpVerified ? 'medium' : 'low'
    default:
      return 'low'
  }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- confidence
```

Expected: `12 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/confidence.ts scraper/src/contacts/confidence.test.ts
git commit -m "feat: add confidence assignment logic with tests"
```

---

### Task 5: Contact deduplication

**Files:**
- Create: `scraper/src/contacts/contact-dedup.ts`
- Create: `scraper/src/contacts/contact-dedup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/contact-dedup.test.ts
import { describe, it, expect } from 'vitest'
import { deduplicateContacts, capContacts } from './contact-dedup.js'
import type { EnrichedContact } from './types.js'

function makeContact(overrides: Partial<EnrichedContact> = {}): EnrichedContact {
  return {
    name: 'John Smith',
    title: 'Finance Director',
    personaType: 'hiring_manager',
    source: 'companies_house',
    email: null,
    smtpVerified: false,
    confidence: 'medium',
    ...overrides,
  }
}

describe('deduplicateContacts', () => {
  it('returns single contact unchanged', () => {
    expect(deduplicateContacts([makeContact()])).toHaveLength(1)
  })

  it('merges two contacts with same name (case-insensitive)', () => {
    const contacts = [
      makeContact({ name: 'John Smith', source: 'companies_house' }),
      makeContact({ name: 'john smith', source: 'google', email: 'j.smith@acme.co.uk' }),
    ]
    expect(deduplicateContacts(contacts)).toHaveLength(1)
  })

  it('keeps the higher-confidence version when merging', () => {
    const contacts = [
      makeContact({ name: 'John Smith', confidence: 'medium', email: null }),
      makeContact({ name: 'John Smith', confidence: 'high', email: 'j@acme.co.uk' }),
    ]
    const result = deduplicateContacts(contacts)
    expect(result[0].confidence).toBe('high')
    expect(result[0].email).toBe('j@acme.co.uk')
  })

  it('keeps contacts with different names separate', () => {
    const contacts = [
      makeContact({ name: 'John Smith' }),
      makeContact({ name: 'Jane Doe', personaType: 'agency_selector' }),
    ]
    expect(deduplicateContacts(contacts)).toHaveLength(2)
  })

  it('merges email from lower-confidence duplicate when higher has none', () => {
    const contacts = [
      makeContact({ name: 'John Smith', confidence: 'high', email: null, source: 'companies_house' }),
      makeContact({ name: 'John Smith', confidence: 'low', email: 'j@acme.co.uk', source: 'google' }),
    ]
    const result = deduplicateContacts(contacts)
    expect(result[0].email).toBe('j@acme.co.uk')
  })
})

describe('capContacts', () => {
  it('returns at most 3 contacts', () => {
    const contacts = Array.from({ length: 5 }, (_, i) =>
      makeContact({ name: `Person ${i}` })
    )
    expect(capContacts(contacts)).toHaveLength(3)
  })

  it('returns fewer than 3 when fewer available', () => {
    expect(capContacts([makeContact()])).toHaveLength(1)
  })

  it('sorts by confidence descending — high first', () => {
    const contacts = [
      makeContact({ name: 'Low', confidence: 'low' }),
      makeContact({ name: 'High', confidence: 'high' }),
      makeContact({ name: 'Medium', confidence: 'medium' }),
    ]
    expect(capContacts(contacts)[0].confidence).toBe('high')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- contact-dedup
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/contact-dedup.ts
import type { EnrichedContact, Confidence } from './types.js'

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

function dedupeKey(name: string): string {
  return name.toLowerCase().trim()
}

export function deduplicateContacts(contacts: EnrichedContact[]): EnrichedContact[] {
  const map = new Map<string, EnrichedContact>()

  for (const contact of contacts) {
    const key = dedupeKey(contact.name)
    const existing = map.get(key)

    if (!existing) {
      map.set(key, contact)
    } else {
      const contactRank = CONFIDENCE_RANK[contact.confidence]
      const existingRank = CONFIDENCE_RANK[existing.confidence]

      if (contactRank > existingRank) {
        // New contact is better — keep it, but inherit email from existing if new lacks one
        map.set(key, { ...contact, email: contact.email ?? existing.email })
      } else if (!existing.email && contact.email) {
        // Existing is better but has no email — merge email from duplicate
        map.set(key, { ...existing, email: contact.email, smtpVerified: contact.smtpVerified })
      }
    }
  }

  return Array.from(map.values())
}

export function capContacts(contacts: EnrichedContact[]): EnrichedContact[] {
  return [...contacts]
    .sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence])
    .slice(0, 3)
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- contact-dedup
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/contact-dedup.ts scraper/src/contacts/contact-dedup.test.ts
git commit -m "feat: add contact deduplication and capping with tests"
```

---

## Chunk 2: Companies House + KvK

### Task 6: Companies House client

**Files:**
- Create: `scraper/src/contacts/steps/companies-house.ts`
- Create: `scraper/src/contacts/steps/companies-house.test.ts`

> **Prerequisite:** Register for a free API key at https://developer.company-information.service.gov.uk (free, instant). Add `CH_API_KEY=your_key` to `scraper/.env`. If not set, step returns empty with a warning.

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/steps/companies-house.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('undici', () => ({ fetch: vi.fn() }))

import { findContactsViaCompaniesHouse } from './companies-house.js'
import { fetch } from 'undici'

function mockResponse(body: any, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as any)
}

describe('findContactsViaCompaniesHouse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CH_API_KEY = 'test-key'
  })
  afterEach(() => { delete process.env.CH_API_KEY })

  it('returns empty when CH_API_KEY is not set', async () => {
    delete process.env.CH_API_KEY
    expect(await findContactsViaCompaniesHouse('Acme Corp', 'uk')).toEqual([])
  })

  it('returns empty for non-UK country', async () => {
    expect(await findContactsViaCompaniesHouse('Bedrijf BV', 'nl')).toEqual([])
  })

  it('returns contacts from active directors', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse({ items: [{ company_number: '12345678' }] }))
      .mockResolvedValueOnce(mockResponse({
        items: [
          { name: 'SMITH, JOHN', officer_role: 'director', occupation: 'Finance Director' },
        ],
      }))

    const contacts = await findContactsViaCompaniesHouse('Acme Corp', 'uk')
    expect(contacts).toHaveLength(1)
    expect(contacts[0].name).toBe('John Smith')
    expect(contacts[0].source).toBe('companies_house')
    expect(contacts[0].personaType).toBe('hiring_manager')
  })

  it('skips resigned officers', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse({ items: [{ company_number: '12345678' }] }))
      .mockResolvedValueOnce(mockResponse({
        items: [{ name: 'OLD, BOB', officer_role: 'director', resigned_on: '2020-01-01' }],
      }))
    expect(await findContactsViaCompaniesHouse('Acme Corp', 'uk')).toHaveLength(0)
  })

  it('returns empty when company not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ items: [] }))
    expect(await findContactsViaCompaniesHouse('Unknown Ltd', 'uk')).toEqual([])
  })

  it('returns empty on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await findContactsViaCompaniesHouse('Acme Corp', 'uk')).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- companies-house
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/steps/companies-house.ts
import { fetch } from 'undici'
import { mapTitleToPersona } from '../persona.js'
import type { FoundContact } from '../types.js'

const CH_BASE = 'https://api.company-information.service.gov.uk'

/** CH returns names as "SURNAME, FIRSTNAME" — normalise to "Firstname Surname" */
function normaliseName(chName: string): string {
  const parts = chName.split(',').map(s => s.trim())
  if (parts.length === 2) {
    const first = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase()
    const last = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
    return `${first} ${last}`
  }
  return chName.trim()
}

async function chFetch(path: string): Promise<any> {
  const apiKey = process.env.CH_API_KEY
  if (!apiKey) return null
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
  const res = await fetch(`${CH_BASE}${path}`, {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return null
  return res.json()
}

export async function findContactsViaCompaniesHouse(
  companyName: string,
  country: string
): Promise<FoundContact[]> {
  if (country !== 'uk') return []
  if (!process.env.CH_API_KEY) {
    console.warn('[companies-house] CH_API_KEY not set — skipping')
    return []
  }
  try {
    const searchData = await chFetch(
      `/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=1`
    )
    if (!searchData?.items?.length) return []

    const companyNumber = searchData.items[0].company_number
    const officerData = await chFetch(
      `/company/${companyNumber}/officers?items_per_page=20`
    )
    if (!officerData?.items?.length) return []

    return officerData.items
      .filter((o: any) => !o.resigned_on)
      .filter((o: any) =>
        ['director', 'llp-designated-member', 'llp-member'].includes(o.officer_role)
      )
      .map((o: any): FoundContact => {
        const name = normaliseName(o.name)
        const title = o.occupation ?? o.officer_role ?? 'Director'
        return { name, title, personaType: mapTitleToPersona(title), source: 'companies_house' }
      })
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- companies-house
```

Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/steps/companies-house.ts scraper/src/contacts/steps/companies-house.test.ts
git commit -m "feat: add Companies House API client with tests"
```

---

### Task 7: KvK client

**Files:**
- Create: `scraper/src/contacts/steps/kvk.ts`
- Create: `scraper/src/contacts/steps/kvk.test.ts`

> **Note:** KvK's free API returns company registration data but not officer names in the same way CH does. This step is a stub that can be extended when API access is upgraded. NL contacts are primarily found via Google (step 2), website (step 3), and press (step 4).

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/steps/kvk.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('undici', () => ({ fetch: vi.fn() }))

import { findContactsViaKvK } from './kvk.js'
import { fetch } from 'undici'

describe('findContactsViaKvK', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.KVK_API_KEY = 'test-key'
  })
  afterEach(() => { delete process.env.KVK_API_KEY })

  it('returns empty when KVK_API_KEY is not set', async () => {
    delete process.env.KVK_API_KEY
    expect(await findContactsViaKvK('Bedrijf BV', 'nl')).toEqual([])
  })

  it('returns empty for non-NL country', async () => {
    expect(await findContactsViaKvK('Acme Corp', 'uk')).toEqual([])
  })

  it('returns empty array on successful API call (stub behaviour)', async () => {
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resultaten: [{ naam: 'Bedrijf BV', kvkNummer: '12345678' }] }),
    })
    const result = await findContactsViaKvK('Bedrijf BV', 'nl')
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns empty on network error', async () => {
    vi.mocked(fetch as any).mockRejectedValue(new Error('timeout'))
    expect(await findContactsViaKvK('Bedrijf BV', 'nl')).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- kvk
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/steps/kvk.ts
// KvK (Kamer van Koophandel) — Netherlands company registry
// API docs: https://developers.kvk.nl/documentation/zoeken
// Officer lookup requires upgraded API access — this is a stub.
import { fetch } from 'undici'
import type { FoundContact } from '../types.js'

const KVK_BASE = 'https://api.kvk.nl/api/v1'

export async function findContactsViaKvK(
  companyName: string,
  country: string
): Promise<FoundContact[]> {
  if (country !== 'nl') return []
  const apiKey = process.env.KVK_API_KEY
  if (!apiKey) {
    console.warn('[kvk] KVK_API_KEY not set — skipping')
    return []
  }
  try {
    const res = await fetch(
      `${KVK_BASE}/zoeken?handelsnaam=${encodeURIComponent(companyName)}&resultatenPerPagina=1`,
      {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(8_000),
      }
    )
    if (!res.ok) return []
    // KvK basic search confirms company exists but doesn't return officer names.
    // Returning empty — NL contacts found via steps 2-4.
    return []
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- kvk
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/steps/kvk.ts scraper/src/contacts/steps/kvk.test.ts
git commit -m "feat: add KvK stub with tests"
```

---

## Chunk 3: Google + Website + SMTP

### Task 8: Google search scraper (Steps 2 + 4)

**Files:**
- Create: `scraper/src/contacts/steps/google-search.ts`
- Create: `scraper/src/contacts/steps/google-search.test.ts`

> **Important:** Google blocks automated scrapers. On Railway (VPS IP) it's more tolerant than cloud IPs. This implementation detects CAPTCHA and returns empty rather than throwing. Rate limit to ≤1 req/10s per company if blocking occurs.

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/steps/google-search.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../scrapers/base.js', () => ({ fetchHtml: vi.fn() }))

import { searchLinkedInContacts, searchPressReleases } from './google-search.js'
import { fetchHtml } from '../../scrapers/base.js'

const MOCK_GOOGLE_HTML = `
  <html><body>
    <div class="g">
      <h3>John Smith - Finance Director at Acme Corp | LinkedIn</h3>
      <div class="VwiC3b">John Smith, Finance Director at Acme Corp.</div>
    </div>
    <div class="g">
      <h3>Jane Doe - Head of Talent at Acme Corp | LinkedIn</h3>
      <div class="VwiC3b">Jane Doe leads talent at Acme Corp.</div>
    </div>
  </body></html>
`
const CAPTCHA_HTML = `<html><body><title>Sorry...</title><p>Our systems have detected unusual traffic</p></body></html>`

const MOCK_NEWS_RSS = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>Acme Corp appoints Sarah Brown as CFO</title>
      <description>Acme Corp announced the appointment of Sarah Brown as Chief Financial Officer.</description>
    </item>
  </channel></rss>`

describe('searchLinkedInContacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns contacts from Google result snippets', async () => {
    vi.mocked(fetchHtml).mockResolvedValue(MOCK_GOOGLE_HTML)
    const contacts = await searchLinkedInContacts('Acme Corp')
    expect(contacts.length).toBeGreaterThan(0)
    expect(contacts[0].source).toBe('google')
  })

  it('returns empty on CAPTCHA detection', async () => {
    vi.mocked(fetchHtml).mockResolvedValue(CAPTCHA_HTML)
    expect(await searchLinkedInContacts('Acme Corp')).toEqual([])
  })

  it('returns empty on fetch error', async () => {
    vi.mocked(fetchHtml).mockRejectedValue(new Error('timeout'))
    expect(await searchLinkedInContacts('Acme Corp')).toEqual([])
  })

  it('returns empty for blank page', async () => {
    vi.mocked(fetchHtml).mockResolvedValue('<html><body></body></html>')
    expect(await searchLinkedInContacts('Acme Corp')).toEqual([])
  })
})

describe('searchPressReleases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('extracts contacts from RSS press release titles', async () => {
    vi.mocked(fetchHtml).mockResolvedValue(MOCK_NEWS_RSS)
    const contacts = await searchPressReleases('Acme Corp')
    expect(contacts[0]?.source).toBe('press')
  })

  it('returns empty on fetch error', async () => {
    vi.mocked(fetchHtml).mockRejectedValue(new Error('timeout'))
    expect(await searchPressReleases('Acme Corp')).toEqual([])
  })

  it('returns empty for RSS with no matching titles', async () => {
    vi.mocked(fetchHtml).mockResolvedValue(
      `<?xml version="1.0"?><rss><channel><item><title>Acme launches new product</title></item></channel></rss>`
    )
    expect(await searchPressReleases('Acme Corp')).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- google-search
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/steps/google-search.ts
import * as cheerio from 'cheerio'
import { fetchHtml } from '../../scrapers/base.js'
import { mapTitleToPersona } from '../persona.js'
import type { FoundContact } from '../types.js'

const TARGET_TITLES = [
  'Finance Director', 'CFO', 'HR Director', 'Operations Director',
  'Head of Finance', 'Head of Talent', 'Talent Acquisition',
  'HR Business Partner', 'Procurement Director', 'Chief People Officer',
  'Chief Financial Officer',
]

function isCaptcha(html: string): boolean {
  return (
    html.includes('unusual traffic') ||
    html.includes('detected unusual') ||
    html.includes('g-recaptcha')
  )
}

function parseLinkedInHeading(text: string): FoundContact | null {
  // Match "Name - Title at Company" or "Name | Title at Company"
  const match = text.match(/^([A-Z][a-z]+(?: [A-Za-z'-]+)+)\s*[-–|]\s*(.+?)(?:\s+at\s+|\s*\|)/)
  if (!match) return null
  const name = match[1].trim()
  const title = match[2].trim()
  const isTarget = TARGET_TITLES.some(t => title.toLowerCase().includes(t.toLowerCase()))
  if (!isTarget) return null
  return { name, title, personaType: mapTitleToPersona(title), source: 'google' }
}

export async function searchLinkedInContacts(companyName: string): Promise<FoundContact[]> {
  const results: FoundContact[] = []
  // Run 2 queries: one per persona type
  const queries = [
    `site:linkedin.com "${companyName}" "Finance Director" OR "CFO"`,
    `site:linkedin.com "${companyName}" "Head of Talent" OR "Talent Acquisition"`,
  ]
  for (const q of queries) {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=5`
      const html = await fetchHtml(url)
      if (isCaptcha(html)) break
      const $ = cheerio.load(html)
      $('.g h3').each((_, el) => {
        const contact = parseLinkedInHeading($(el).text())
        if (contact) results.push(contact)
      })
    } catch {
      // Individual query failure — continue to next
    }
  }
  // Deduplicate by normalised name
  const seen = new Set<string>()
  const deduped = results.filter(c => {
    const key = (c.name ?? '').toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return deduped
}

function parsePressTitle(title: string): FoundContact | null {
  const appointsMatch = title.match(/appoints?\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s+as\s+(.+)/i)
  const joinsMatch = title.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s+joins?\s+as\s+(.+)/i)
  const match = appointsMatch || joinsMatch
  if (!match) return null
  const name = match[1].trim()
  const roleTitle = match[2].trim()
  return { name, title: roleTitle, personaType: mapTitleToPersona(roleTitle), source: 'press' }
}

export async function searchPressReleases(companyName: string): Promise<FoundContact[]> {
  try {
    const q = encodeURIComponent(`"${companyName}" appoints OR "joins as"`)
    const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=GB&ceid=GB:en`
    const xml = await fetchHtml(url)
    const $ = cheerio.load(xml, { xmlMode: true })
    const results: FoundContact[] = []
    $('item title').each((_, el) => {
      const contact = parsePressTitle($(el).text())
      if (contact) results.push(contact)
    })
    return results
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- google-search
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/steps/google-search.ts scraper/src/contacts/steps/google-search.test.ts
git commit -m "feat: add Google LinkedIn + press release scraper with tests"
```

---

### Task 9: Company website scraper

**Files:**
- Create: `scraper/src/contacts/steps/website.ts`
- Create: `scraper/src/contacts/steps/website.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/steps/website.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../scrapers/base.js', () => ({ fetchHtml: vi.fn() }))

import { findContactsOnWebsite } from './website.js'
import { fetchHtml } from '../../scrapers/base.js'

const HOMEPAGE_HTML = `
  <html><body>
    <nav>
      <a href="/about-us">About</a>
      <a href="/our-team">Our Team</a>
      <a href="/contact">Contact</a>
    </nav>
  </body></html>
`
const TEAM_PAGE_HTML = `
  <html><body>
    <div class="team-member">
      <h3>Sarah Brown</h3>
      <p class="role">Chief Financial Officer</p>
    </div>
    <div class="team-member">
      <h3>Mark Taylor</h3>
      <p class="role">Head of Talent Acquisition</p>
    </div>
  </body></html>
`

describe('findContactsOnWebsite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches homepage then follows the first team-related link', async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce(HOMEPAGE_HTML)
      .mockResolvedValueOnce(TEAM_PAGE_HTML)
    await findContactsOnWebsite('acme.co.uk')
    expect(fetchHtml).toHaveBeenCalledTimes(2)
  })

  it('returns contacts found on team page', async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce(HOMEPAGE_HTML)
      .mockResolvedValueOnce(TEAM_PAGE_HTML)
    const contacts = await findContactsOnWebsite('acme.co.uk')
    expect(contacts.length).toBeGreaterThan(0)
    expect(contacts[0].source).toBe('website')
  })

  it('returns empty on fetch error', async () => {
    vi.mocked(fetchHtml).mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await findContactsOnWebsite('acme.co.uk')).toEqual([])
  })

  it('returns empty when no team-related links on homepage', async () => {
    vi.mocked(fetchHtml).mockResolvedValue(
      '<html><body><a href="/products">Products</a></body></html>'
    )
    expect(await findContactsOnWebsite('acme.co.uk')).toEqual([])
  })

  it('returns empty for homepage with no links', async () => {
    vi.mocked(fetchHtml).mockResolvedValue('<html><body><p>No navigation</p></body></html>')
    expect(await findContactsOnWebsite('acme.co.uk')).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- website
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/steps/website.ts
import * as cheerio from 'cheerio'
import { fetchHtml } from '../../scrapers/base.js'
import { mapTitleToPersona } from '../persona.js'
import type { FoundContact } from '../types.js'

const TEAM_PATH_KEYWORDS = [
  '/team', '/people', '/about', '/leadership', '/management',
  '/contact', '/over-ons', '/directie',
]

function isTeamLink(href: string): boolean {
  return TEAM_PATH_KEYWORDS.some(kw => href.toLowerCase().includes(kw))
}

const TARGET_TITLE_KEYWORDS = [
  'finance director', 'cfo', 'chief financial', 'hr director', 'operations director',
  'head of finance', 'head of talent', 'talent acquisition', 'hr business partner',
  'procurement', 'chief people', 'managing director', 'coo',
]

function looksLikeTargetTitle(title: string): boolean {
  const lower = title.toLowerCase()
  return TARGET_TITLE_KEYWORDS.some(kw => lower.includes(kw))
}

function parseTeamPage(html: string): FoundContact[] {
  const $ = cheerio.load(html)
  const results: FoundContact[] = []

  $('h2, h3, h4').each((_, el) => {
    const name = $(el).text().trim()
    // Name heuristic: 2–4 words, each starting with a capital
    if (!/^[A-Z][a-z'-]+(?: [A-Za-z'-]+){1,3}$/.test(name)) return

    const titleText =
      $(el).next('p, span, div').first().text().trim() ||
      $(el).siblings('[class*="role"],[class*="title"],[class*="position"]').first().text().trim()

    if (!titleText || !looksLikeTargetTitle(titleText)) return

    results.push({
      name,
      title: titleText,
      personaType: mapTitleToPersona(titleText),
      source: 'website',
    })
  })

  return results
}

export async function findContactsOnWebsite(domain: string): Promise<FoundContact[]> {
  try {
    const homepage = await fetchHtml(`https://${domain}`)
    const $ = cheerio.load(homepage)
    const teamLinks: string[] = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      if (isTeamLink(href)) {
        const full = href.startsWith('http') ? href : `https://${domain}${href}`
        if (!teamLinks.includes(full)) teamLinks.push(full)
      }
    })

    if (!teamLinks.length) return []

    const teamHtml = await fetchHtml(teamLinks[0])
    return parseTeamPage(teamHtml)
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- website
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/steps/website.ts scraper/src/contacts/steps/website.test.ts
git commit -m "feat: add company website contact scraper with tests"
```

---

### Task 10: SMTP verifier

**Files:**
- Create: `scraper/src/contacts/steps/smtp-verify.ts`
- Create: `scraper/src/contacts/steps/smtp-verify.test.ts`

> **How it works:** DNS MX lookup → TCP connect to MX server port 25 → EHLO + MAIL FROM + RCPT TO → 2xx = accepted, 5xx = rejected, 4xx/timeout = inconclusive (returns false). No email is ever sent.
>
> **Limitation:** Catch-all servers accept all RCPT TO — false positives are expected. This is acceptable for MVP.

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/steps/smtp-verify.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:net', () => ({ createConnection: vi.fn() }))
vi.mock('node:dns/promises', () => ({ resolveMx: vi.fn() }))

import { verifySMTP, lookupMxHost } from './smtp-verify.js'
import * as net from 'node:net'
import * as dns from 'node:dns/promises'

describe('lookupMxHost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns highest-priority MX host', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { priority: 20, exchange: 'mail2.example.com' },
      { priority: 10, exchange: 'mail1.example.com' },
    ])
    expect(await lookupMxHost('example.com')).toBe('mail1.example.com')
  })

  it('returns null when no MX records', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([])
    expect(await lookupMxHost('example.com')).toBeNull()
  })

  it('returns null on DNS error', async () => {
    vi.mocked(dns.resolveMx).mockRejectedValue(new Error('ENOTFOUND'))
    expect(await lookupMxHost('example.com')).toBeNull()
  })
})

describe('verifySMTP', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when MX lookup fails', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([])
    expect(await verifySMTP('john@example.com')).toBe(false)
  })

  it('returns false on connection error', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { priority: 10, exchange: 'mail.example.com' },
    ])
    const mockSocket = {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    }
    vi.mocked(net.createConnection).mockReturnValue(mockSocket as any)
    // Simulate error event
    mockSocket.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'error') setTimeout(() => cb(new Error('ECONNREFUSED')), 0)
    })
    expect(await verifySMTP('john@example.com', 500)).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- smtp-verify
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/steps/smtp-verify.ts
import * as net from 'node:net'
import * as dns from 'node:dns/promises'

export async function lookupMxHost(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolveMx(domain)
    if (!records.length) return null
    return records.sort((a, b) => a.priority - b.priority)[0].exchange
  } catch {
    return null
  }
}

export async function verifySMTP(email: string, timeoutMs = 8_000): Promise<boolean> {
  const [, domain] = email.split('@')
  if (!domain) return false

  const mxHost = await lookupMxHost(domain)
  if (!mxHost) return false

  return new Promise<boolean>(resolve => {
    let settled = false
    function settle(result: boolean) {
      if (settled) return
      settled = true
      resolve(result)
    }

    const timer = setTimeout(() => {
      socket.destroy()
      settle(false)
    }, timeoutMs)

    const socket = net.createConnection({ host: mxHost, port: 25 })
    let step = 0
    let rcptAccepted = false

    const lines = [
      `EHLO bdmprospector.app\r\n`,
      `MAIL FROM:<verify@bdmprospector.app>\r\n`,
      `RCPT TO:<${email}>\r\n`,
      `QUIT\r\n`,
    ]

    socket.on('error', () => {
      clearTimeout(timer)
      settle(false)
    })

    socket.on('data', (data: Buffer) => {
      const code = parseInt(data.toString().slice(0, 3), 10)
      if (step === 3) {
        rcptAccepted = code >= 200 && code < 300
      }
      if (step < lines.length) {
        socket.write(lines[step])
        step++
      } else {
        clearTimeout(timer)
        socket.end()
        settle(rcptAccepted)
      }
    })

    socket.on('close', () => {
      clearTimeout(timer)
      settle(rcptAccepted)
    })
  })
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- smtp-verify
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/steps/smtp-verify.ts scraper/src/contacts/steps/smtp-verify.test.ts
git commit -m "feat: add SMTP email verifier with MX lookup and tests"
```

---

## Chunk 4: Waterfall Orchestrator + DB Writer

### Task 11: Waterfall orchestrator

**Files:**
- Create: `scraper/src/contacts/waterfall.ts`
- Create: `scraper/src/contacts/waterfall.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/contacts/waterfall.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./steps/companies-house.js', () => ({
  findContactsViaCompaniesHouse: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/kvk.js', () => ({
  findContactsViaKvK: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/google-search.js', () => ({
  searchLinkedInContacts: vi.fn().mockResolvedValue([]),
  searchPressReleases: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/website.js', () => ({
  findContactsOnWebsite: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/smtp-verify.js', () => ({
  verifySMTP: vi.fn().mockResolvedValue(false),
}))

import { runWaterfall } from './waterfall.js'
import * as ch from './steps/companies-house.js'
import * as kvk from './steps/kvk.js'
import * as google from './steps/google-search.js'
import * as website from './steps/website.js'
import * as smtp from './steps/smtp-verify.js'
import type { FoundContact } from './types.js'

function makeFound(overrides: Partial<FoundContact> = {}): FoundContact {
  return {
    name: 'John Smith',
    title: 'Finance Director',
    personaType: 'hiring_manager',
    source: 'companies_house',
    ...overrides,
  }
}

describe('runWaterfall', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when no contacts found', async () => {
    expect(await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')).toEqual([])
  })

  it('calls CH step for UK companies', async () => {
    await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')
    expect(ch.findContactsViaCompaniesHouse).toHaveBeenCalledWith('Acme Corp', 'uk')
  })

  it('calls KvK step for NL companies', async () => {
    await runWaterfall('Bedrijf BV', 'bedrijf.nl', 'nl')
    expect(kvk.findContactsViaKvK).toHaveBeenCalledWith('Bedrijf BV', 'nl')
  })

  it('proceeds to Google step when CH returns nothing', async () => {
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue([])
    await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')
    expect(google.searchLinkedInContacts).toHaveBeenCalledWith('Acme Corp')
  })

  it('skips Google step when 3 high-confidence contacts found after CH + SMTP', async () => {
    const contacts: FoundContact[] = [
      makeFound({ name: 'Alice A' }),
      makeFound({ name: 'Bob B' }),
      makeFound({ name: 'Carol C' }),
    ]
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue(contacts)
    // SMTP verifies all → CH + email = high confidence
    vi.mocked(smtp.verifySMTP).mockResolvedValue(true)

    const result = await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')

    expect(google.searchLinkedInContacts).not.toHaveBeenCalled()
    expect(result).toHaveLength(3)
  })

  it('returns at most 3 contacts', async () => {
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => makeFound({ name: `Person ${i}` }))
    )
    expect((await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')).length).toBeLessThanOrEqual(3)
  })

  it('deduplicates contacts with same name from different sources', async () => {
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue([
      makeFound({ name: 'John Smith', source: 'companies_house' }),
    ])
    vi.mocked(google.searchLinkedInContacts).mockResolvedValue([
      makeFound({ name: 'john smith', source: 'google' }),
    ])
    const result = await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')
    expect(result.filter(c => c.name.toLowerCase() === 'john smith')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- waterfall
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/contacts/waterfall.ts
import { findContactsViaCompaniesHouse } from './steps/companies-house.js'
import { findContactsViaKvK } from './steps/kvk.js'
import { searchLinkedInContacts, searchPressReleases } from './steps/google-search.js'
import { findContactsOnWebsite } from './steps/website.js'
import { verifySMTP } from './steps/smtp-verify.js'
import { generateEmailPatterns, splitName } from './email-patterns.js'
import { assignConfidence } from './confidence.js'
import { deduplicateContacts, capContacts } from './contact-dedup.js'
import type { FoundContact, EnrichedContact } from './types.js'

async function enrichContact(contact: FoundContact, domain: string): Promise<EnrichedContact> {
  const { first, last } = splitName(contact.name)
  const patterns = generateEmailPatterns(first, last, domain)

  let email: string | null = null
  let smtpVerified = false

  for (const pattern of patterns) {
    const verified = await verifySMTP(pattern)
    if (verified) {
      email = pattern
      smtpVerified = true
      break
    }
  }
  // Per spec: "Companies House / KvK name + any email → High"
  // An unverified pattern still counts as "any email" — spec intends this.
  // For Google contacts, email=unverified → assignConfidence returns 'low' (correct).
  if (!email && patterns.length) email = patterns[0]

  const confidence = assignConfidence(contact.source, email, smtpVerified)
  return { ...contact, email, smtpVerified, confidence }
}

function hasEnough(contacts: EnrichedContact[]): boolean {
  return deduplicateContacts(contacts).filter(c => c.confidence === 'high').length >= 3
}

export async function runWaterfall(
  companyName: string,
  domain: string,
  country: string
): Promise<EnrichedContact[]> {
  const enriched: EnrichedContact[] = []

  async function runStep(found: FoundContact[]): Promise<void> {
    for (const contact of found) {
      enriched.push(await enrichContact(contact, domain))
    }
  }

  // Step 1: Companies House (UK) or KvK (NL)
  const step1 = country === 'nl'
    ? await findContactsViaKvK(companyName, country)
    : await findContactsViaCompaniesHouse(companyName, country)
  await runStep(step1)
  if (hasEnough(enriched)) return capContacts(deduplicateContacts(enriched))

  // Step 2: Google LinkedIn search
  await runStep(await searchLinkedInContacts(companyName))
  if (hasEnough(enriched)) return capContacts(deduplicateContacts(enriched))

  // Step 3: Company website
  await runStep(await findContactsOnWebsite(domain))
  if (hasEnough(enriched)) return capContacts(deduplicateContacts(enriched))

  // Step 4: Press releases
  await runStep(await searchPressReleases(companyName))

  return capContacts(deduplicateContacts(enriched))
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- waterfall
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/contacts/waterfall.ts scraper/src/contacts/waterfall.test.ts
git commit -m "feat: add waterfall orchestrator with early-exit and dedup"
```

---

### Task 12: Add contacts unique constraint migration

**Files:**
- Create: `supabase/migrations/004_contacts_unique_constraint.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/004_contacts_unique_constraint.sql
-- Required for upsert on (company_id, name) in contacts table
ALTER TABLE contacts
  ADD CONSTRAINT contacts_company_name_unique UNIQUE (company_id, name);
```

- [ ] **Step 2: Apply migration**

```bash
supabase db push
```

Expected: `Applying migration 004_contacts_unique_constraint.sql... done`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_contacts_unique_constraint.sql
git commit -m "feat: add unique constraint on contacts(company_id, name)"
```

---

### Task 13: Contacts DB writer

**Files:**
- Create: `scraper/src/db/contacts.ts`
- Create: `scraper/src/db/contacts.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// scraper/src/db/contacts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client.js', () => ({ db: { from: vi.fn() } }))

import { upsertContact } from './contacts.js'
import { db } from './client.js'
import type { EnrichedContact } from '../contacts/types.js'

function makeContact(overrides: Partial<EnrichedContact> = {}): EnrichedContact {
  return {
    name: 'John Smith',
    title: 'Finance Director',
    personaType: 'hiring_manager',
    source: 'companies_house',
    email: 'j.smith@acme.co.uk',
    smtpVerified: true,
    confidence: 'high',
    ...overrides,
  }
}

describe('upsertContact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the upserted contact id', async () => {
    const selectMock = { single: vi.fn().mockResolvedValue({ data: { id: 'ct-1' }, error: null }) }
    const upsertMock = { select: vi.fn().mockReturnValue(selectMock) }
    vi.mocked(db.from).mockReturnValue({ upsert: vi.fn().mockReturnValue(upsertMock) } as any)

    expect(await upsertContact('co-1', makeContact())).toBe('ct-1')
  })

  it('maps camelCase to snake_case DB columns', async () => {
    const upsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ct-1' }, error: null }),
      }),
    })
    vi.mocked(db.from).mockReturnValue({ upsert: upsertFn } as any)

    await upsertContact('co-1', makeContact())
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'co-1',
        persona_type: 'hiring_manager',
        smtp_verified: true,
      }),
      expect.anything()
    )
  })

  it('throws on DB error', async () => {
    const selectMock = {
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } }),
    }
    const upsertMock = { select: vi.fn().mockReturnValue(selectMock) }
    vi.mocked(db.from).mockReturnValue({ upsert: vi.fn().mockReturnValue(upsertMock) } as any)

    await expect(upsertContact('co-1', makeContact())).rejects.toThrow('unique violation')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- db/contacts
```

- [ ] **Step 3: Implement**

```typescript
// scraper/src/db/contacts.ts
import { db } from './client.js'
import type { EnrichedContact } from '../contacts/types.js'

export async function upsertContact(companyId: string, contact: EnrichedContact): Promise<string> {
  const { data, error } = await db
    .from('contacts')
    .upsert(
      {
        company_id: companyId,
        name: contact.name,
        title: contact.title,
        persona_type: contact.personaType,
        email: contact.email,
        smtp_verified: contact.smtpVerified,
        confidence: contact.confidence,
        source: contact.source,
        found_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,name' }
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- db/contacts
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add scraper/src/db/contacts.ts scraper/src/db/contacts.test.ts
git commit -m "feat: add contacts DB writer with upsert on (company_id, name)"
```

---

## Chunk 5: Wire Into Entry Point

### Task 14: Update entry point

**Files:**
- Modify: `scraper/src/index.ts`

- [ ] **Step 1: Update handleScrapeJob to run waterfall after signals**

```typescript
// scraper/src/index.ts — full replacement
import 'dotenv/config'
import { db } from './db/client.js'
import { startPoller } from './queue/poller.js'
import { startTimeoutChecker } from './queue/timeout-checker.js'
import { fanOut } from './scrapers/index.js'
import { upsertCompany } from './db/companies.js'
import { insertJobSignal } from './db/job-signals.js'
import { upsertContact } from './db/contacts.js'
import { runWaterfall } from './contacts/waterfall.js'
import { normaliseContractType, normaliseSeniority, isPermanent } from './normalise/nl-terms.js'
import { normaliseDomain } from './normalise/domain.js'
import type { ScrapeJob } from './types.js'

// Map board name → country for 'both' searches where job.filters.country doesn't tell us
const NL_BOARDS = new Set([
  'indeed-nl', 'nationale-vacaturebank', 'monsterboard',
  'intermediair', 'stepstone-nl', 'jobbird', 'flexmarkt',
])

function countryForResult(board: string, jobCountry: string | undefined): 'uk' | 'nl' {
  if (jobCountry === 'uk') return 'uk'
  if (jobCountry === 'nl') return 'nl'
  // 'both' or unset — derive from board
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
    country: string
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

  // Phase 2: run contact waterfall per company (async enrichment)
  // UI already shows companies from Phase 1 while this runs
  await Promise.all(
    companyMeta.map(async ({ companyId, domain, name, country }) => {
      try {
        const contacts = await runWaterfall(name, domain, country)
        for (const contact of contacts) {
          await upsertContact(companyId, contact)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[scraper] Waterfall failed for ${domain}: ${msg}`)
      }
    })
  )

  console.log(`[scraper] Job ${job.id} done — ${count} signals, waterfall complete`)
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

Expected: all tests pass (Part 2 tests + 84 new Part 3 tests)

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Expected output:
```
Scraper service started. DB OK.
Polling for jobs every 2s...
```

- [ ] **Step 4: Insert test scrape job**

In Supabase dashboard → Table Editor → `scrape_jobs` → Insert:
```json
{ "query": "interim finance director", "filters": {"country": "uk"}, "status": "queued" }
```

Watch terminal. Within 15s: companies + signals written. Within 60s: contacts appear in `contacts` table.

> **Expected:** If `CH_API_KEY` is not set, Companies House step is skipped — contacts still appear from Google/website steps (may take longer).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/index.ts
git commit -m "feat: wire contact waterfall into entry point — Phase 1 signals, Phase 2 contacts"
```

---

## Part 3 Complete ✅

**What you now have:**
- Persona title mapping (13 tests)
- Email pattern generator (13 tests)
- Confidence assignment (12 tests)
- Contact deduplication + capping (8 tests)
- Companies House API client — UK directors (6 tests)
- KvK stub — NL, extendable (4 tests)
- Google LinkedIn + press release scraper (7 tests)
- Company website scraper (5 tests)
- SMTP email verifier via node:net (5 tests)
- Waterfall orchestrator with early-exit at 3 high-confidence (7 tests)
- Contacts DB writer with upsert on (company_id, name) (3 tests)
- Entry point: Phase 1 (fast signals) + Phase 2 (async contacts)

**Total new tests: 83**

**Environment variables added to `scraper/.env`:**
```
CH_API_KEY=       # Free — register at developer.company-information.service.gov.uk
KVK_API_KEY=      # Free tier — register at developers.kvk.nl
```

**Next:** Part 4 — Scoring Engine (recency decay, bonuses, pipeline penalty, atomic DB write)
