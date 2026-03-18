import { db } from '../db/client.js'

export async function markStalledJobsFailed(): Promise<void> {
  const { error } = await db.rpc('mark_stalled_jobs_failed')
  if (error) console.error('[timeout-checker] Failed to mark stalled jobs:', error.message)
}

export function startTimeoutChecker(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  markStalledJobsFailed()
  return setInterval(markStalledJobsFailed, intervalMs)
}
