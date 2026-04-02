// These types mirror shared/db-enums.ts (the single source of truth).
// We duplicate rather than import to avoid cross-project build complexity.
// If you change an enum here, update shared/db-enums.ts too.
export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource =
  | 'salesforce' | 'apollo' | 'hunter' | 'manual'
  | 'kvk' | 'companies_house' | 'google' | 'website' | 'press'
export type PipelineStage = 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'proposal_sent' | 'won' | 'dead'

export interface SearchFilters {
  country?: 'uk' | 'nl' | 'both' | null
  sector?: string | null
  size_band?: SizeBand | null
  role_type?: 'interim' | 'temp' | 'contract' | null
  date_posted?: 'today' | 'week' | 'month' | null
}

export interface RawJobResult {
  companyName: string
  companyDomain: string | null
  jobTitle: string
  board: string
  postedDate: string | null
  snippet: string | null
  contractTypeRaw: string | null
}

export interface DedupedJobResult extends RawJobResult {
  boardsCount: number
  boardsList: string[]
}
