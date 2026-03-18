import * as cheerio from 'cheerio'
import { fetchHtml } from './base.js'
import type { RawJobResult, SearchFilters } from '../types.js'

export function buildSearchUrl(query: string, filters: SearchFilters): string {
  const params = new URLSearchParams({ zoekterm: query })
  if (filters.date_posted === 'today') params.set('days', '1')
  else if (filters.date_posted === 'week') params.set('days', '7')
  return `https://www.nationalevacaturebank.nl/vacature/zoeken?${params}`
}

export function parseResults(html: string): RawJobResult[] {
  const $ = cheerio.load(html)
  const results: RawJobResult[] = []
  $('article.job-result, div[class*="vacancy-"]').each((_, el) => {
    const title = $('h2, h3', el).first().text().trim()
    const company = $('[class*="company"], [class*="employer"]', el).first().text().trim()
    if (!title) return
    results.push({ companyName: company || 'Unknown', companyDomain: null, jobTitle: title,
      board: 'nationale-vacaturebank', postedDate: null, snippet: null, contractTypeRaw: null, seniorityRaw: null })
  })
  return results
}

export async function scrape(query: string, filters: SearchFilters): Promise<RawJobResult[]> {
  return parseResults(await fetchHtml(buildSearchUrl(query, filters)))
}
