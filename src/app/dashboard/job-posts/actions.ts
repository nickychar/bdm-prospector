'use server'

import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────

interface DedupedJobResult {
  companyName: string
  companyDomain: string | null
  jobTitle: string
  board: string
  postedDate: string | null
  snippet: string | null
  contractTypeRaw: string | null
  boardsCount: number
  boardsList: string[]
}

interface ScanResponse {
  results: DedupedJobResult[]
  error?: string
}

// ─── Keyword expansion via Groq ───────────────────────────────────────────

async function expandKeywords(keywords: string[]): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return keywords

  try {
    const groq = new Groq({ apiKey })
    const expanded: string[] = []

    for (const kw of keywords) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 100,
        messages: [
          {
            role: 'system',
            content:
              'You are a Dutch job market assistant. Given a job role keyword, return 2–3 related search terms used on Dutch job boards. Include Dutch equivalents where natural. Return a JSON array of strings only — no explanation, no markdown.',
          },
          { role: 'user', content: kw },
        ],
      })
      const raw = completion.choices[0]?.message?.content ?? '[]'
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        const terms: string[] = JSON.parse(match[0])
        expanded.push(kw, ...terms.slice(0, 2))
      } else {
        expanded.push(kw)
      }
    }

    return [...new Set(expanded)].slice(0, 10)
  } catch {
    return keywords
  }
}

// ─── Domain resolution via Clearbit ──────────────────────────────────────

async function resolveDomains(companyNames: string[]): Promise<Map<string, string | null>> {
  const domainMap = new Map<string, string | null>()

  await Promise.allSettled(
    companyNames.map(async (name) => {
      try {
        const res = await fetch(
          `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
          { signal: AbortSignal.timeout(4_000) }
        )
        const results: { name: string; domain: string }[] = await res.json()
        domainMap.set(name, results?.[0]?.domain ?? null)
      } catch {
        domainMap.set(name, null)
      }
    })
  )

  return domainMap
}

// ─── Main action ─────────────────────────────────────────────────────────

export async function scanJobs(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  const scraperUrl = process.env.SCRAPER_URL
  const scraperKey = process.env.SCRAPER_KEY
  if (!scraperUrl || !scraperKey) {
    return { count: 0, error: 'SCRAPER_URL or SCRAPER_KEY not configured.' }
  }

  // 1. Load user keywords
  const { data: profile } = await supabase
    .from('users')
    .select('scan_keywords')
    .eq('id', user.id)
    .single()

  const rawKeywords: string[] = profile?.scan_keywords?.slice(0, 5) ?? []
  if (!rawKeywords.length) {
    return { count: 0, error: 'No keywords configured. Add keywords in Settings.' }
  }

  // 2. Expand keywords via Groq (falls back to originals on error)
  const queries = await expandKeywords(rawKeywords)

  // 3. Call scraper service — one request, all queries
  let results: DedupedJobResult[] = []
  try {
    const res = await fetch(`${scraperUrl}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scraper-key': scraperKey,
      },
      body: JSON.stringify({ queries, filters: {} }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) {
      const body = await res.text()
      return { count: 0, error: `Scraper error: ${res.status} ${body}` }
    }
    const data: ScanResponse = await res.json()
    results = data.results ?? []
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { count: 0, error: `Could not reach scraper service: ${msg}` }
  }

  if (!results.length) return { count: 0 }

  // 4. Create scan_run row first (FK needed by job_signals)
  const { data: scanRun, error: scanRunError } = await supabase
    .from('scan_runs')
    .insert({ user_id: user.id, query_count: queries.length, result_count: 0 })
    .select('id')
    .single()

  if (scanRunError || !scanRun) {
    return { count: 0, error: 'Failed to create scan run record' }
  }

  // 5. Resolve domains — one Clearbit call per unique company name
  const uniqueNames = [...new Set(results.map((r) => r.companyName))]
  const domainMap = await resolveDomains(uniqueNames)

  // 6. Upsert companies + insert job_signals
  let saved = 0

  for (const result of results) {
    const domain = result.companyDomain ?? domainMap.get(result.companyName) ?? null

    let companyId: string | null = null

    if (domain) {
      const { data: company } = await supabase
        .from('companies')
        .upsert(
          { user_id: user.id, name: result.companyName, domain, source: 'scraped' },
          { onConflict: 'user_id,domain' }
        )
        .select('id')
        .single()
      companyId = company?.id ?? null
    } else {
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', result.companyName)
        .maybeSingle()

      if (existing) {
        companyId = existing.id
      } else {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({ user_id: user.id, name: result.companyName, source: 'scraped' })
          .select('id')
          .single()
        companyId = newCompany?.id ?? null
      }
    }

    const board = result.boardsList?.join(', ') ?? result.board

    const { error: sigError } = await supabase.from('job_signals').upsert(
      {
        user_id: user.id,
        company_id: companyId,
        scan_run_id: scanRun.id,
        title: result.jobTitle,
        contract_type: result.contractTypeRaw,
        board,
        posted_date: result.postedDate,
        raw_snippet: result.snippet?.slice(0, 500) ?? null,
        boards_count: result.boardsCount,
      },
      { onConflict: 'user_id,company_id,title,board', ignoreDuplicates: true }
    )

    if (!sigError) saved++
  }

  // 7. Update scan_run with final count
  await supabase
    .from('scan_runs')
    .update({ result_count: saved })
    .eq('id', scanRun.id)

  revalidatePath('/dashboard/job-posts')
  return { count: saved }
}
