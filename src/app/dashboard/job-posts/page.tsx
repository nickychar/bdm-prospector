import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScanButton } from './scan-button'
import { Building2, Briefcase, CalendarDays, ExternalLink } from 'lucide-react'
import type { JobPostRow } from '@/types/database'

type JobPostWithCompany = JobPostRow & { companies: { name: string } | null }

export default async function JobPostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: jobPosts }, { data: profile }] = await Promise.all([
    supabase
      .from('job_posts')
      .select('*, companies(name)')
      .eq('user_id', user.id)
      .order('detected_at', { ascending: false })
      .limit(100),
    supabase
      .from('users')
      .select('scan_keywords, scan_locations')
      .eq('id', user.id)
      .single(),
  ])

  const jobs = (jobPosts ?? []) as JobPostWithCompany[]
  const keywords = profile?.scan_keywords ?? []
  const locations = profile?.scan_locations ?? []

  // Stats
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const newThisWeek = jobs.filter(j => new Date(j.detected_at) > oneWeekAgo).length
  const uniqueCompanies = new Set(jobs.map(j => j.company_id).filter(Boolean)).size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Job Posts</h2>
          {keywords.length > 0 && (
            <p className="text-sm text-zinc-500 mt-0.5">
              Scanning for: {keywords.join(', ')}
              {locations.length > 0 && ` · ${locations.join(', ')}`}
            </p>
          )}
          {keywords.length === 0 && (
            <p className="text-sm text-zinc-500 mt-0.5">
              No keywords set — <a href="/dashboard/settings" className="underline">configure in Settings</a>
            </p>
          )}
        </div>
        <ScanButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, icon: Briefcase },
          { label: 'New This Week', value: newThisWeek, icon: CalendarDays },
          { label: 'Companies Hiring', value: uniqueCompanies, icon: Building2 },
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
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-zinc-600 font-medium">No job posts yet</p>
          <p className="text-zinc-400 text-sm mt-1">
            Click &ldquo;Scan for Jobs&rdquo; to find companies actively hiring
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Location</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Posted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {jobs.map((job) => {
                const company = job.companies as { name: string } | null
                const postedDate = job.posted_date
                  ? new Date(job.posted_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  : '—'
                const detectedDate = new Date(job.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

                return (
                  <tr key={job.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {company?.name ?? <span className="text-zinc-400">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{job.title}</td>
                    <td className="px-4 py-3 text-zinc-500">{job.location ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      <span title={`Detected ${detectedDate}`}>{postedDate}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {job.url ? (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-900 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
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
