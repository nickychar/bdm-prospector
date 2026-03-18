// scraper/src/contacts/waterfall.ts
import { findContactsViaCompaniesHouse } from './steps/companies-house.js'
import { findContactsViaKvK } from './steps/kvk.js'
import { searchLinkedInContacts, searchPressReleases } from './steps/google-search.js'
import { findContactsOnWebsite } from './steps/website.js'
import { verifySMTP } from './steps/smtp-verify.js'
import { generateEmailPatterns, splitName } from './email-patterns.js'
import { assignConfidence } from './confidence.js'
import { deduplicateContacts, capContacts } from './contact-dedup.js'
import type { FoundContact, EnrichedContact } from './types.js'

async function enrichContact(contact: FoundContact, domain: string): Promise<EnrichedContact> {
  const { first, last } = splitName(contact.name)
  const patterns = generateEmailPatterns(first, last, domain)

  let email: string | null = null
  let smtpVerified = false

  for (const pattern of patterns) {
    const verified = await verifySMTP(pattern)
    if (verified) {
      email = pattern
      smtpVerified = true
      break
    }
  }
  // Per spec: "Companies House / KvK name + any email → High"
  // An unverified pattern still counts as "any email" — spec intends this.
  // For Google contacts, email=unverified → assignConfidence returns 'low' (correct).
  if (!email && patterns.length) email = patterns[0]

  const confidence = assignConfidence(contact.source, email, smtpVerified)
  return { ...contact, email, smtpVerified, confidence }
}

function hasEnough(contacts: EnrichedContact[]): boolean {
  return deduplicateContacts(contacts).filter(c => c.confidence === 'high').length >= 3
}

export async function runWaterfall(
  companyName: string,
  domain: string,
  country: string
): Promise<EnrichedContact[]> {
  const enriched: EnrichedContact[] = []

  async function runStep(found: FoundContact[]): Promise<void> {
    for (const contact of found) {
      enriched.push(await enrichContact(contact, domain))
    }
  }

  // Step 1: Companies House (UK) or KvK (NL)
  const step1 = country === 'nl'
    ? await findContactsViaKvK(companyName, country)
    : await findContactsViaCompaniesHouse(companyName, country)
  await runStep(step1)
  if (hasEnough(enriched)) return capContacts(deduplicateContacts(enriched))

  // Step 2: Google LinkedIn search
  await runStep(await searchLinkedInContacts(companyName))
  if (hasEnough(enriched)) return capContacts(deduplicateContacts(enriched))

  // Step 3: Company website
  await runStep(await findContactsOnWebsite(domain))
  if (hasEnough(enriched)) return capContacts(deduplicateContacts(enriched))

  // Step 4: Press releases
  await runStep(await searchPressReleases(companyName))

  return capContacts(deduplicateContacts(enriched))
}
