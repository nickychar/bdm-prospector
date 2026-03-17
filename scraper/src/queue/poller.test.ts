import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({ db: { rpc: vi.fn(), from: vi.fn() } }))

import { claimNextJob, completeJob, failJob, heartbeat, pollOnce } from './poller.js'
import { db } from '../db/client.js'

const mockJob = { id: 'job-1', query: 'interim finance', filters: {}, status: 'running',
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), result_count: 0 }

describe('claimNextJob', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns a job when one is available', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: [mockJob], error: null } as any)
    expect(await claimNextJob()).toEqual(mockJob)
    expect(db.rpc).toHaveBeenCalledWith('claim_scrape_job')
  })
  it('returns null when no jobs queued', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: [], error: null } as any)
    expect(await claimNextJob()).toBeNull()
  })
  it('returns null and logs on error', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: { message: 'DB error' } } as any)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await claimNextJob()).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('completeJob', () => {
  beforeEach(() => vi.clearAllMocks())
  it('updates status to done with result_count and completed_at', async () => {
    const updateMock = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const fromMock = { update: vi.fn().mockReturnValue(updateMock) }
    vi.mocked(db.from).mockReturnValue(fromMock as any)
    await completeJob('job-1', 12)
    expect(db.from).toHaveBeenCalledWith('scrape_jobs')
    expect(fromMock.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done', result_count: 12 }))
  })
})

describe('failJob', () => {
  beforeEach(() => vi.clearAllMocks())
  it('updates status to failed with error message', async () => {
    const updateMock = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const fromMock = { update: vi.fn().mockReturnValue(updateMock) }
    vi.mocked(db.from).mockReturnValue(fromMock as any)
    await failJob('job-1', 'parse error')
    expect(fromMock.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'parse error' }))
  })
})

describe('heartbeat', () => {
  beforeEach(() => vi.clearAllMocks())
  it('updates updated_at for the given job id', async () => {
    const updateMock = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const fromMock = { update: vi.fn().mockReturnValue(updateMock) }
    vi.mocked(db.from).mockReturnValue(fromMock as any)
    await heartbeat('job-1')
    expect(fromMock.update).toHaveBeenCalledWith(expect.objectContaining({ updated_at: expect.any(String) }))
    expect(updateMock.eq).toHaveBeenCalledWith('id', 'job-1')
  })
})

describe('pollOnce', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls handler and completeJob when a job is available', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: [mockJob], error: null } as any)
    const updateMock = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const fromMock = { update: vi.fn().mockReturnValue(updateMock) }
    vi.mocked(db.from).mockReturnValue(fromMock as any)

    const handler = vi.fn().mockResolvedValue(5)
    const result = await pollOnce(handler)

    expect(handler).toHaveBeenCalledWith(mockJob)
    expect(fromMock.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done', result_count: 5 }))
    expect(result).toBe(true)
  })

  it('calls failJob when handler throws', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: [mockJob], error: null } as any)
    const updateMock = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const fromMock = { update: vi.fn().mockReturnValue(updateMock) }
    vi.mocked(db.from).mockReturnValue(fromMock as any)

    const handler = vi.fn().mockRejectedValue(new Error('scrape failed'))
    const result = await pollOnce(handler)

    expect(handler).toHaveBeenCalledWith(mockJob)
    expect(fromMock.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'scrape failed' }))
    expect(result).toBe(false)
  })

  it('does not call completeJob or failJob when no job is available', async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: [], error: null } as any)
    const fromMock = { update: vi.fn() }
    vi.mocked(db.from).mockReturnValue(fromMock as any)

    const handler = vi.fn()
    const result = await pollOnce(handler)

    expect(handler).not.toHaveBeenCalled()
    expect(fromMock.update).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })
})
