import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Building2, Users } from 'lucide-react'
import { EnrichButton, EnrichAllButton } from './enrich-button'
import type { CompanyRow } from '@/types/database'

type CompanyWithCounts = CompanyRow & {
  job_posts: { count: number }[]
  contacts: { count: number }[]
}

export default async function CompaniesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('companies')
    .select('*, job_posts(count), contacts(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const companies = (data ?? []) as CompanyWithCounts[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Companies</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Companies detected from job scans
          </p>
        </div>
        <EnrichAllButton total={companies.length} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Companies', value: companies.length, icon: Building2 },
          {
            label: 'Contacts Found',
            value: companies.reduce((sum, c) => sum + (c.contacts[0]?.count ?? 0), 0),
            icon: Users,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-zinc-600 font-medium">No companies yet</p>
          <p className="text-zinc-400 text-sm mt-1">
            Scan for jobs first — companies are detected automatically
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Location</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Jobs</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Contacts</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {companies.map((company) => {
                const jobCount = company.job_posts[0]?.count ?? 0
                const contactCount = company.contacts[0]?.count ?? 0

                return (
                  <tr key={company.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{company.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{company.location ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{jobCount}</td>
                    <td className="px-4 py-3">
                      {contactCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 text-xs font-medium">
                          <Users className="h-3 w-3" />
                          {contactCount}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <EnrichButton companyId={company.id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
