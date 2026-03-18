'use client'

import { useTransition, useState } from 'react'
import { generateDraft, deleteDraft } from './actions'
import { Sparkles, Copy, Trash2, Check } from 'lucide-react'

export function GenerateDraftButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const result = await generateDraft(leadId)
          if (result.error) alert(result.error)
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {pending ? 'Drafting…' : 'Draft Email'}
    </button>
  )
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function DeleteDraftButton({ draftId }: { draftId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => deleteDraft(draftId))}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
