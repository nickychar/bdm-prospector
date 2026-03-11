'use client'

import { useTransition, useState } from 'react'
import { scanJobs } from './actions'
import { RefreshCw } from 'lucide-react'

export function ScanButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ count: number; error?: string } | null>(null)

  function handleScan() {
    setResult(null)
    startTransition(async () => {
      const res = await scanJobs()
      setResult(res)
    })
  }

  return (
    <div className="flex items-center gap-3">
      {result && !result.error && (
        <span className="text-sm text-emerald-600 font-medium">
          +{result.count} new job{result.count !== 1 ? 's' : ''} found
        </span>
      )}
      {result?.error && (
        <span className="text-sm text-red-500">{result.error}</span>
      )}
      <button
        onClick={handleScan}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Scanning…' : 'Scan for Jobs'}
      </button>
    </div>
  )
}
