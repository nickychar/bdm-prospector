import 'dotenv/config'
import { db } from './db/client.js'

async function main() {
  const { error } = await db.from('scrape_jobs').select('id').limit(1)
  if (error) throw new Error(`DB connection failed: ${error.message}`)
  console.log('Scraper service started. DB connection OK.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
