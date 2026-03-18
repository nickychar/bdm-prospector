// scraper/src/contacts/steps/kvk.ts
// KvK (Kamer van Koophandel) — Netherlands company registry
// API docs: https://developers.kvk.nl/documentation/zoeken
// Officer lookup requires upgraded API access — this is a stub.
import { fetch } from 'undici'
import type { FoundContact } from '../types.js'

const KVK_BASE = 'https://api.kvk.nl/api/v1'

export async function findContactsViaKvK(
  companyName: string,
  country: string
): Promise<FoundContact[]> {
  if (country !== 'nl') return []
  const apiKey = process.env.KVK_API_KEY
  if (!apiKey) {
    console.warn('[kvk] KVK_API_KEY not set — skipping')
    return []
  }
  try {
    const res = await fetch(
      `${KVK_BASE}/zoeken?handelsnaam=${encodeURIComponent(companyName)}&resultatenPerPagina=1`,
      {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(8_000),
      }
    )
    if (!res.ok) return []
    // KvK basic search confirms company exists but doesn't return officer names.
    // Returning empty — NL contacts found via steps 2-4.
    return []
  } catch {
    return []
  }
}
