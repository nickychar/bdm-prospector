export type ScoreBand = 'hot' | 'warm' | 'cold' | 'hidden'

export function getScoreBand(score: number): ScoreBand {
  if (score >= 70) return 'hot'
  if (score >= 45) return 'warm'
  if (score >= 20) return 'cold'
  return 'hidden'
}
