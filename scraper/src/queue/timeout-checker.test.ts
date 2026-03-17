import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({ db: { rpc: vi.fn() } }))

import { markStalledJobsFailed } from './timeout-checker.js'
import { db } from '../db/client.js'

describe('markStalledJobsFailed', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls the correct RPC function', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: null } as any)
    await markStalledJobsFailed()
    expect(db.rpc).toHaveBeenCalledWith('mark_stalled_jobs_failed')
  })

  it('does not throw when RPC succeeds', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: null } as any)
    await expect(markStalledJobsFailed()).resolves.not.toThrow()
  })

  it('logs error but does not throw when RPC fails', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: { message: 'connection refused' } } as any)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(markStalledJobsFailed()).resolves.not.toThrow()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
