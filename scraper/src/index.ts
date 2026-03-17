import 'dotenv/config'
import { db } from './db/client.js'
import { startPoller } from './queue/poller.js'
import { startTimeoutChecker } from './queue/timeout-checker.js'
import { fanOut } from './scrapers/index.js'
import { upsertCompany } from './db/companies.js'
import { insertJobSignal } from './db/job-signals.js'
import { normaliseContractType, normaliseSeniority, isPermanent } from './normalise/nl-terms.js'
import { normaliseDomain } from './normalise/domain.js'
import type { ScrapeJob } from './types.js'

async function handleScrapeJob(job: ScrapeJob): Promise<number> {
  console.log(`[scraper] Processing job ${job.id}: "${job.query}"`)
  const results = await fanOut(job.query ?? '', job.filters)

  let count = 0
  for (const result of results) {
    const contractType = result.contractTypeRaw ? normaliseContractType(result.contractTypeRaw) : null
    if (contractType && isPermanent(contractType)) continue

    const seniority = result.seniorityRaw ? normaliseSeniority(result.seniorityRaw) : null

    const domain = result.companyDomain
      ? normaliseDomain(result.companyDomain)
      : normaliseDomain(result.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.invalid')

    const companyId = await upsertCompany({
      name: result.companyName,
      domain,
      country: job.filters.country === 'uk' ? 'uk' : job.filters.country === 'nl' ? 'nl' : null,
    })

    await insertJobSignal({
      companyId,
      title: result.jobTitle,
      seniority,
      contractType: (contractType === 'permanent' || contractType === null) ? null : contractType,
      board: result.board,
      postedDate: result.postedDate,
      snippet: result.snippet,
      boardsCount: result.boardsCount,
      scrapeJobId: job.id,
    })

    count++
  }

  console.log(`[scraper] Job ${job.id} done — ${count} signals written`)
  return count
}

async function main() {
  const { error } = await db.from('scrape_jobs').select('id').limit(1)
  if (error) throw new Error(`DB connection failed: ${error.message}`)
  console.log('Scraper service started. DB OK.')
  startTimeoutChecker()
  startPoller(handleScrapeJob)
  console.log('Queue poller started. Waiting for jobs…')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
