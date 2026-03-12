'use server'

import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateDraft(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Groq API key not configured. Add GROQ_API_KEY to .env.local' }
  }

  // Fetch lead with contact, company, and their job posts
  type LeadData = {
    id: string
    contacts: {
      first_name: string | null
      last_name: string | null
      title: string | null
      email: string | null
    } | null
    companies: {
      name: string
      location: string | null
      job_posts: { title: string }[]
    } | null
  }

  const { data: raw } = await supabase
    .from('leads')
    .select('id, contacts(first_name, last_name, title, email), companies(name, location, job_posts(title))')
    .eq('id', leadId)
    .eq('user_id', user.id)
    .single()

  const lead = raw as LeadData | null
  if (!lead) return { success: false, error: 'Lead not found' }

  const contact = lead.contacts
  const company = lead.companies
  if (!contact || !company) return { success: false, error: 'Missing contact or company data' }

  // Fetch BDM's agency name for personalisation
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, agency_name')
    .eq('id', user.id)
    .single()

  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'there'
  const roles = company.job_posts?.map((j) => j.title).slice(0, 3) ?? []
  const rolesText = roles.length > 0 ? roles.join(', ') : 'open roles'
  const bdmName = profile?.full_name ?? 'Your BDM'
  const agencyName = profile?.agency_name ?? 'our agency'

  const groq = new Groq({ apiKey })

  let completion
  try {
    completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 512,
    messages: [
      {
        role: 'system',
        content: `You are a recruitment agency BDM writing cold outreach emails to HR and talent acquisition professionals.
Write concise, professional, personalised emails under 130 words.
Focus on the value you bring: faster hiring, pre-vetted candidates, specialised networks.
Never be salesy or generic. Reference specific details about their hiring.
Always respond with ONLY a valid JSON object, no markdown, no explanation.`,
      },
      {
        role: 'user',
        content: `Write a cold outreach email from ${bdmName} at ${agencyName} to ${contactName}, who is ${contact.title ?? 'an HR professional'} at ${company.name} (${company.location ?? 'unknown location'}).

They are currently hiring for: ${rolesText}.

Return ONLY a JSON object with exactly two fields:
{
  "subject": "email subject line",
  "body": "full email body with greeting and sign-off"
}`,
      },
    ],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: `AI service error: ${msg}` }
  }

  const rawText = completion.choices[0]?.message?.content ?? ''

  // Parse JSON from response
  let subject = ''
  let body = ''
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const parsed = JSON.parse(jsonMatch[0])
    subject = parsed.subject ?? ''
    body = parsed.body ?? ''
  } catch {
    return { success: false, error: 'Failed to parse email from AI response' }
  }

  if (!subject || !body) {
    return { success: false, error: 'AI returned an incomplete email' }
  }

  // Save to email_drafts
  const { error: insertError } = await supabase.from('email_drafts').insert({
    user_id: user.id,
    lead_id: leadId,
    subject,
    body,
    template_used: 'llama-3.3-70b',
    status: 'draft',
  })

  if (insertError) return { success: false, error: insertError.message }

  revalidatePath('/dashboard/email-drafts')
  revalidatePath('/dashboard/hit-list')
  return { success: true }
}

export async function deleteDraft(draftId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('email_drafts').delete().eq('id', draftId).eq('user_id', user.id)
  revalidatePath('/dashboard/email-drafts')
}
