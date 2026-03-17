import * as cheerio from 'cheerio'
import { fetchHtml } from './base.js'
import type { RawJobResult, SearchFilters } from '../types.js'

export function buildSearchUrl(query: string, _filters: SearchFilters): string {
  return `https://www.stepstone.nl/vacatures?${new URLSearchParams({ q: query })}`
}

export function parseResults(html: string): RawJobResult[] {
  const $ = cheerio.load(html)
  const results: RawJobResult[] = []
  $('article[data-at="job-item"], [class*="ResultItem"]').each((_, el) => {
    const title = $('[data-at="job-item-title"], h2', el).first().text().trim()
    const company = $('[data-at="job-item-company-name"], [class*="company"]', el).first().text().trim()
    if (!title) return
    results.push({ companyName: company || 'Unknown', companyDomain: null, jobTitle: title,
      board: 'stepstone-nl', postedDate: null, snippet: null, contractTypeRaw: null, seniorityRaw: null })
  })
  return results
}

export async function scrape(query: string, filters: SearchFilters): Promise<RawJobResult[]> {
  return parseResults(await fetchHtml(buildSearchUrl(query, filters)))
}
