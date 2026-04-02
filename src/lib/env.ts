// Validates environment variables used by the Next.js app.
// Server-only vars are checked lazily (they're undefined in browser context).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Server-side only — check these lazily in server actions, not at module load
export function requireServerEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing server env var: ${key}`)
  return val
}
