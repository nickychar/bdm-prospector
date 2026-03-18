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
    scrape_job_id: null,
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
