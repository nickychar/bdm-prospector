import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Briefcase } from 'lucide-react'
import { ScanButton } from './scan-button'

const BOARD_COLORS: Record<string, string> = {
  'indeed-nl': 'bg-blue-50 text-blue-700',
  'nationale-vacaturebank': 'bg-purple-50 text-purple-700',
  monsterboard: 'bg-orange-50 text-orange-700',
  intermediair: 'bg-green-50 text-green-700',
  'stepstone-nl': 'bg-yellow-50 text-yellow-700',
  jobbird: 'bg-pink-50 text-pink-700',
  flexmarkt: 'bg-teal-50 text-teal-700',
}

function BoardBadge({ board }: { board: string | null }) {
  if (!board) return null
  const first = board.split(',')[0].trim()
  const extra = board.split(',').length - 1
  const color = BOARD_COLORS[first] ?? 'bg-zinc-100 text-zinc-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {first}{extra > 0 ? ` +${extra}` : ''}
    </span>
  )
}

export default async function JobSignalsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  type SignalRow = {
    id: string
    title: string | null
    contract_type: string | null
    board: string | null
    posted_date: string | null
    raw_snippet: string | null
    boards_count: number
    created_at: string
    companies: { name: string; domain: string | null } | null
  }

  const { data: raw } = await supabase
    .from('job_signals')
    .select('id, title, contract_type, board, posted_date, raw_snippet, boards_count, created_at, companies(name, domain)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const signals = (raw ?? []) as SignalRow[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Job Signals</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Companies actively hiring — scanned across 7 NL job boards
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600">
            {signals.length} signals
          </div>
          <ScanButton />
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-zinc-600 font-medium">No job signals yet</p>
          <p className="text-zinc-400 text-sm mt-1">
            Add keywords in Settings, then click &quot;Scan&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Board</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Contract</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {signals.map((signal) => (
                <tr key={signal.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{signal.companies?.name ?? '—'}</p>
                    {signal.companies?.domain && (
                      <p className="text-xs text-zinc-400 mt-0.5">{signal.companies.domain}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-700">{signal.title ?? '—'}</p>
                    {signal.raw_snippet && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[260px]">
                        {signal.raw_snippet}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <BoardBadge board={signal.board} />
                    {signal.boards_count > 1 && (
                      <p className="text-xs text-zinc-400 mt-1">
                        seen on {signal.boards_count} boards
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {signal.contract_type ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {signal.posted_date ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
