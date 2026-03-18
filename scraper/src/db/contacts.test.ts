// scraper/src/db/contacts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client.js', () => ({ db: { from: vi.fn() } }))

import { upsertContact } from './contacts.js'
import { db } from './client.js'
import type { EnrichedContact } from '../contacts/types.js'

function makeContact(overrides: Partial<EnrichedContact> = {}): EnrichedContact {
  return {
    name: 'John Smith',
    title: 'Finance Director',
    personaType: 'hiring_manager',
    source: 'companies_house',
    email: 'j.smith@acme.co.uk',
    smtpVerified: true,
    confidence: 'high',
    ...overrides,
  }
}

describe('upsertContact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the upserted contact id', async () => {
    const selectMock = { single: vi.fn().mockResolvedValue({ data: { id: 'ct-1' }, error: null }) }
    const upsertMock = { select: vi.fn().mockReturnValue(selectMock) }
    vi.mocked(db.from).mockReturnValue({ upsert: vi.fn().mockReturnValue(upsertMock) } as any)

    expect(await upsertContact('co-1', makeContact())).toBe('ct-1')
  })

  it('maps camelCase to snake_case DB columns', async () => {
    const upsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'ct-1' }, error: null }),
      }),
    })
    vi.mocked(db.from).mockReturnValue({ upsert: upsertFn } as any)

    await upsertContact('co-1', makeContact())
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'co-1',
        persona_type: 'hiring_manager',
        smtp_verified: true,
      }),
      expect.anything()
    )
  })

  it('throws on DB error', async () => {
    const selectMock = {
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } }),
    }
    const upsertMock = { select: vi.fn().mockReturnValue(selectMock) }
    vi.mocked(db.from).mockReturnValue({ upsert: vi.fn().mockReturnValue(upsertMock) } as any)

    await expect(upsertContact('co-1', makeContact())).rejects.toThrow('unique violation')
  })
})
