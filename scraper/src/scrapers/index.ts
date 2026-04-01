import { scrape as scrapeIndeedNl } from './indeed-nl.js'
import { scrape as scrapeNVB } from './nationale-vacaturebank.js'
import { scrape as scrapeMonsterboard } from './monsterboard.js'
import { scrape as scrapeIntermediair } from './intermediair.js'
import { scrape as scrapeStepstone } from './stepstone-nl.js'
import { scrape as scrapeJobbird } from './jobbird.js'
import { scrape as scrapeFlexmarkt } from './flexmarkt.js'
import { scrape as scrapeGoogleJobsNl } from './google-jobs-nl.js'
import { deduplicateResults } from '../normalise/dedup.js'
import type { DedupedJobResult, SearchFilters } from '../types.js'

const NL_SCRAPERS = [
  scrapeIndeedNl,
  scrapeNVB,
  scrapeMonsterboard,
  scrapeIntermediair,
  scrapeStepstone,
  scrapeJobbird,
  scrapeFlexmarkt,
  scrapeGoogleJobsNl, // Broad coverage via SerpAPI Killer (Puppeteer stealth)
]

// Fast Cheerio-only boards — no Puppeteer, safe for synchronous HTTP requests
const SYNC_SCRAPERS = [
  scrapeIndeedNl,
  scrapeNVB,
  scrapeMonsterboard,
  scrapeIntermediair,
  scrapeStepstone,
  scrapeJobbird,
  scrapeFlexmarkt,
]

export async function fanOut(query: string, filters: SearchFilters): Promise<DedupedJobResult[]> {
  const settled = await Promise.allSettled(NL_SCRAPERS.map(fn => fn(query, filters)))
  const all = settled.flatMap(result => {
    if (result.status === 'fulfilled') return result.value
    return []
  })
  return deduplicateResults(all)
}

export async function fanOutSync(query: string, filters: SearchFilters): Promise<DedupedJobResult[]> {
  const settled = await Promise.allSettled(SYNC_SCRAPERS.map(fn => fn(query, filters)))
  const all = settled.flatMap(result =>
    result.status === 'fulfilled' ? result.value : []
  )
  return deduplicateResults(all)
}
