import { db } from '../db/client.js'
import type { ScrapeJob } from '../types.js'

export async function claimNextJob(): Promise<ScrapeJob | null> {
  const { data, error } = await db.rpc('claim_scrape_job')
  if (error) { console.error('[poller] Failed to claim job:', error.message); return null }
  return (data as ScrapeJob[])?.[0] ?? null
}

export async function completeJob(jobId: string, resultCount: number): Promise<void> {
  const { error } = await db.from('scrape_jobs')
    .update({ status: 'done', result_count: resultCount, completed_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) console.error('[poller] Failed to complete job:', error.message)
}

export async function failJob(jobId: string, message: string): Promise<void> {
  const { error } = await db.from('scrape_jobs')
    .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) console.error('[poller] Failed to fail job:', error.message)
}

export async function heartbeat(jobId: string): Promise<void> {
  const { error } = await db.from('scrape_jobs')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) console.error('[poller] Heartbeat failed:', error.message)
}

export async function pollOnce(handler: (job: ScrapeJob) => Promise<number>): Promise<boolean> {
  const job = await claimNextJob()
  if (!job) return false
  const hb = setInterval(() => heartbeat(job.id), 20_000)
  try {
    const resultCount = await handler(job)
    await completeJob(job.id, resultCount)
    return true
  } catch (err) {
    await failJob(job.id, err instanceof Error ? err.message : String(err))
    return false
  } finally {
    clearInterval(hb)
  }
}

export function startPoller(handler: (job: ScrapeJob) => Promise<number>, intervalMs = 2_000): NodeJS.Timeout {
  return setInterval(async () => {
    try { await pollOnce(handler) }
    catch (err) { console.error('[poller] Unhandled error in poll loop:', err) }
  }, intervalMs)
}
