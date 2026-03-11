import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Mail, Sparkles } from 'lucide-react'
import { CopyButton, DeleteDraftButton } from './draft-controls'

export default async function EmailDraftsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  type DraftWithLead = {
    id: string
    subject: string
    body: string
    status: string
    created_at: string
    leads: {
      contacts: { first_name: string | null; last_name: string | null } | null
      companies: { name: string } | null
    } | null
  }

  const { data: raw } = await supabase
    .from('email_drafts')
    .select('id, subject, body, status, created_at, leads(contacts(first_name, last_name), companies(name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const drafts = (raw ?? []) as DraftWithLead[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Email Drafts</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            AI-generated outreach emails — draft from the Hit List
          </p>
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600">
          {drafts.length} drafts
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-zinc-600 font-medium">No drafts yet</p>
          <p className="text-zinc-400 text-sm mt-1">
            Go to the Hit List and click &quot;Draft Email&quot; on any lead
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const lead = draft.leads
            const contact = lead?.contacts
            const contactName =
              [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Unknown'
            const companyName = lead?.companies?.name ?? 'Unknown'
            const fullEmail = `Subject: ${draft.subject}\n\n${draft.body}`

            return (
              <div key={draft.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium text-zinc-900 text-sm">{contactName}</span>
                    <span className="text-zinc-400 text-sm">at</span>
                    <span className="text-zinc-700 text-sm">{companyName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        draft.status === 'sent'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {draft.status}
                    </span>
                    <CopyButton text={fullEmail} />
                    <DeleteDraftButton draftId={draft.id} />
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-zinc-800">
                    <span className="text-zinc-400 mr-1">Subject:</span>
                    {draft.subject}
                  </p>
                  <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
                    {draft.body}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
