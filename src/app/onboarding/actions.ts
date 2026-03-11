'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function saveDeduplicateRule(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const dedupRule = formData.get('dedup_rule') as string

  const { error } = await supabase
    .from('users')
    .update({ dedup_rule: dedupRule, onboarding_step: 3 })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function completeOnboarding() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase
    .from('users')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  if (error) return { error: error.message }
  redirect('/dashboard')
}
