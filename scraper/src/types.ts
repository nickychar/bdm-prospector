export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource = 'companies_house' | 'kvk' | 'website' | 'google' | 'press'
export type PipelineStage = 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'proposal_sent' | 'won' | 'dead'
export type ScrapeJobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface SearchFilters {
  country?: 'uk' | 'nl' | 'both' | null
  sector?: string | null
  size_band?: SizeBand | null
  role_type?: 'interim' | 'temp' | 'contract' | null
  date_posted?: 'today' | 'week' | 'month' | null
}

export interface ScrapeJob {
  id: string
  query: string | null
  filters: SearchFilters
  status: ScrapeJobStatus
  started_at: string | null
  completed_at: string | null
  updated_at: string
  result_count: number
  error: string | null
  created_at: string
}

export interface RawJobResult {
  companyName: string
  companyDomain: string | null
  jobTitle: string
  board: string
  postedDate: string | null
  snippet: string | null
  contractTypeRaw: string | null
  seniorityRaw: string | null
}

export interface DedupedJobResult extends RawJobResult {
  boardsCount: number
  boardsList: string[]
}
