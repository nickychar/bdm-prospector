'use client'

import { useTransition, useState, useRef, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'
import { saveSettings } from './actions'

interface Props {
  defaultValues: {
    full_name: string
    agency_name: string
    scan_keywords: string[]
    scan_locations: string[]
  }
}

function TagInput({
  label,
  hint,
  tags,
  onChange,
  placeholder,
}: {
  label: string
  hint: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const val = input.trim()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-700">
        {label} <span className="text-zinc-400 font-normal">{hint}</span>
      </label>
      <div
        className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 flex flex-wrap gap-2 cursor-text focus-within:ring-2 focus-within:ring-zinc-900"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-sm text-zinc-800"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          placeholder={tags.length === 0 ? placeholder : 'Add another…'}
          className="flex-1 min-w-[140px] text-sm outline-none bg-transparent placeholder-zinc-400"
        />
      </div>
      <p className="text-xs text-zinc-400">Press Enter to add · Backspace to remove last</p>
    </div>
  )
}

export function SettingsForm({ defaultValues }: Props) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<string[]>(defaultValues.scan_keywords)
  const [locations, setLocations] = useState<string[]>(defaultValues.scan_locations)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    setError(null)
    const formData = new FormData(e.currentTarget)
    // Inject tag arrays as newline-separated strings
    formData.set('scan_keywords', keywords.join('\n'))
    formData.set('scan_locations', locations.join('\n'))
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
      <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
        <div>
          <h3 className="font-medium text-zinc-900">Scan Configuration</h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            Define what roles you recruit for — we&apos;ll scan for companies actively hiring these.
          </p>
        </div>

        <TagInput
          label="Job keywords"
          hint="(up to 5 used per scan)"
          tags={keywords}
          onChange={setKeywords}
          placeholder="e.g. finance manager"
        />

        <TagInput
          label="Target locations"
          hint="(all used per scan)"
          tags={locations}
          onChange={setLocations}
          placeholder="e.g. Amsterdam"
        />

        {keywords.length > 0 && locations.length > 0 && (
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-4 py-3">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">Scan preview</p>
            <p className="text-sm text-zinc-700">
              Will run <span className="font-semibold">{Math.min(keywords.length, 5) * locations.length}</span> searches
              across{' '}
              <span className="font-medium">{Math.min(keywords.length, 5)} keyword{Math.min(keywords.length, 5) !== 1 ? 's' : ''}</span>
              {' '}×{' '}
              <span className="font-medium">{locations.length} location{locations.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
        )}
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
