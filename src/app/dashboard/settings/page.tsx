import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, agency_name, scan_keywords, scan_locations')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Settings</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your account and scan configuration</p>
      </div>
      <SettingsForm
        defaultValues={{
          full_name: profile?.full_name ?? '',
          agency_name: profile?.agency_name ?? '',
          scan_keywords: profile?.scan_keywords ?? [],
          scan_locations: profile?.scan_locations ?? [],
        }}
      />
    </div>
  )
}
