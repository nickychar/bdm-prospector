import { describe, it, expect } from 'vitest'
import { buildSearchUrl, parseResults } from './indeed-uk.js'
describe('buildSearchUrl', () => {
  it('uses indeed.co.uk', () => { expect(buildSearchUrl('interim finance', {})).toContain('indeed.co.uk') })
  it('sets fromage=1 for today', () => { expect(buildSearchUrl('interim', { date_posted: 'today' })).toContain('fromage=1') })
  it('sets fromage=7 for week', () => { expect(buildSearchUrl('interim', { date_posted: 'week' })).toContain('fromage=7') })
})
describe('parseResults', () => {
  const mockHtml = `<html><body><div class="job_seen_beacon"><h2 class="jobTitle"><a>Interim Finance Director</a></h2><span class="companyName">Gamma Ltd</span></div></body></html>`
  it('extracts one result', () => { expect(parseResults(mockHtml)).toHaveLength(1) })
  it('extracts title', () => { expect(parseResults(mockHtml)[0].jobTitle).toContain('Finance Director') })
  it('sets board to indeed-uk', () => { expect(parseResults(mockHtml)[0].board).toBe('indeed-uk') })
  it('handles empty page', () => { expect(parseResults('<html><body></body></html>')).toHaveLength(0) })
})
