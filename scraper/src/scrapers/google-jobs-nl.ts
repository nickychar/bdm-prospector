// scraper/src/scrapers/google-jobs-nl.ts
// Calls the SerpAPI Killer service for broad NL job coverage via Puppeteer stealth.
// The SerpAPI Killer runs as a separate Railway service — this board treats it as a data source.
import { fetch } from 'undici'
import type { RawJobResult, SearchFilters } from '../types.js'

const SERP_KILLER_URL = process.env.SERP_API_URL ?? 'http://localhost:3001'
const SERP_KILLER_KEY = process.env.SERP_API_KEY ?? 'local'

interface SerpJob {
  title: string
  company_name: string
  location: string
  description?: string
  detected_extensions?: {
    posted_at?: string
    schedule_type?: string
  }
  related_links?: Array<{ link: string }>
}

interface SerpResponse {
  jobs_results?: SerpJob[]
  error?: string
}

function parsePostedDate(postedAt?: string): string | null {
  if (!postedAt) return null
  const now = new Date()
  const match = postedAt.match(/(\d+)\s+(hour|day|week|month)/)
  if (!match) return now.toISOString().split('T')[0]
  const n = parseInt(match[1])
  const unit = match[2]
  const d = new Date(now)
  if (unit === 'hour') d.setHours(d.getHours() - n)
  else if (unit === 'day') d.setDate(d.getDate() - n)
  else if (unit === 'week') d.setDate(d.getDate() - n * 7)
  else if (unit === 'month') d.setMonth(d.getMonth() - n)
  return d.toISOString().split('T')[0]
}

export async function scrape(query: string, _filters: SearchFilters): Promise<RawJobResult[]> {
  try {
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: query,
      api_key: SERP_KILLER_KEY,
      location: 'Netherlands',
      num: '10',
    })

    const res = await fetch(`${SERP_KILLER_URL}/search?${params}`, {
      signal: AbortSignal.timeout(45_000),
    })

    if (!res.ok) return []

    const data = await res.json() as SerpResponse
    if (data.error || !data.jobs_results?.length) return []

    return data.jobs_results.map((job): RawJobResult => ({
      companyName: job.company_name,
      companyDomain: null,
      jobTitle: job.title,
      board: 'google-jobs-nl',
      postedDate: parsePostedDate(job.detected_extensions?.posted_at),
      snippet: job.description?.slice(0, 300) ?? null,
      contractTypeRaw: job.detected_extensions?.schedule_type ?? null,
    }))
  } catch {
    return []
  }
}
