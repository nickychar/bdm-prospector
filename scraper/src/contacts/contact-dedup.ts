// scraper/src/contacts/contact-dedup.ts
import type { EnrichedContact, Confidence } from './types.js'

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

function dedupeKey(name: string): string {
  return name.toLowerCase().trim()
}

export function deduplicateContacts(contacts: EnrichedContact[]): EnrichedContact[] {
  const map = new Map<string, EnrichedContact>()

  for (const contact of contacts) {
    const key = dedupeKey(contact.name)
    const existing = map.get(key)

    if (!existing) {
      map.set(key, contact)
    } else {
      const contactRank = CONFIDENCE_RANK[contact.confidence]
      const existingRank = CONFIDENCE_RANK[existing.confidence]

      if (contactRank > existingRank) {
        // New contact is better — keep it, but inherit email from existing if new lacks one
        map.set(key, { ...contact, email: contact.email ?? existing.email })
      } else if (!existing.email && contact.email) {
        // Existing is better but has no email — merge email from duplicate
        map.set(key, { ...existing, email: contact.email, smtpVerified: contact.smtpVerified })
      }
    }
  }

  return Array.from(map.values())
}

export function capContacts(contacts: EnrichedContact[]): EnrichedContact[] {
  return [...contacts]
    .sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence])
    .slice(0, 3)
}
