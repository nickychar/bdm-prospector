// scraper/src/contacts/persona.ts
import type { PersonaType } from './types.js'

// Agency selector keywords checked first — takes priority over hiring_manager matches
const AGENCY_SELECTOR_KEYWORDS = [
  'talent acquisition', 'head of talent', 'head of people', 'people director',
  'chief people', 'hr business partner', 'hrbp', 'procurement',
  'resourcing', 'recruitment director', 'staffing',
]

const HIRING_MANAGER_KEYWORDS = [
  'finance director', 'chief financial', 'cfo', 'financial director',
  'head of finance', 'hr director', 'human resources director',
  'operations director', 'coo', 'chief operating', 'managing director',
  'director', 'head of hr', 'head of operations',
]

export function mapTitleToPersona(title: string): PersonaType {
  const lower = title.toLowerCase()
  for (const kw of AGENCY_SELECTOR_KEYWORDS) {
    if (lower.includes(kw)) return 'agency_selector'
  }
  for (const kw of HIRING_MANAGER_KEYWORDS) {
    if (lower.includes(kw)) return 'hiring_manager'
  }
  return 'hiring_manager' // default fallback
}
