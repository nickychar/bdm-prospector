// scraper/src/contacts/contact-dedup.test.ts
import { describe, it, expect } from 'vitest'
import { deduplicateContacts, capContacts } from './contact-dedup.js'
import type { EnrichedContact } from './types.js'

function makeContact(overrides: Partial<EnrichedContact> = {}): EnrichedContact {
  return {
    name: 'John Smith',
    title: 'Finance Director',
    personaType: 'hiring_manager',
    source: 'companies_house',
    email: null,
    smtpVerified: false,
    confidence: 'medium',
    ...overrides,
  }
}

describe('deduplicateContacts', () => {
  it('returns single contact unchanged', () => {
    expect(deduplicateContacts([makeContact()])).toHaveLength(1)
  })

  it('merges two contacts with same name (case-insensitive)', () => {
    const contacts = [
      makeContact({ name: 'John Smith', source: 'companies_house' }),
      makeContact({ name: 'john smith', source: 'google', email: 'j.smith@acme.co.uk' }),
    ]
    expect(deduplicateContacts(contacts)).toHaveLength(1)
  })

  it('keeps the higher-confidence version when merging', () => {
    const contacts = [
      makeContact({ name: 'John Smith', confidence: 'medium', email: null }),
      makeContact({ name: 'John Smith', confidence: 'high', email: 'j@acme.co.uk' }),
    ]
    const result = deduplicateContacts(contacts)
    expect(result[0].confidence).toBe('high')
    expect(result[0].email).toBe('j@acme.co.uk')
  })

  it('keeps contacts with different names separate', () => {
    const contacts = [
      makeContact({ name: 'John Smith' }),
      makeContact({ name: 'Jane Doe', personaType: 'agency_selector' }),
    ]
    expect(deduplicateContacts(contacts)).toHaveLength(2)
  })

  it('merges email from lower-confidence duplicate when higher has none', () => {
    const contacts = [
      makeContact({ name: 'John Smith', confidence: 'high', email: null, source: 'companies_house' }),
      makeContact({ name: 'John Smith', confidence: 'low', email: 'j@acme.co.uk', source: 'google' }),
    ]
    const result = deduplicateContacts(contacts)
    expect(result[0].email).toBe('j@acme.co.uk')
  })
})

describe('capContacts', () => {
  it('returns at most 3 contacts', () => {
    const contacts = Array.from({ length: 5 }, (_, i) =>
      makeContact({ name: `Person ${i}` })
    )
    expect(capContacts(contacts)).toHaveLength(3)
  })

  it('returns fewer than 3 when fewer available', () => {
    expect(capContacts([makeContact()])).toHaveLength(1)
  })

  it('sorts by confidence descending — high first', () => {
    const contacts = [
      makeContact({ name: 'Low', confidence: 'low' }),
      makeContact({ name: 'High', confidence: 'high' }),
      makeContact({ name: 'Medium', confidence: 'medium' }),
    ]
    expect(capContacts(contacts)[0].confidence).toBe('high')
  })
})
