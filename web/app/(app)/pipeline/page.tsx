import { createClient } from '@/lib/supabase/server'
import { PipelineView } from './_components/PipelineView'
import type { LeadWithCompany } from '@/lib/types'

export default async function PipelinePage() {
  const supabase = createClient()

  const { data: leadsData, error } = await supabase
    .from('leads')
    .select('*, company:companies(*)')
    .eq('is_suppressed', false)
    .order('score', { ascending: false })

  if (error) {
    console.error('Failed to load leads:', error)
    return <div className="text-destructive p-6">Failed to load pipeline data.</div>
  }

  const validLeads = (leadsData ?? []).filter(l => l.company != null)
  const companyIds = validLeads.map(l => l.company_id).filter(Boolean)

  const [{ data: contacts }, { data: signals }] = await Promise.all([
    supabase.from('contacts').select('*').in('company_id', companyIds),
    supabase.from('job_signals').select('*').in('company_id', companyIds),
  ])

  const leads = validLeads.map(l => ({
    ...l,
    contacts: (contacts ?? []).filter(c => c.company_id === l.company_id),
    job_signals: (signals ?? []).filter(s => s.company_id === l.company_id),
  })) as LeadWithCompany[]

  return <PipelineView initialLeads={leads} />
}
