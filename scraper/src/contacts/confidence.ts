// scraper/src/contacts/confidence.ts
import type { Confidence, ContactSource } from './types.js'

export function assignConfidence(
  source: ContactSource,
  email: string | null,
  smtpVerified: boolean
): Confidence {
  switch (source) {
    case 'companies_house':
    case 'kvk':
      return email ? 'high' : 'medium'
    case 'press':
      return email ? 'high' : 'low'
    case 'website':
      return smtpVerified ? 'high' : 'medium'
    case 'google':
      return smtpVerified ? 'medium' : 'low'
    default:
      return 'low'
  }
}
