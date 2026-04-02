// scraper/src/server.ts
// HTTP server for synchronous scan requests from the web app.
// Runs alongside the queue poller in the same process.
import express from 'express'
import { fanOutSync } from './scrapers/index.js'
import { deduplicateResults } from './normalise/dedup.js'
import type { SearchFilters } from './types.js'

export function createServer() {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  // Temporary debug endpoint — remove after confirming key is correct
  app.get('/debug-key', (_req, res) => {
    const key = process.env.SCRAPER_KEY
    res.json({ keySet: !!key, keyLength: key?.length ?? 0, keyPreview: key ? key.slice(0, 4) + '...' : null })
  })

  app.post('/scan', async (req, res) => {
    const key = req.headers['x-scraper-key']
    if (key !== process.env.SCRAPER_KEY) {
      res.status(401).json({
        error: 'Unauthorized',
        debug: {
          receivedLength: typeof key === 'string' ? key.length : 0,
          receivedPreview: typeof key === 'string' ? key.slice(0, 4) + '...' : null,
          expectedLength: process.env.SCRAPER_KEY?.length ?? 0,
          expectedPreview: process.env.SCRAPER_KEY ? process.env.SCRAPER_KEY.slice(0, 4) + '...' : null,
        }
      })
      return
    }

    const { queries, filters = {} }: { queries: string[]; filters: SearchFilters } = req.body
    if (!Array.isArray(queries) || queries.length === 0) {
      res.status(400).json({ error: 'queries must be a non-empty array' })
      return
    }

    try {
      const settled = await Promise.allSettled(
        queries.map(q => fanOutSync(q, filters))
      )
      const all = settled.flatMap(r => r.status === 'fulfilled' ? r.value : [])
      const results = deduplicateResults(all)
      res.json({ results })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json({ error: msg })
    }
  })

  return app
}
