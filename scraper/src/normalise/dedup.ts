import type { RawJobResult, DedupedJobResult } from '../types.js'

function getDedupeKey(result: RawJobResult): string {
  if (result.companyDomain) return result.companyDomain.toLowerCase()
  return `name:${result.companyName.toLowerCase().trim()}`
}

export function deduplicateResults(results: RawJobResult[]): DedupedJobResult[] {
  const map = new Map<string, DedupedJobResult>()
  for (const result of results) {
    const key = getDedupeKey(result)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...result, boardsCount: 1, boardsList: [result.board] })
    } else {
      existing.boardsCount += 1
      existing.boardsList.push(result.board)
      if (result.postedDate && existing.postedDate) {
        if (result.postedDate > existing.postedDate) existing.postedDate = result.postedDate
      } else if (result.postedDate && !existing.postedDate) {
        existing.postedDate = result.postedDate
      }
    }
  }
  return Array.from(map.values())
}
