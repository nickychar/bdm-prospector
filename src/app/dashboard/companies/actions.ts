'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ApolloOrganization {
  name: string
  website_url: string | null
}

interface ApolloPerson {
  id: string
  first_name: string | null
  last_name: string | null
  name: string
  title: string | null
  email: string | null
  linkedin_url: string | null
  organization: ApolloOrganization | null
}

interface ApolloResponse {
  people: ApolloPerson[]
  error?: string
  message?: string
}

const HR_TITLES = [
  'HR Manager',
  'Head of HR',
  'HR Director',
  'Talent Acquisition',
  'Recruitment Manager',
  'Head of Talent',
  'People & Culture',
  'VP People',
  'Chief People Officer',
]

export async function enrichCompany(
  companyId: string
): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey || apiKey === 'your_apollo_api_key') {
    return { count: 0, error: 'Apollo API key not configured. Add APOLLO_API_KEY to .env.local' }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!company) return { count: 0, error: 'Company not found' }

  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        organization_names: [company.name],
        person_titles: HR_TITLES,
        per_page: 10,
        page: 1,
      }),
    })

    const data: ApolloResponse = await res.json()

    if (data.error || data.message) {
      return { count: 0, error: data.error ?? data.message }
    }

    if (!data.people?.length) return { count: 0 }

    let saved = 0
    for (const person of data.people) {
      const { error } = await supabase.from('contacts').upsert(
        {
          user_id: user.id,
          company_id: companyId,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          title: person.title,
          linkedin_url: person.linkedin_url,
          apollo_id: person.id,
          source: 'apollo' as const,
          enriched_at: new Date().toISOString(),
        },
        { onConflict: 'apollo_id', ignoreDuplicates: false }
      )
      if (!error) saved++
    }

    revalidatePath('/dashboard/companies')
    revalidatePath('/dashboard/contacts')
    return { count: saved }
  } catch (e) {
    console.error('Apollo enrichment failed:', e)
    return { count: 0, error: 'Network error calling Apollo API' }
  }
}

export async function enrichAllCompanies(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  // Get companies that have no contacts yet
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
