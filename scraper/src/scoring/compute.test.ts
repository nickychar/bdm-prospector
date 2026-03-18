import { describe, it, expect } from 'vitest'
import { computeScore } from './compute.js'
import type { ScoringInput } from './compute.js'

function makeSignal(overrides: Partial<ScoringInput['signals'][0]> = {}) {
  return {
    postedDate: new Date().toISOString().split('T')[0],
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

const REF = new Date('2026-03-17')

describe('computeScore — recency', () => {
  it('returns 0 for empty signals', () => {
    expect(computeScore({ signals: [], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(0)
  })
  it('scores 30 for signal posted today', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('scores 22 for signal posted 2 days ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-15' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(22)
  })
  it('scores 22 for signal posted 1 day ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-16' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(22)
  })
  it('scores 22 for signal posted 3 days ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-14' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(22)
  })
  it('scores 15 for signal posted 4 days ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-13' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(15)
  })
  it('scores 15 for signal posted 7 days ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-10' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(15)
  })
  it('scores 8 for signal posted 8 days ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-09' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(8)
  })
  it('scores 8 for signal posted 30 days ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-02-15' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(8)
  })
  it('scores 0 for signal posted 31+ days ago', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-02-14' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(0)
  })
  it('uses the most recent signal for recency when multiple signals exist', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-02-01' }), makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('ignores signals with null postedDate for recency', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: null })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(0)
  })
})

describe('computeScore — bonuses', () => {
  it('adds +15 for serial poster (3+ signals in last 90 days)', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' }), makeSignal({ postedDate: '2026-03-10' }), makeSignal({ postedDate: '2026-03-03' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(45)
  })
  it('does NOT add serial poster bonus for exactly 2 signals in 90 days', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' }), makeSignal({ postedDate: '2026-03-10' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('serial poster only counts signals within 90 days', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' }), makeSignal({ postedDate: '2026-03-10' }), makeSignal({ postedDate: '2025-12-01' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('serial poster: signal on exactly day 90 IS counted', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' }), makeSignal({ postedDate: '2026-03-10' }), makeSignal({ postedDate: '2025-12-17' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(45)
  })
  it('serial poster: signal on day 91 is NOT counted', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' }), makeSignal({ postedDate: '2026-03-10' }), makeSignal({ postedDate: '2025-12-16' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('adds +8 for Flexmarkt signal', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17', board: 'flexmarkt' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(38)
  })
  it('does NOT add Flexmarkt bonus for non-Flexmarkt board', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17', board: 'reed' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('adds +5 for multi-board (boardsCount >= 3 on most recent signal)', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17', boardsCount: 3 })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(35)
  })
  it('does NOT add multi-board bonus for boardsCount = 2 on most recent signal', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17', boardsCount: 2 })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('checks boardsCount only on the most recent signal, not older ones', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17', boardsCount: 1 }), makeSignal({ postedDate: '2026-03-10', boardsCount: 5 })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
})

describe('computeScore — contact bonuses', () => {
  it('adds +10 for hiring manager contact with high confidence', () => {
    expect(computeScore({ signals: [], contacts: [makeContact({ personaType: 'hiring_manager', confidence: 'high' })], stage: null, sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('adds +10 for hiring manager contact with medium confidence', () => {
    expect(computeScore({ signals: [], contacts: [makeContact({ personaType: 'hiring_manager', confidence: 'medium' })], stage: null, sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('does NOT add hiring manager bonus for low confidence', () => {
    expect(computeScore({ signals: [], contacts: [makeContact({ personaType: 'hiring_manager', confidence: 'low' })], stage: null, sizeBand: null, referenceDate: REF })).toBe(0)
  })
  it('adds +10 for agency selector contact (non-low confidence)', () => {
    expect(computeScore({ signals: [], contacts: [makeContact({ personaType: 'agency_selector', confidence: 'medium' })], stage: null, sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('adds both HM and AS bonuses when both present', () => {
    expect(computeScore({ signals: [], contacts: [makeContact({ personaType: 'hiring_manager', confidence: 'high' }), makeContact({ personaType: 'agency_selector', confidence: 'medium' })], stage: null, sizeBand: null, referenceDate: REF })).toBe(20)
  })
  it('adds +5 for SMTP verified contact', () => {
    expect(computeScore({ signals: [], contacts: [makeContact({ smtpVerified: true })], stage: null, sizeBand: null, referenceDate: REF })).toBe(15)
  })
  it('does NOT add SMTP bonus when no contact is smtp_verified', () => {
    expect(computeScore({ signals: [], contacts: [makeContact({ smtpVerified: false })], stage: null, sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('adds +5 for company size mid', () => {
    expect(computeScore({ signals: [], contacts: [], stage: null, sizeBand: 'mid', referenceDate: REF })).toBe(5)
  })
  it('does NOT add size bonus for small', () => {
    expect(computeScore({ signals: [], contacts: [], stage: null, sizeBand: 'small', referenceDate: REF })).toBe(0)
  })
  it('does NOT add size bonus for large', () => {
    expect(computeScore({ signals: [], contacts: [], stage: null, sizeBand: 'large', referenceDate: REF })).toBe(0)
  })
})

describe('computeScore — pipeline penalty', () => {
  it('deducts 20 for stage = contacted', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: 'contacted', sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('deducts 20 for stage = replied', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: 'replied', sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('deducts 20 for stage = meeting_booked', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: 'meeting_booked', sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('deducts 20 for stage = proposal_sent', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: 'proposal_sent', sizeBand: null, referenceDate: REF })).toBe(10)
  })
  it('does NOT deduct for stage = new', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: 'new', sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('does NOT deduct for stage = won', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: 'won', sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('does NOT deduct for stage = dead', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: 'dead', sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('does NOT deduct when stage is null', () => {
    expect(computeScore({ signals: [makeSignal({ postedDate: '2026-03-17' })], contacts: [], stage: null, sizeBand: null, referenceDate: REF })).toBe(30)
  })
  it('floors score at 0 — never negative', () => {
    expect(computeScore({ signals: [], contacts: [], stage: 'contacted', sizeBand: null, referenceDate: REF })).toBe(0)
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
    // 30 + 15 + 8 + 5 + 10 + 10 + 5 + 5 = 88
    expect(computeScore(input)).toBe(88)
  })
})
