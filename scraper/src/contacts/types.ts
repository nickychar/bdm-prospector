// scraper/src/contacts/types.ts

export type PersonaType = 'hiring_manager' | 'agency_selector'
export type Confidence = 'high' | 'medium' | 'low'
export type ContactSource = 'companies_house' | 'kvk' | 'google' | 'website' | 'press'

/** Contact found with name+title, before email enrichment */
export interface FoundContact {
  name: string
  title: string
  personaType: PersonaType
  source: ContactSource
}

/** Contact after email pattern generation + SMTP verification */
export interface EnrichedContact extends FoundContact {
  email: string | null
  smtpVerified: boolean
  confidence: Confidence
}
