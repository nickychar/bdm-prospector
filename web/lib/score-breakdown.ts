import type { LeadWithCompany, PipelineStage } from './types.js'

export interface ScoreItem {
  label: string
  points: number
}

const ACTIVE_STAGES = new Set<PipelineStage>([
  'contacted', 'replied', 'meeting_booked', 'proposal_sent',
])

export function computeScoreBreakdown(lead: LeadWithCompany, referenceDate?: Date): ScoreItem[] {
  const today = referenceDate ?? new Date()
  const items: ScoreItem[] = []

  const datedSignals = lead.job_signals
    .filter(s => s.posted_date)
    .map(s => ({ ...s, date: new Date(s.posted_date!) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  // Recency
  if (datedSignals.length > 0) {
    const msPerDay = 1000 * 60 * 60 * 24
    const diffDays = Math.floor((today.getTime() - datedSignals[0].date.getTime()) / msPerDay)
    if (diffDays === 0)      items.push({ label: 'Signal posted today', points: 30 })
    else if (diffDays <= 3)  items.push({ label: 'Signal posted 1–3 days ago', points: 22 })
    else if (diffDays <= 7)  items.push({ label: 'Signal posted 4–7 days ago', points: 15 })
    else if (diffDays <= 30) items.push({ label: 'Signal posted 8–30 days ago', points: 8 })
  }

  // Serial poster
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const recentCount = lead.job_signals.filter(
    s => s.posted_date && new Date(s.posted_date) >= ninetyDaysAgo
  ).length
  if (recentCount >= 3) items.push({ label: 'Serial poster (3+ signals in 90 days)', points: 15 })

  // Flexmarkt
  if (lead.job_signals.some(s => s.board === 'flexmarkt')) {
    items.push({ label: 'Flexmarkt.nl signal (interim-specific board)', points: 8 })
  }

  // Multi-board
  if (datedSignals.length > 0 && datedSignals[0].boards_count >= 3) {
    items.push({ label: 'Multi-board posting (3+ boards)', points: 5 })
  }

  // HM contact
  if (lead.contacts.some(c => c.persona_type === 'hiring_manager' && c.confidence !== 'low')) {
    items.push({ label: 'Hiring Manager contact found', points: 10 })
  }

  // AS contact
  if (lead.contacts.some(c => c.persona_type === 'agency_selector' && c.confidence !== 'low')) {
    items.push({ label: 'Agency Selector contact found', points: 10 })
  }

  // SMTP
  if (lead.contacts.some(c => c.smtp_verified)) {
    items.push({ label: 'Email SMTP verified', points: 5 })
  }

  // Size
  if (lead.company.size_band === 'mid') {
    items.push({ label: 'Mid-size company (50–500)', points: 5 })
  }

  // Pipeline penalty
  if (ACTIVE_STAGES.has(lead.stage)) {
    items.push({ label: `Already in active pipeline (${lead.stage})`, points: -20 })
  }

  return items
}
