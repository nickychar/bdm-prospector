import { describe, it, expect } from 'vitest'
import { buildSearchUrl, parseResults } from './indeed-nl.js'
describe('buildSearchUrl', () => {
  it('uses indeed.nl', () => { expect(buildSearchUrl('interim', {})).toContain('indeed.nl') })
  it('includes Nederland as location', () => { expect(buildSearchUrl('interim', {})).toContain('Nederland') })
})
describe('parseResults', () => {
  it('returns empty for blank page', () => { expect(parseResults('<html><body></body></html>')).toHaveLength(0) })
  it('sets board to indeed-nl', () => {
    const html = `<html><body><div class="job_seen_beacon"><h2 class="jobTitle"><a>Interim Manager</a></h2><span class="companyName">NL Corp</span></div></body></html>`
    expect(parseResults(html)[0].board).toBe('indeed-nl')
  })
})
