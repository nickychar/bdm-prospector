// Single source of truth for database enums used by both the Next.js app and the scraper.

export type SizeBand = 'small' | 'mid' | 'large'
export type Country = 'uk' | 'nl'
export type Seniority = 'director' | 'head' | 'manager' | 'other'
export type ContractType = 'interim' | 'temp' | 'contract' | 'other'
export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type PipelineStage = 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'proposal_sent' | 'won' | 'dead'

// Union of all sources that either service can write
export type ContactSource =
  | 'salesforce' | 'apollo' | 'hunter' | 'manual'   // web app sources
  | 'kvk' | 'companies_house' | 'google' | 'website' | 'press'  // scraper sources

export type CompanySource = 'salesforce' | 'manual' | 'scraped'
export type JobPostSource = 'serpapi' | 'manual'
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'
export type EmailDraftStatus = 'draft' | 'sent' | 'opened' | 'replied' | 'bounced'
