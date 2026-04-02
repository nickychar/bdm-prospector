import 'dotenv/config'
import './env.js'
import { createServer } from './server.js'

const port = parseInt(process.env.PORT ?? '3002', 10)

createServer().listen(port, () => {
  console.log(`Scraper HTTP server listening on port ${port}`)
})
