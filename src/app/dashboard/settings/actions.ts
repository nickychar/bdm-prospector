'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const agencyName = formData.get('agency_name') as string
  const fullName = formData.get('full_name') as string
  const keywordsRaw = formData.get('scan_keywords') as string
  const locationsRaw = formData.get('scan_locations') as string

  const keywords = keywordsRaw
    .split('\n')
    .map(k => k.trim())
    .filter(Boolean)

  const locations = locationsRaw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const { error } = await supabase
    .from('users')
    .update({
      agency_name: agencyName || null,
      full_name: fullName || null,
      scan_keywords: keywords,
      scan_locations: locations,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/job-posts')
  return { success: true }
}
