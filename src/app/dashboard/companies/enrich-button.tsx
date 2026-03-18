'use client'

import { useTransition } from 'react'
import { enrichCompany, enrichAllCompanies } from './actions'

export function EnrichButton({ companyId }: { companyId: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await enrichCompany(companyId)
      if (result.error) alert(result.error)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Enriching…' : 'Enrich'}
    </button>
  )
}

export function EnrichAllButton({ total }: { total: number }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await enrichAllCompanies()
      if (result.error) alert(result.error)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending || total === 0}
      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Enriching all…' : `Enrich All (${total})`}
    </button>
  )
}
