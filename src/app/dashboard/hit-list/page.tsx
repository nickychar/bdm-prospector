import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Linkedin, Mail, Trophy } from 'lucide-react'
import { GenerateLeadsButton, StatusSelect } from './hit-list-controls'


function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : score >= 40
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-zinc-100 text-zinc-500 border-zinc-200'

  return (
    <span
      className={`inline-flex items-center justify-center w-10 h-7 rounded-md border text-xs font-bold ${color}`}
    >
      {score}
    </span>
  )
}

export default async function HitListPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('leads')
    .select(
      `id, score, score_reasons, status, priority_rank,
       contacts(first_name, last_name, title, email, linkedin_url),
       companies(name)`
    )
    .eq('user_id', user.id)
    .eq('is_duplicate', false)
    .order('priority_rank', { ascending: true, nullsFirst: false })
    .limit(200)

  const leads = (data ?? []) as Array<{
    id: string
    score: number
    score_reasons: Array<{ reason: string; points: number }>
    status: string
    priority_rank: number | null
    contacts: {
      first_name: string | null
      last_name: string | null
      title: string | null
      email: string | null
      linkedin_url: string | null
    } | null
    companies: { name: string } | null
  }>

  const stats = {
    total: leads.length,
    hot: leads.filter((l) => l.score >= 70).length,
    qualified: leads.filter((l) => l.status === 'qualified').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Hit List</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Scored and ranked prospects ready for outreach
          </p>
        </div>
        <GenerateLeadsButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-zinc-900' },
          { label: 'Hot (70+)', value: stats.hot, color: 'text-emerald-600' },
          { label: 'Qualified', value: stats.qualified, color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Trophy className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-zinc-600 font-medium">No leads yet</p>
          <p className="text-zinc-400 text-sm mt-1">
            Enrich companies first, then click &quot;Generate Hit List&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 w-12">#</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Score</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {leads.map((lead, i) => {
                const contact = lead.contacts
                const fullName = contact
                  ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'
                  : '—'

                return (
                  <tr key={lead.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-zinc-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{fullName}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{contact?.title ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{lead.companies?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {contact?.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors text-xs"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{contact.email}</span>
                        </a>
                      ) : (
                        <span className="text-zinc-300 text-xs">No email</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect leadId={lead.id} current={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {contact?.linkedin_url ? (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-blue-600 transition-colors"
                          title="LinkedIn"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      ) : null}
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

// Silence unused import warning
