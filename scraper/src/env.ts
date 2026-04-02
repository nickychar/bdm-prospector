// Validates required environment variables on startup.
// Import this module early in index.ts (side-effect import).

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SCRAPER_KEY'] as const
const optional = ['PORT'] as const

const missing = required.filter(key => !process.env[key])
if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`)
}

for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`[env] Optional var ${key} is not set`)
  }
}
