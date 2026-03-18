import 'dotenv/config'
import { db } from './db/client.js'
import { startPoller } from './queue/poller.js'
import { startTimeoutChecker } from './queue/timeout-checker.js'
import { fanOut } from './scrapers/index.js'
import { upsertCompany } from './db/companies.js'
import { insertJobSignal } from './db/job-signals.js'
import { upsertContact } from './db/contacts.js'
import { runWaterfall } from './contacts/waterfall.js'
import { upsertLead } from './scoring/upsert-lead.js'
import { normaliseContractType, normaliseSeniority, isPermanent } from './normalise/nl-terms.js'
import { normaliseDomain } from './normalise/domain.js'
import type { ScrapeJob } from './types.js'

// Map board name → country for 'both' searches where job.filters.country doesn't tell us
const NL_BOARDS = new Set([
  'indeed-nl', 'nationale-vacaturebank', 'monsterboard',
  'intermediair', 'stepstone-nl', 'jobbird', 'flexmarkt',
])

function countryForResult(board: string, jobCountry: string | undefined): 'uk' | 'nl' {
  if (jobCountry === 'uk') return 'uk'
  if (jobCountry === 'nl') return 'nl'
  // 'both' or unset — derive from board
  return NL_BOARDS.has(board) ? 'nl' : 'uk'
}

async function handleScrapeJob(job: ScrapeJob): Promise<number> {
  console.log(`[scraper] Processing job ${job.id}: "${job.query}"`)

  const results = await fanOut(job.query ?? '', job.filters)

  // Phase 1: write companies + job signals (fast — UI shows these first)
  const companyMeta: Array<{
    companyId: string
    domain: string
    name: string
    country: string
  }> = []
  let count = 0

  for (const result of results) {
    const contractType = result.contractTypeRaw
      ? normaliseContractType(result.contractTypeRaw)
      : null
    if (contractType && isPermanent(contractType)) continue

    const seniority = result.seniorityRaw
      ? normaliseSeniority(result.seniorityRaw)
      : null

    const domain = result.companyDomain
      ? normaliseDomain(result.companyDomain)
      : normaliseDomain(result.companyName.toLowerCase().replace(/\s+/g, '') + '.com')

    const country = countryForResult(result.board, job.filters.country ?? undefined)

    const companyId = await upsertCompany({ name: result.companyName, domain, country })
    companyMeta.push({ companyId, domain, name: result.companyName, country })

    await insertJobSignal({
      companyId,
      title: result.jobTitle,
      seniority,
      contractType: contractType as any,
      board: result.board,
      postedDate: result.postedDate,
      snippet: result.snippet,
      boardsCount: result.boardsCount,
      scrapeJobId: job.id,
    })

    count++
  }

  // Phase 2: run contact waterfall per company (async enrichment)
  // UI already shows companies from Phase 1 while this runs
  await Promise.all(
    companyMeta.map(async ({ companyId, domain, name, country }) => {
      try {
        const contacts = await runWaterfall(name, domain, country)
        for (const contact of contacts) {
          await upsertContact(companyId, contact)
        }
        await upsertLead(companyId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[scraper] Phase 2 failed for ${domain}: ${msg}`)
      }
    })
  )

  console.log(`[scraper] Job ${job.id} done — ${count} signals, waterfall complete`)
  return count
}

async function main() {
  const { error } = await db.from('scrape_jobs').select('id').limit(1)
  if (error) throw new Error(`DB connection failed: ${error.message}`)
  console.log('Scraper service started. DB OK.')

  startTimeoutChecker()
  startPoller(handleScrapeJob)
  console.log('Polling for jobs every 2s...')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
