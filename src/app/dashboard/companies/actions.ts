'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface HunterEmail {
  value: string
  first_name: string | null
  last_name: string | null
  position: string | null
  seniority: string | null
  linkedin: string | null
  confidence: number
}

interface HunterResponse {
  data?: {
    emails: HunterEmail[]
    domain: string
  }
  errors?: { details: string }[]
}

const HR_KEYWORDS = [
  'hr', 'human resources', 'talent', 'recruitment', 'recruiter',
  'people', 'culture', 'workforce', 'hiring', 'personnel',
]

function isHRContact(position: string | null): boolean {
  if (!position) return false
  const lower = position.toLowerCase()
  return HR_KEYWORDS.some((kw) => lower.includes(kw))
}

function extractDomain(company: { domain: string | null; website: string | null }): string | null {
  if (company.domain) return company.domain
  if (company.website) {
    try {
      const url = new URL(
        company.website.startsWith('http') ? company.website : `https://${company.website}`
      )
      return url.hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  }
  return null
}

export async function enrichCompany(
  companyId: string
): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    return { count: 0, error: 'Hunter.io API key not configured. Add HUNTER_API_KEY to environment variables.' }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, domain, website')
    .eq('id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!company) return { count: 0, error: 'Company not found' }

  const domain = extractDomain(company)
  if (!domain) {
    return { count: 0, error: `No domain found for ${company.name}. Add a website URL to enrich this company.` }
  }

  try {
    const url = new URL('https://api.hunter.io/v2/domain-search')
    url.searchParams.set('domain', domain)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('limit', '10')

    const res = await fetch(url.toString())
    const data: HunterResponse = await res.json()

    if (data.errors?.length) {
      return { count: 0, error: data.errors[0].details }
    }

    const emails = data.data?.emails ?? []
    const hrContacts = emails.filter((e) => isHRContact(e.position))

    if (!hrContacts.length) return { count: 0 }

    let saved = 0
    for (const person of hrContacts) {
      const { error } = await supabase.from('contacts').upsert(
        {
          user_id: user.id,
          company_id: companyId,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.value,
          title: person.position,
          seniority: person.seniority,
          linkedin_url: person.linkedin,
          source: 'apollo' as const, // reusing existing enum value
          enriched_at: new Date().toISOString(),
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      if (!error) saved++
    }

    // Update company domain if we didn't have it
    if (!company.domain && data.data?.domain) {
      await supabase
        .from('companies')
        .update({ domain: data.data.domain })
        .eq('id', companyId)
    }

    revalidatePath('/dashboard/companies')
    revalidatePath('/dashboard/contacts')
    return { count: saved }
  } catch (e) {
    console.error('Hunter enrichment failed:', e)
    return { count: 0, error: 'Network error calling Hunter.io API' }
  }
}

export async function enrichAllCompanies(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)

  if (!companies?.length) return { count: 0 }

  let total = 0
  for (const company of companies) {
    const result = await enrichCompany(company.id)
    if (result.error) return { count: total, error: result.error }
    total += result.count
  }

  return { count: total }
}
