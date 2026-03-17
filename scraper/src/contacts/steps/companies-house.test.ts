// scraper/src/contacts/steps/companies-house.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('undici', () => ({ fetch: vi.fn() }))

import { findContactsViaCompaniesHouse } from './companies-house.js'
import { fetch } from 'undici'

function mockResponse(body: any, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as any)
}

describe('findContactsViaCompaniesHouse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CH_API_KEY = 'test-key'
  })
  afterEach(() => { delete process.env.CH_API_KEY })

  it('returns empty when CH_API_KEY is not set', async () => {
    delete process.env.CH_API_KEY
    expect(await findContactsViaCompaniesHouse('Acme Corp', 'uk')).toEqual([])
  })

  it('returns empty for non-UK country', async () => {
    expect(await findContactsViaCompaniesHouse('Bedrijf BV', 'nl')).toEqual([])
  })

  it('returns contacts from active directors', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse({ items: [{ company_number: '12345678' }] }))
      .mockResolvedValueOnce(mockResponse({
        items: [
          { name: 'SMITH, JOHN', officer_role: 'director', occupation: 'Finance Director' },
        ],
      }))

    const contacts = await findContactsViaCompaniesHouse('Acme Corp', 'uk')
    expect(contacts).toHaveLength(1)
    expect(contacts[0].name).toBe('John Smith')
    expect(contacts[0].source).toBe('companies_house')
    expect(contacts[0].personaType).toBe('hiring_manager')
  })

  it('skips resigned officers', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse({ items: [{ company_number: '12345678' }] }))
      .mockResolvedValueOnce(mockResponse({
        items: [{ name: 'OLD, BOB', officer_role: 'director', resigned_on: '2020-01-01' }],
      }))
    expect(await findContactsViaCompaniesHouse('Acme Corp', 'uk')).toHaveLength(0)
  })

  it('returns empty when company not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ items: [] }))
    expect(await findContactsViaCompaniesHouse('Unknown Ltd', 'uk')).toEqual([])
  })

  it('returns empty on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await findContactsViaCompaniesHouse('Acme Corp', 'uk')).toEqual([])
  })
})
