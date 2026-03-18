// scraper/src/db/contacts.ts
import { db } from './client.js'
import type { EnrichedContact } from '../contacts/types.js'

export async function upsertContact(companyId: string, contact: EnrichedContact): Promise<string> {
  const { data, error } = await db
    .from('contacts')
    .upsert(
      {
        company_id: companyId,
        name: contact.name,
        title: contact.title,
        persona_type: contact.personaType,
        email: contact.email,
        smtp_verified: contact.smtpVerified,
        confidence: contact.confidence,
        source: contact.source,
        found_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,name' }
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}
