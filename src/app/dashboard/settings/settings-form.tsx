'use client'

import { useTransition, useState } from 'react'
import { saveSettings } from './actions'

interface Props {
  defaultValues: {
    full_name: string
    agency_name: string
    scan_keywords: string
    scan_locations: string
  }
}

export function SettingsForm({ defaultValues }: Props) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveSettings(formData)
      if (res.error) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Agency Details */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <h3 className="font-medium text-zinc-900">Agency Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700" htmlFor="full_name">
              Your name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={defaultValues.full_name}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700" htmlFor="agency_name">
              Agency name
            </label>
            <input
              id="agency_name"
              name="agency_name"
              type="text"
              defaultValue={defaultValues.agency_name}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="Acme Recruitment"
            />
          </div>
        </div>
      </section>

      {/* Scan Configuration */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <div>
          <h3 className="font-medium text-zinc-900">Scan Configuration</h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            Define what roles you recruit for — we&apos;ll scan for companies hiring these.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700" htmlFor="scan_keywords">
            Job keywords <span className="text-zinc-400 font-normal">(one per line, max 3 used per scan)</span>
          </label>
          <textarea
            id="scan_keywords"
            name="scan_keywords"
            rows={4}
            defaultValue={defaultValues.scan_keywords}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none font-mono"
            placeholder={'software engineer\nfull stack developer\ntech lead'}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700" htmlFor="scan_locations">
            Target locations <span className="text-zinc-400 font-normal">(one per line — US/UK cities work best, e.g. &quot;London&quot; or &quot;New York&quot;)</span>
          </label>
          <textarea
            id="scan_locations"
            name="scan_locations"
            rows={3}
            defaultValue={defaultValues.scan_locations}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none font-mono"
            placeholder={'London, UK\nManchester, UK'}
          />
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
