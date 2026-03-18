import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../db/client.js', () => ({ db: { rpc: vi.fn() } }))
import { upsertLead } from './upsert-lead.js'
import { db } from '../db/client.js'

describe('upsertLead', () => {
  beforeEach(() => vi.clearAllMocks())
  it('calls db.rpc with upsert_lead_score and company id', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: null } as any)
    await upsertLead('co-1')
    expect(db.rpc).toHaveBeenCalledWith('upsert_lead_score', { p_company_id: 'co-1' })
  })
  it('does not throw when RPC succeeds', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: null } as any)
    await expect(upsertLead('co-1')).resolves.not.toThrow()
  })
  it('throws when RPC returns an error', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: { message: 'function does not exist' } } as any)
    await expect(upsertLead('co-1')).rejects.toThrow('function does not exist')
  })
})
