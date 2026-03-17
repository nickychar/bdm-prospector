import * as cheerio from 'cheerio'
import { fetchHtml } from './base.js'
import type { RawJobResult, SearchFilters } from '../types.js'

export function buildSearchUrl(query: string, _filters: SearchFilters): string {
  const params = new URLSearchParams({ q: query, where: 'Nederland' })
  return `https://www.monsterboard.nl/vacatures/zoeken?${params}`
}

export function parseResults(html: string): RawJobResult[] {
  const $ = cheerio.load(html)
  const results: RawJobResult[] = []
  $('[class*="job-cardstyle"], [data-testid="job-card"]').each((_, el) => {
    const title = $('h2, [class*="title"]', el).first().text().trim()
    const company = $('[class*="company"], [class*="employer"]', el).first().text().trim()
    if (!title) return
    results.push({ companyName: company || 'Unknown', companyDomain: null, jobTitle: title,
      board: 'monsterboard', postedDate: null, snippet: null, contractTypeRaw: null, seniorityRaw: null })
  })
  return results
}

export async function scrape(query: string, filters: SearchFilters): Promise<RawJobResult[]> {
  return parseResults(await fetchHtml(buildSearchUrl(query, filters)))
}
