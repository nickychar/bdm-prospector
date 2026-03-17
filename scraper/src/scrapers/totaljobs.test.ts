import { describe, it, expect } from 'vitest'
import { buildSearchUrl, parseResults } from './totaljobs.js'
describe('buildSearchUrl', () => {
  it('includes totaljobs.com domain', () => { expect(buildSearchUrl('interim finance', {})).toContain('totaljobs.com') })
  it('encodes query', () => { expect(buildSearchUrl('interim finance director', {})).toContain('interim') })
  it('adds posted_by filter for today', () => { expect(buildSearchUrl('interim', { date_posted: 'today' })).toContain('postedwithin=1') })
})
describe('parseResults', () => {
  const mockHtml = `<html><body><div class="job-result-summary"><h2 class="job-title"><a href="/job/123">Interim CFO</a></h2><div class="job-company">Delta Plc</div></div></body></html>`
  it('extracts one result', () => { expect(parseResults(mockHtml)).toHaveLength(1) })
  it('extracts job title', () => { expect(parseResults(mockHtml)[0].jobTitle).toBe('Interim CFO') })
  it('extracts company', () => { expect(parseResults(mockHtml)[0].companyName).toBe('Delta Plc') })
  it('sets board to totaljobs', () => { expect(parseResults(mockHtml)[0].board).toBe('totaljobs') })
  it('returns empty for no results', () => { expect(parseResults('<html><body></body></html>')).toHaveLength(0) })
})
