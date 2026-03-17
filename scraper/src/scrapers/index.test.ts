import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./reed.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./totaljobs.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./indeed-uk.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./indeed-nl.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./nationale-vacaturebank.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./monsterboard.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./intermediair.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./stepstone-nl.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./jobbird.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./flexmarkt.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))

import { fanOut } from './index.js'
import * as reed from './reed.js'
import * as indeedNl from './indeed-nl.js'

describe('fanOut', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs UK scrapers for country=uk', async () => {
    await fanOut('interim finance', { country: 'uk' })
    expect(reed.scrape).toHaveBeenCalled()
    expect(indeedNl.scrape).not.toHaveBeenCalled()
  })
  it('runs NL scrapers for country=nl', async () => {
    await fanOut('interim finance', { country: 'nl' })
    expect(indeedNl.scrape).toHaveBeenCalled()
    expect(reed.scrape).not.toHaveBeenCalled()
  })
  it('runs all scrapers for country=both', async () => {
    await fanOut('interim finance', { country: 'both' })
    expect(reed.scrape).toHaveBeenCalled()
    expect(indeedNl.scrape).toHaveBeenCalled()
  })
  it('runs all scrapers when country is null', async () => {
    await fanOut('interim finance', {})
    expect(reed.scrape).toHaveBeenCalled()
    expect(indeedNl.scrape).toHaveBeenCalled()
  })
  it('returns deduplicated results', async () => {
    vi.mocked(reed.scrape).mockResolvedValue([{
      companyName: 'Acme', companyDomain: 'acme.co.uk', jobTitle: 'Interim FD',
      board: 'reed', postedDate: '2026-03-17', snippet: null, contractTypeRaw: 'interim', seniorityRaw: 'director',
    }])
    const results = await fanOut('interim', { country: 'both' })
    expect(results.find(r => r.companyDomain === 'acme.co.uk')).toBeDefined()
  })
  it('continues if one scraper fails', async () => {
    vi.mocked(reed.scrape).mockRejectedValue(new Error('connection refused'))
    await expect(fanOut('interim', { country: 'uk' })).resolves.not.toThrow()
  })
})
