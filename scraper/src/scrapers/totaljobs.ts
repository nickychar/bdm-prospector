import * as cheerio from 'cheerio'
import { fetchHtml } from './base.js'
import type { RawJobResult, SearchFilters } from '../types.js'

export function buildSearchUrl(query: string, filters: SearchFilters): string {
  const slug = query.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const params = new URLSearchParams()
  if (filters.date_posted === 'today') params.set('postedwithin', '1')
  else if (filters.date_posted === 'week') params.set('postedwithin', '7')
  else if (filters.date_posted === 'month') params.set('postedwithin', '30')
  const qs = params.toString()
  return `https://www.totaljobs.com/jobs/${slug}/contract-jobs${qs ? '?' + qs : ''}`
}

export function parseResults(html: string): RawJobResult[] {
  const $ = cheerio.load(html)
  const results: RawJobResult[] = []
  $('.job-result-summary').each((_, el) => {
    const title = $('.job-title a', el).text().trim()
    const company = $('.job-company', el).text().trim()
    if (!title) return
    results.push({ companyName: company || 'Unknown', companyDomain: null, jobTitle: title,
      board: 'totaljobs', postedDate: null, snippet: null, contractTypeRaw: null, seniorityRaw: null })
  })
  return results
}

export async function scrape(query: string, filters: SearchFilters): Promise<RawJobResult[]> {
  return parseResults(await fetchHtml(buildSearchUrl(query, filters)))
}
