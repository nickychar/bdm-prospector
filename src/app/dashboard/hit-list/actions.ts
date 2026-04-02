'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateLeads(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, company_id')
    .eq('user_id', user.id)

  if (error) return { count: 0, error: error.message }
  if (!contacts?.length) return { count: 0, error: 'No contacts yet — enrich companies first' }

  let saved = 0

  for (const contact of contacts) {
    if (!contact.company_id) continue

    const { error: upsertError } = await supabase.from('leads').upsert(
      {
        user_id: user.id,
        contact_id: contact.id,
        company_id: contact.company_id,
        status: 'new',
      },
      { onConflict: 'contact_id', ignoreDuplicates: true }
    )

    if (!upsertError) saved++
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
