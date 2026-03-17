import { describe, it, expect } from 'vitest'
import { buildSearchUrl, parseResults } from './reed.js'

describe('buildSearchUrl', () => {
  it('encodes the query in the URL', () => {
    const url = buildSearchUrl('interim finance director', {})
    expect(url).toContain('interim')
    expect(url).toContain('reed.co.uk')
  })
  it('includes date filter for recent posts', () => { expect(buildSearchUrl('interim', { date_posted: 'today' })).toContain('datecreatedoffset=LastDay') })
  it('uses LastWeek for week filter', () => { expect(buildSearchUrl('interim', { date_posted: 'week' })).toContain('datecreatedoffset=LastWeek') })
  it('includes location for UK searches', () => { expect(buildSearchUrl('interim finance', { country: 'uk' })).toContain('reed.co.uk') })
})

describe('parseResults', () => {
  const mockHtml = `<html><body>
    <article data-qa="job-result">
      <h2><a data-qa="job-title-link" href="/jobs/interim-fd/123">Interim Finance Director</a></h2>
      <a data-qa="job-title-link" class="gtmJobListingPostedBy">Acme Corp</a>
      <div class="job-result-heading__posted-by"><span>Posted: <time datetime="2026-03-17">17 Mar 2026</time></span></div>
      <div class="job-result__description">Looking for an interim FD to cover maternity leave.</div>
    </article>
    <article data-qa="job-result">
      <h2><a data-qa="job-title-link" href="/jobs/temp-hr-dir/456">Temporary HR Director</a></h2>
      <a data-qa="job-title-link" class="gtmJobListingPostedBy">Beta Ltd</a>
      <div class="job-result-heading__posted-by"><span>Posted: <time datetime="2026-03-16">16 Mar 2026</time></span></div>
    </article>
  </body></html>`

  it('returns one result per job article', () => { expect(parseResults(mockHtml)).toHaveLength(2) })
  it('extracts job title', () => { expect(parseResults(mockHtml)[0].jobTitle).toBe('Interim Finance Director') })
  it('extracts company name', () => { expect(parseResults(mockHtml)[0].companyName).toBe('Acme Corp') })
  it('extracts posted date from datetime attribute', () => { expect(parseResults(mockHtml)[0].postedDate).toBe('2026-03-17') })
  it('sets board to "reed"', () => { parseResults(mockHtml).forEach(r => expect(r.board).toBe('reed')) })
  it('returns empty array for page with no results', () => { expect(parseResults('<html><body><p>No jobs found</p></body></html>')).toHaveLength(0) })
})
