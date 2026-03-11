import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: connections }] = await Promise.all([
    supabase
      .from('users')
      .select('dedup_rule, onboarding_step')
      .eq('id', user.id)
      .single(),
    supabase
      .from('crm_connections')
      .select('provider')
      .eq('user_id', user.id),
  ])

  const providers = new Set(connections?.map(c => c.provider) ?? [])

  return (
    <OnboardingWizard
      initialStep={profile?.onboarding_step ?? 0}
      initialDedupRule={profile?.dedup_rule ?? 'email'}
      hasGmail={providers.has('gmail')}
    />
  )
}
