import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('./client.js', () => ({ db: { from: vi.fn() } }))
import { upsertCompany } from './companies.js'
import { db } from './client.js'

describe('upsertCompany', () => {
  beforeEach(() => vi.clearAllMocks())
  it('upserts on domain conflict', async () => {
    const selectMock = { single: vi.fn().mockResolvedValue({ data: { id: 'co-1' }, error: null }) }
    const upsertMock = { select: vi.fn().mockReturnValue(selectMock) }
    vi.mocked(db.from).mockReturnValue({ upsert: vi.fn().mockReturnValue(upsertMock) } as any)
    expect(await upsertCompany({ name: 'Acme', domain: 'acme.co.uk', country: 'uk' })).toBe('co-1')
  })
  it('throws if upsert returns error', async () => {
    const selectMock = { single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }) }
    const upsertMock = { select: vi.fn().mockReturnValue(selectMock) }
    vi.mocked(db.from).mockReturnValue({ upsert: vi.fn().mockReturnValue(upsertMock) } as any)
    await expect(upsertCompany({ name: 'Acme', domain: 'acme.co.uk', country: 'uk' })).rejects.toThrow('DB error')
  })
})
