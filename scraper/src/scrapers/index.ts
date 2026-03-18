import { scrape as scrapeReed } from './reed.js'
import { scrape as scrapeTotaljobs } from './totaljobs.js'
import { scrape as scrapeIndeedUk } from './indeed-uk.js'
import { scrape as scrapeIndeedNl } from './indeed-nl.js'
import { scrape as scrapeNVB } from './nationale-vacaturebank.js'
import { scrape as scrapeMonsterboard } from './monsterboard.js'
import { scrape as scrapeIntermediair } from './intermediair.js'
import { scrape as scrapeStepstone } from './stepstone-nl.js'
import { scrape as scrapeJobbird } from './jobbird.js'
import { scrape as scrapeFlexmarkt } from './flexmarkt.js'
import { deduplicateResults } from '../normalise/dedup.js'
import type { DedupedJobResult, SearchFilters } from '../types.js'

const UK_SCRAPERS = [scrapeReed, scrapeTotaljobs, scrapeIndeedUk]
const NL_SCRAPERS = [scrapeIndeedNl, scrapeNVB, scrapeMonsterboard, scrapeIntermediair, scrapeStepstone, scrapeJobbird, scrapeFlexmarkt]

export async function fanOut(query: string, filters: SearchFilters): Promise<DedupedJobResult[]> {
  const country = filters.country ?? 'both'
  const scrapers = country === 'uk' ? UK_SCRAPERS : country === 'nl' ? NL_SCRAPERS : [...UK_SCRAPERS, ...NL_SCRAPERS]
  const settled = await Promise.allSettled(scrapers.map(fn => fn(query, filters)))
  const all = settled.flatMap(result => {
    if (result.status === 'fulfilled') return result.value
    console.warn('[fanOut] Scraper failed:', result.reason?.message)
    return []
  })
  return deduplicateResults(all)
}
