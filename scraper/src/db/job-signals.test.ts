import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('./client.js', () => ({ db: { from: vi.fn() } }))
import { insertJobSignal } from './job-signals.js'
import { db } from './client.js'

describe('insertJobSignal', () => {
  beforeEach(() => vi.clearAllMocks())
  it('inserts a job signal row', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(db.from).mockReturnValue({ insert: insertMock } as any)
    await insertJobSignal({ companyId: 'co-1', title: 'Interim FD', board: 'reed', boardsCount: 2, scrapeJobId: 'job-1' })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ company_id: 'co-1', board: 'reed', boards_count: 2 }))
  })
  it('throws on DB error', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } })
    vi.mocked(db.from).mockReturnValue({ insert: insertMock } as any)
    await expect(insertJobSignal({ companyId: 'co-1', title: 'FD', board: 'reed', boardsCount: 1, scrapeJobId: 'job-1' })).rejects.toThrow('insert failed')
  })
})
