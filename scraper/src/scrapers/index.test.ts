import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./indeed-nl.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./nationale-vacaturebank.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./monsterboard.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./intermediair.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./stepstone-nl.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./jobbird.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))
vi.mock('./flexmarkt.js', () => ({ scrape: vi.fn().mockResolvedValue([]) }))

import { fanOut } from './index.js'
import * as indeedNl from './indeed-nl.js'
import * as flexmarkt from './flexmarkt.js'

describe('fanOut', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs all NL scrapers', async () => {
    await fanOut('interim finance', {})
    expect(indeedNl.scrape).toHaveBeenCalled()
    expect(flexmarkt.scrape).toHaveBeenCalled()
  })

  it('passes query and filters to each scraper', async () => {
    await fanOut('finance manager', { country: 'nl' })
    expect(indeedNl.scrape).toHaveBeenCalledWith('finance manager', { country: 'nl' })
  })

  it('returns deduplicated results', async () => {
    vi.mocked(indeedNl.scrape).mockResolvedValue([{
      companyName: 'Acme BV', companyDomain: 'acme.nl', jobTitle: 'Finance Manager',
      board: 'indeed-nl', postedDate: '2026-03-17', snippet: null,
      contractTypeRaw: null, seniorityRaw: null,
    }])
    const results = await fanOut('finance manager', {})
    expect(results.find(r => r.companyDomain === 'acme.nl')).toBeDefined()
  })

  it('continues if one scraper fails', async () => {
    vi.mocked(indeedNl.scrape).mockRejectedValue(new Error('connection refused'))
    await expect(fanOut('interim', {})).resolves.not.toThrow()
  })
})
