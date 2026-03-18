import * as cheerio from 'cheerio'
import { fetchHtml } from './base.js'
import type { RawJobResult, SearchFilters } from '../types.js'

export function buildSearchUrl(query: string, filters: SearchFilters): string {
  const params = new URLSearchParams({ q: query, l: 'Nederland' })
  if (filters.date_posted === 'today') params.set('fromage', '1')
  else if (filters.date_posted === 'week') params.set('fromage', '7')
  else if (filters.date_posted === 'month') params.set('fromage', '30')
  return `https://www.indeed.nl/vacatures?${params}`
}

export function parseResults(html: string): RawJobResult[] {
  const $ = cheerio.load(html)
  const results: RawJobResult[] = []
  $('.job_seen_beacon').each((_, el) => {
    const title = $('.jobTitle', el).text().trim()
    const company = $('.companyName', el).text().trim()
    if (!title) return
    results.push({ companyName: company || 'Unknown', companyDomain: null, jobTitle: title,
      board: 'indeed-nl', postedDate: null, snippet: null, contractTypeRaw: null, seniorityRaw: null })
  })
  return results
}

export async function scrape(query: string, filters: SearchFilters): Promise<RawJobResult[]> {
  return parseResults(await fetchHtml(buildSearchUrl(query, filters)))
}
