import * as cheerio from 'cheerio'
import { fetchHtml } from './base.js'
import type { RawJobResult, SearchFilters } from '../types.js'

const DATE_FILTER_MAP: Record<string, string> = { today: 'LastDay', week: 'LastWeek', month: 'LastMonth' }

export function buildSearchUrl(query: string, filters: SearchFilters): string {
  const slug = query.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const params = new URLSearchParams()
  if (filters.date_posted && DATE_FILTER_MAP[filters.date_posted]) params.set('datecreatedoffset', DATE_FILTER_MAP[filters.date_posted])
  const qs = params.toString()
  return `https://www.reed.co.uk/jobs/${slug}${qs ? '?' + qs : ''}`
}

export function parseResults(html: string): RawJobResult[] {
  const $ = cheerio.load(html)
  const results: RawJobResult[] = []
  $('article[data-qa="job-result"]').each((_, el) => {
    const title = $('[data-qa="job-title-link"]', el).first().text().trim()
    const company = $('.gtmJobListingPostedBy', el).text().trim()
    const dateAttr = $('time', el).attr('datetime') ?? null
    const snippet = $('.job-result__description', el).text().trim() || null
    if (!title) return
    results.push({ companyName: company || 'Unknown', companyDomain: null, jobTitle: title,
      board: 'reed', postedDate: dateAttr, snippet, contractTypeRaw: null, seniorityRaw: null })
  })
  return results
}

export async function scrape(query: string, filters: SearchFilters): Promise<RawJobResult[]> {
  return parseResults(await fetchHtml(buildSearchUrl(query, filters)))
}
