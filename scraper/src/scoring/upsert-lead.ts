import { db } from '../db/client.js'

export async function upsertLead(companyId: string): Promise<void> {
  const { error } = await db.rpc('upsert_lead_score', { p_company_id: companyId })
  if (error) throw new Error(error.message)
}
