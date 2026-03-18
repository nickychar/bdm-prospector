// scraper/src/contacts/steps/companies-house.ts
import { fetch } from 'undici'
import { mapTitleToPersona } from '../persona.js'
import type { FoundContact } from '../types.js'

const CH_BASE = 'https://api.company-information.service.gov.uk'

/** CH returns names as "SURNAME, FIRSTNAME" — normalise to "Firstname Surname" */
function normaliseName(chName: string): string {
  const parts = chName.split(',').map(s => s.trim())
  if (parts.length === 2) {
    const first = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase()
    const last = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
    return `${first} ${last}`
  }
  return chName.trim()
}

async function chFetch(path: string): Promise<any> {
  const apiKey = process.env.CH_API_KEY
  if (!apiKey) return null
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
  const res = await fetch(`${CH_BASE}${path}`, {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return null
  return res.json()
}

export async function findContactsViaCompaniesHouse(
  companyName: string,
  country: string
): Promise<FoundContact[]> {
  if (country !== 'uk') return []
  if (!process.env.CH_API_KEY) {
    console.warn('[companies-house] CH_API_KEY not set — skipping')
    return []
  }
  try {
    const searchData = await chFetch(
      `/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=1`
    )
    if (!searchData?.items?.length) return []

    const companyNumber = searchData.items[0].company_number
    const officerData = await chFetch(
      `/company/${companyNumber}/officers?items_per_page=20`
    )
    if (!officerData?.items?.length) return []

    return officerData.items
      .filter((o: any) => !o.resigned_on)
      .filter((o: any) =>
        ['director', 'llp-designated-member', 'llp-member'].includes(o.officer_role)
      )
      .map((o: any): FoundContact => {
        const name = normaliseName(o.name)
        const title = o.occupation ?? o.officer_role ?? 'Director'
        return { name, title, personaType: mapTitleToPersona(title), source: 'companies_house' }
      })
  } catch {
    return []
  }
}
