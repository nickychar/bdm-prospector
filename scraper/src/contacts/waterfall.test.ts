// scraper/src/contacts/waterfall.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./steps/companies-house.js', () => ({
  findContactsViaCompaniesHouse: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/kvk.js', () => ({
  findContactsViaKvK: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/google-search.js', () => ({
  searchLinkedInContacts: vi.fn().mockResolvedValue([]),
  searchPressReleases: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/website.js', () => ({
  findContactsOnWebsite: vi.fn().mockResolvedValue([]),
}))
vi.mock('./steps/smtp-verify.js', () => ({
  verifySMTP: vi.fn().mockResolvedValue(false),
}))

import { runWaterfall } from './waterfall.js'
import * as ch from './steps/companies-house.js'
import * as kvk from './steps/kvk.js'
import * as google from './steps/google-search.js'
import * as website from './steps/website.js'
import * as smtp from './steps/smtp-verify.js'
import type { FoundContact } from './types.js'

function makeFound(overrides: Partial<FoundContact> = {}): FoundContact {
  return {
    name: 'John Smith',
    title: 'Finance Director',
    personaType: 'hiring_manager',
    source: 'companies_house',
    ...overrides,
  }
}

describe('runWaterfall', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when no contacts found', async () => {
    expect(await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')).toEqual([])
  })

  it('calls CH step for UK companies', async () => {
    await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')
    expect(ch.findContactsViaCompaniesHouse).toHaveBeenCalledWith('Acme Corp', 'uk')
  })

  it('calls KvK step for NL companies', async () => {
    await runWaterfall('Bedrijf BV', 'bedrijf.nl', 'nl')
    expect(kvk.findContactsViaKvK).toHaveBeenCalledWith('Bedrijf BV', 'nl')
  })

  it('proceeds to Google step when CH returns nothing', async () => {
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue([])
    await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')
    expect(google.searchLinkedInContacts).toHaveBeenCalledWith('Acme Corp')
  })

  it('skips Google step when 3 high-confidence contacts found after CH + SMTP', async () => {
    const contacts: FoundContact[] = [
      makeFound({ name: 'Alice A' }),
      makeFound({ name: 'Bob B' }),
      makeFound({ name: 'Carol C' }),
    ]
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue(contacts)
    // SMTP verifies all → CH + email = high confidence
    vi.mocked(smtp.verifySMTP).mockResolvedValue(true)

    const result = await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')

    expect(google.searchLinkedInContacts).not.toHaveBeenCalled()
    expect(result).toHaveLength(3)
  })

  it('returns at most 3 contacts', async () => {
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => makeFound({ name: `Person ${i}` }))
    )
    expect((await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')).length).toBeLessThanOrEqual(3)
  })

  it('deduplicates contacts with same name from different sources', async () => {
    vi.mocked(ch.findContactsViaCompaniesHouse).mockResolvedValue([
      makeFound({ name: 'John Smith', source: 'companies_house' }),
    ])
    vi.mocked(google.searchLinkedInContacts).mockResolvedValue([
      makeFound({ name: 'john smith', source: 'google' }),
    ])
    const result = await runWaterfall('Acme Corp', 'acme.co.uk', 'uk')
    expect(result.filter(c => c.name.toLowerCase() === 'john smith')).toHaveLength(1)
  })
})
