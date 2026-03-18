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
