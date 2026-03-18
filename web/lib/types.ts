export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource = 'companies_house' | 'kvk' | 'website' | 'google' | 'press'
export type PipelineStage =
  | 'new' | 'contacted' | 'replied' | 'meeting_booked'
  | 'proposal_sent' | 'won' | 'dead'
export type ScrapeJobStatus = 'queued' | 'running' | 'done' | 'failed'

export const PIPELINE_STAGES: PipelineStage[] = [
  'new', 'contacted', 'replied', 'meeting_booked',
  'proposal_sent', 'won', 'dead',
]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting_booked: 'Meeting Booked',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  dead: 'Dead',
}

export interface Company {
  id: string
  name: string
  domain: string
  size_band: SizeBand | null
  sector: string | null
  country: Country | null
  created_at: string
  updated_at: string
}

export interface JobSignal {
  id: string
  company_id: string
  scrape_job_id: string | null
  title: string | null
  seniority: Seniority | null
  contract_type: ContractType | null
  board: string | null
  posted_date: string | null
  raw_snippet: string | null
  boards_count: number
  created_at: string
}

export interface Contact {
  id: string
  company_id: string
  name: string | null
  title: string | null
  persona_type: PersonaType | null
  email: string | null
  smtp_verified: boolean
  confidence: Confidence | null
  source: ContactSource | null
  found_at: string
}

export interface Lead {
  id: string
  company_id: string
  score: number
  stage: PipelineStage
  is_suppressed: boolean
  created_at: string
  last_activity_at: string
}

export interface PipelineEvent {
  id: string
  lead_id: string
  from_stage: PipelineStage | null
  to_stage: PipelineStage | null
  note: string | null
  created_at: string
}

export interface SavedSearch {
  id: string
  name: string
  query: string | null
  filters: SearchFilters
  schedule_cron: string | null
  created_at: string
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

export interface SearchFilters {
  country?: 'uk' | 'nl' | 'both' | null
  sector?: string | null
  size_band?: SizeBand | null
  role_type?: 'interim' | 'temp' | 'contract' | null
  date_posted?: 'today' | 'week' | 'month' | null
}

// Enriched types for UI (joins)
export interface LeadWithCompany extends Lead {
  company: Company
  contacts: Contact[]
  job_signals: JobSignal[]
}

export type ScoreBand = 'hot' | 'warm' | 'cold' | 'hidden'

export function getScoreBand(score: number): ScoreBand {
  if (score >= 70) return 'hot'
  if (score >= 45) return 'warm'
  if (score >= 20) return 'cold'
  return 'hidden'
}

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  hidden: 'Hidden',
}

export const SCORE_BAND_COLORS: Record<ScoreBand, string> = {
  hot: 'bg-red-100 text-red-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-slate-100 text-slate-700',
  hidden: 'bg-gray-100 text-gray-500',
}

// Stages shown in the Kanban board (Won and Dead are excluded from main board)
export const KANBAN_STAGES: PipelineStage[] = [
  'new', 'contacted', 'replied', 'meeting_booked', 'proposal_sent',
]
