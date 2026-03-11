'use client'

import { useTransition } from 'react'
import { generateLeads, updateLeadStatus } from './actions'
import { Zap } from 'lucide-react'

export function GenerateLeadsButton() {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await generateLeads()
      if (result.error) alert(result.error)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
    >
      <Zap className="h-4 w-4" />
      {pending ? 'Scoring…' : 'Generate Hit List'}
    </button>
  )
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'disqualified', label: 'Disqualified' },
] as const

export function StatusSelect({
  leadId,
  current,
}: {
  leadId: string
  current: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => {
        const val = e.target.value as Parameters<typeof updateLeadStatus>[1]
        startTransition(() => updateLeadStatus(leadId, val))
      }}
      className="text-xs rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-600 disabled:opacity-50 cursor-pointer"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
