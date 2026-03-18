import { getScoreBand } from './types.js'
import type { LeadWithCompany, ScoreBand, Country } from './types.js'

export interface PipelineFilters {
  scoreBand?: ScoreBand | null
  country?: Country | null
  showDead?: boolean
  showWon?: boolean
}

export type SortField = 'score' | 'last_activity_at' | 'created_at'
export type SortDir = 'asc' | 'desc'

export function filterLeads(leads: LeadWithCompany[], filters: PipelineFilters): LeadWithCompany[] {
  return leads.filter(lead => {
    if (!filters.showDead && lead.stage === 'dead') return false
    if (!filters.showWon && lead.stage === 'won') return false
    if (filters.scoreBand && getScoreBand(lead.score) !== filters.scoreBand) return false
    if (filters.country && lead.company.country !== filters.country) return false
    return true
  })
}

export function sortLeads(leads: LeadWithCompany[], field: SortField, dir: SortDir): LeadWithCompany[] {
  return [...leads].sort((a, b) => {
    let diff = 0
    if (field === 'score') {
      diff = a.score - b.score
    } else if (field === 'last_activity_at') {
      diff = new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime()
    } else {
      diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return dir === 'asc' ? diff : -diff
  })
}
