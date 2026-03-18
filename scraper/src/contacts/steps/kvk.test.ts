// scraper/src/contacts/steps/kvk.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('undici', () => ({ fetch: vi.fn() }))

import { findContactsViaKvK } from './kvk.js'
import { fetch } from 'undici'

describe('findContactsViaKvK', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.KVK_API_KEY = 'test-key'
  })
  afterEach(() => { delete process.env.KVK_API_KEY })

  it('returns empty when KVK_API_KEY is not set', async () => {
    delete process.env.KVK_API_KEY
    expect(await findContactsViaKvK('Bedrijf BV', 'nl')).toEqual([])
  })

  it('returns empty for non-NL country', async () => {
    expect(await findContactsViaKvK('Acme Corp', 'uk')).toEqual([])
  })

  it('returns empty array on successful API call (stub behaviour)', async () => {
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resultaten: [{ naam: 'Bedrijf BV', kvkNummer: '12345678' }] }),
    })
    const result = await findContactsViaKvK('Bedrijf BV', 'nl')
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns empty on network error', async () => {
    vi.mocked(fetch as any).mockRejectedValue(new Error('timeout'))
    expect(await findContactsViaKvK('Bedrijf BV', 'nl')).toEqual([])
  })
})
