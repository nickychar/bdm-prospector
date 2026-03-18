export interface SignalRow {
  postedDate: string | null
  board: string
  boardsCount: number
}

export interface ContactRow {
  personaType: 'hiring_manager' | 'agency_selector'
  confidence: 'high' | 'medium' | 'low'
  smtpVerified: boolean
}

export interface ScoringInput {
  signals: SignalRow[]
  contacts: ContactRow[]
  stage: string | null
  sizeBand: string | null
  referenceDate?: Date
}

const ACTIVE_STAGES = new Set(['contacted', 'replied', 'meeting_booked', 'proposal_sent'])

export function computeScore(input: ScoringInput): number {
  const today = input.referenceDate ?? new Date()
  let score = 0

  const datedSignals = input.signals
    .filter(s => s.postedDate)
    .map(s => ({ ...s, date: new Date(s.postedDate!) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  if (datedSignals.length > 0) {
    const msPerDay = 1000 * 60 * 60 * 24
    const diffDays = Math.floor((today.getTime() - datedSignals[0].date.getTime()) / msPerDay)
    if (diffDays === 0)       score += 30
    else if (diffDays <= 3)   score += 22
    else if (diffDays <= 7)   score += 15
    else if (diffDays <= 30)  score += 8
  }

  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const recentCount = input.signals.filter(
    s => s.postedDate && new Date(s.postedDate) >= ninetyDaysAgo
  ).length
  if (recentCount >= 3) score += 15

  if (input.signals.some(s => s.board === 'flexmarkt')) score += 8

  if (datedSignals.length > 0 && datedSignals[0].boardsCount >= 3) score += 5

  const hasHiringManager = input.contacts.some(
    c => c.personaType === 'hiring_manager' && c.confidence !== 'low'
  )
  const hasAgencySelector = input.contacts.some(
    c => c.personaType === 'agency_selector' && c.confidence !== 'low'
  )
  const hasSmtpVerified = input.contacts.some(c => c.smtpVerified)

  if (hasHiringManager)  score += 10
  if (hasAgencySelector) score += 10
  if (hasSmtpVerified)   score += 5

  if (input.sizeBand === 'mid') score += 5

  if (input.stage && ACTIVE_STAGES.has(input.stage)) score -= 20

  return Math.max(0, score)
}
