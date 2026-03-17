import { describe, it, expect } from 'vitest'
import { deduplicateResults } from './dedup.js'
import type { RawJobResult } from '../types.js'

function makeResult(overrides: Partial<RawJobResult> = {}): RawJobResult {
  return {
    companyName: 'Acme Corp', companyDomain: 'acme.co.uk',
    jobTitle: 'Interim Finance Director', board: 'reed',
    postedDate: '2026-03-17', snippet: 'Looking for an interim FD',
    contractTypeRaw: 'interim', seniorityRaw: 'director', ...overrides,
  }
}

describe('deduplicateResults', () => {
  it('returns single result unchanged', () => { expect(deduplicateResults([makeResult()])).toHaveLength(1) })
  it('merges two results with same domain into one', () => {
    expect(deduplicateResults([makeResult({ board: 'reed' }), makeResult({ board: 'totaljobs' })])).toHaveLength(1)
  })
  it('increments boardsCount when merging', () => {
    const r = deduplicateResults([makeResult({ board: 'reed' }), makeResult({ board: 'totaljobs' }), makeResult({ board: 'indeed-uk' })])
    expect(r[0].boardsCount).toBe(3)
  })
  it('keeps the most recent postedDate when merging', () => {
    const r = deduplicateResults([makeResult({ board: 'reed', postedDate: '2026-03-15' }), makeResult({ board: 'totaljobs', postedDate: '2026-03-17' })])
    expect(r[0].postedDate).toBe('2026-03-17')
  })
  it('keeps results with different domains separate', () => {
    expect(deduplicateResults([makeResult({ companyDomain: 'acme.co.uk' }), makeResult({ companyDomain: 'beta.co.uk', companyName: 'Beta Ltd' })])).toHaveLength(2)
  })
  it('falls back to normalised company name when domain is null', () => {
    const r = deduplicateResults([makeResult({ companyDomain: null, companyName: 'Acme Corp' }), makeResult({ companyDomain: null, companyName: 'Acme Corp', board: 'totaljobs' })])
    expect(r).toHaveLength(1)
    expect(r[0].boardsCount).toBe(2)
  })
  it('treats different companies with null domain as separate', () => {
    expect(deduplicateResults([makeResult({ companyDomain: null, companyName: 'Acme Corp' }), makeResult({ companyDomain: null, companyName: 'Beta Ltd' })])).toHaveLength(2)
  })
  it('is case-insensitive when matching by domain', () => {
    expect(deduplicateResults([makeResult({ companyDomain: 'ACME.CO.UK' }), makeResult({ companyDomain: 'acme.co.uk', board: 'totaljobs' })])).toHaveLength(1)
  })
  it('collects all boards in boardsList', () => {
    const r = deduplicateResults([makeResult({ board: 'reed' }), makeResult({ board: 'totaljobs' })])
    expect(r[0].boardsList).toContain('reed')
    expect(r[0].boardsList).toContain('totaljobs')
  })
})
