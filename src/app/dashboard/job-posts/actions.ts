'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface SerpApiJob {
  title: string
  company_name: string
  location: string
  description?: string
  detected_extensions?: {
    posted_at?: string
    schedule_type?: string
  }
  related_links?: Array<{ link: string; text: string }>
}

interface SerpApiResponse {
  jobs_results?: SerpApiJob[]
  error?: string
}

function parsePostedDate(postedAt?: string): string | null {
  if (!postedAt) return null
  const now = new Date()
  const match = postedAt.match(/(\d+)\s+(hour|day|week|month)/)
  if (!match) return now.toISOString().split('T')[0]
  const [, num, unit] = match
  const n = parseInt(num)
  const date = new Date(now)
  if (unit === 'hour') date.setHours(date.getHours() - n)
  else if (unit === 'day') date.setDate(date.getDate() - n)
  else if (unit === 'week') date.setDate(date.getDate() - n * 7)
  else if (unit === 'month') date.setMonth(date.getMonth() - n)
  return date.toISOString().split('T')[0]
}

export async function scanJobs(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  const apiKey = process.env.SERP_API_KEY
  if (!apiKey) {
    return { count: 0, error: 'SERP_API_KEY not configured.' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('scan_keywords, scan_locations')
    .eq('id', user.id)
    .single()

  const keywords = profile?.scan_keywords?.slice(0, 3) ?? ['software engineer']
  const locations = (profile?.scan_locations?.length ? profile.scan_locations.slice(0, 2) : [''])

  let totalSaved = 0

  for (const keyword of keywords) {
    for (const location of locations) {
      try {
        // Try with location first; fall back to no location if Google returns nothing
        const attempts = location ? [location, ''] : ['']
        let data: SerpApiResponse = {}

        for (const loc of attempts) {
          const params = new URLSearchParams({
            engine: 'google_jobs',
            q: keyword,
            api_key: apiKey,
            num: '10',
          })
          if (loc) params.set('location', loc)
          const serpBase = process.env.SERP_API_URL || 'https://serpapi.com'
          const res = await fetch(`${serpBase}/search?${params}`, { cache: 'no-store' })
          data = await res.json()
          if (!data.error && data.jobs_results?.length) break
        }

        if (data.error || !data.jobs_results?.length) continue

        for (const job of data.jobs_results) {
          // Find or create company
          let companyId: string | null = null
          const { data: existing } = await supabase
            .from('companies')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', job.company_name)
            .single()

          if (existing) {
            companyId = existing.id
          } else {
            const { data: newCompany } = await supabase
              .from('companies')
              .insert({
                user_id: user.id,
                name: job.company_name,
                location: job.location,
                source: 'scraped',
              })
              .select('id')
              .single()
            companyId = newCompany?.id ?? null
          }

          const url = job.related_links?.[0]?.link ?? null

          // Deduplicate by URL when present, otherwise by title + company
          if (url) {
            const { error } = await supabase
              .from('job_posts')
              .upsert(
                {
                  user_id: user.id,
                  company_id: companyId,
                  title: job.title,
                  description: job.description?.slice(0, 2000) ?? null,
                  url,
                  location: job.location,
                  source: 'serpapi',
                  posted_date: parsePostedDate(job.detected_extensions?.posted_at),
                },
                { onConflict: 'user_id,url', ignoreDuplicates: true }
              )
            if (!error) totalSaved++
          } else {
            // No URL — check for existing by title + company to avoid duplicates
            const { data: existingJob } = await supabase
              .from('job_posts')
              .select('id')
              .eq('user_id', user.id)
              .eq('company_id', companyId ?? '')
              .ilike('title', job.title)
              .single()

            if (!existingJob) {
              const { error } = await supabase
                .from('job_posts')
                .insert({
                  user_id: user.id,
                  company_id: companyId,
                  title: job.title,
                  description: job.description?.slice(0, 2000) ?? null,
                  url: null,
                  location: job.location,
                  source: 'serpapi',
                  posted_date: parsePostedDate(job.detected_extensions?.posted_at),
                })
              if (!error) totalSaved++
            }
          }
        }
      } catch (e) {
        void e
      }
    }
  }

  revalidatePath('/dashboard/job-posts')
  return { count: totalSaved }
}
