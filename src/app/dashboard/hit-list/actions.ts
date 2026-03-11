'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Scoring weights
const SCORE = {
  HAS_JOB_POST: 30,
  PER_JOB: 5,         // up to 5 extra jobs = +25
  HAS_EMAIL: 20,
  HAS_LINKEDIN: 10,
  SENIORITY_HIGH: 20, // Director, VP, Head, Chief, C-Suite
  SENIORITY_MID: 10,  // Manager, Lead
  HAS_WEBSITE: 5,
}

function scoreLead(opts: {
  jobCount: number
  hasEmail: boolean
  hasLinkedIn: boolean
  title: string | null
  hasWebsite: boolean
}): { score: number; reasons: { reason: string; points: number }[] } {
  const reasons: { reason: string; points: number }[] = []
  let score = 0

  if (opts.jobCount > 0) {
    reasons.push({ reason: 'Company actively hiring', points: SCORE.HAS_JOB_POST })
    score += SCORE.HAS_JOB_POST
  }

  const extraJobs = Math.min(opts.jobCount - 1, 5)
  if (extraJobs > 0) {
    const pts = extraJobs * SCORE.PER_JOB
    reasons.push({ reason: `${opts.jobCount} open roles detected`, points: pts })
    score += pts
  }

  if (opts.hasEmail) {
    reasons.push({ reason: 'Email available', points: SCORE.HAS_EMAIL })
    score += SCORE.HAS_EMAIL
  }

  if (opts.hasLinkedIn) {
    reasons.push({ reason: 'LinkedIn profile found', points: SCORE.HAS_LINKEDIN })
    score += SCORE.HAS_LINKEDIN
  }

  const titleLower = opts.title?.toLowerCase() ?? ''
  if (
    titleLower.includes('director') ||
    titleLower.includes('vp') ||
    titleLower.includes('vice president') ||
    titleLower.includes('head of') ||
    titleLower.includes('chief') ||
    titleLower.includes('cpo') ||
    titleLower.includes('chro')
  ) {
    reasons.push({ reason: 'Senior decision-maker', points: SCORE.SENIORITY_HIGH })
    score += SCORE.SENIORITY_HIGH
  } else if (titleLower.includes('manager') || titleLower.includes('lead')) {
    reasons.push({ reason: 'HR/Talent manager', points: SCORE.SENIORITY_MID })
    score += SCORE.SENIORITY_MID
  }

  if (opts.hasWebsite) {
    reasons.push({ reason: 'Company has website', points: SCORE.HAS_WEBSITE })
    score += SCORE.HAS_WEBSITE
  }

  return { score: Math.min(score, 100), reasons }
}

export async function generateLeads(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  type ContactRow = {
    id: string
    email: string | null
    linkedin_url: string | null
    title: string | null
    company_id: string | null
    companies: { id: string; website: string | null; job_posts: { count: number }[] } | null
  }

  // Get all contacts with their company's job count
  const { data: raw, error } = await supabase
    .from('contacts')
    .select('id, email, linkedin_url, title, company_id, companies(id, website, job_posts(count))')
    .eq('user_id', user.id)

  if (error) return { count: 0, error: error.message }
  const contacts = (raw ?? []) as ContactRow[]
  if (!contacts.length) return { count: 0, error: 'No contacts yet — enrich companies first' }

  let saved = 0

  for (const contact of contacts) {
    const company = contact.companies

    if (!company) continue

    const jobCount = company.job_posts?.[0]?.count ?? 0
    const { score, reasons } = scoreLead({
      jobCount,
      hasEmail: !!contact.email,
      hasLinkedIn: !!contact.linkedin_url,
      title: contact.title,
      hasWebsite: !!company.website,
    })

    const { error: upsertError } = await supabase.from('leads').upsert(
      {
        user_id: user.id,
        contact_id: contact.id,
        company_id: company.id,
        score,
        score_reasons: reasons,
        status: 'new',
      },
      { onConflict: 'contact_id', ignoreDuplicates: false }
    )

    if (!upsertError) saved++
  }

  // Update priority ranks based on score
  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, score')
    .eq('user_id', user.id)
    .order('score', { ascending: false })

  if (allLeads) {
    for (let i = 0; i < allLeads.length; i++) {
      await supabase
        .from('leads')
        .update({ priority_rank: i + 1 })
        .eq('id', allLeads[i].id)
    }
  }

  revalidatePath('/dashboard/hit-list')
  return { count: saved }
}

export async function updateLeadStatus(
  leadId: string,
  status: 'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('leads').update({ status }).eq('id', leadId)
  revalidatePath('/dashboard/hit-list')
}
