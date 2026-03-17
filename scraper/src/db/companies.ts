import { db } from './client.js'
import type { Country, SizeBand } from '../types.js'

interface CompanyInput {
  name: string
  domain: string | null
  country: Country | null
  sizeBand?: SizeBand | null
  sector?: string | null
}

export async function upsertCompany(input: CompanyInput): Promise<string> {
  const updatePayload: Record<string, unknown> = {
    name: input.name,
    updated_at: new Date().toISOString(),
  }
  if (input.sizeBand != null) updatePayload.size_band = input.sizeBand
  if (input.sector != null) updatePayload.sector = input.sector
  if (input.country != null) updatePayload.country = input.country

  if (input.domain == null) {
    // No domain: plain insert, no conflict resolution (domain is the only reliable unique key)
    const { data, error } = await db
      .from('companies')
      .insert({ name: input.name, domain: null, ...updatePayload })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('upsertCompany returned null data')
    return data.id
  }

  const { data, error } = await db
    .from('companies')
    .upsert({ name: input.name, domain: input.domain, ...updatePayload }, { onConflict: 'domain' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsertCompany returned null data')
  return data.id
}
