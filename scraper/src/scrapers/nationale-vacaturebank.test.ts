import { describe, it, expect } from 'vitest'
import { buildSearchUrl, parseResults } from './nationale-vacaturebank.js'
describe('buildSearchUrl', () => {
  it('targets nationalevacaturebank.nl', () => { expect(buildSearchUrl('interim', {})).toContain('nationalevacaturebank.nl') })
  it('adds days=1 for today filter', () => { expect(buildSearchUrl('interim', { date_posted: 'today' })).toContain('days=1') })
})
describe('parseResults', () => {
  it('returns empty for blank page', () => { expect(parseResults('<html><body></body></html>')).toHaveLength(0) })
})
