import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Linkedin, Mail } from 'lucide-react'
import type { ContactRow, CompanyRow } from '@/types/database'

type ContactWithCompany = ContactRow & { companies: Pick<CompanyRow, 'name'> | null }

export default async function ContactsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('contacts')
    .select('*, companies(name)')
    .eq('user_id', user.id)
    .order('enriched_at', { ascending: false })
    .limit(200)

  const contacts = (data ?? []) as ContactWithCompany[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Contacts</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            HR &amp; talent contacts enriched via Apollo
          </p>
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600">
          {contacts.length} contacts
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-zinc-600 font-medium">No contacts yet</p>
          <p className="text-zinc-400 text-sm mt-1">
            Go to Companies and click &quot;Enrich&quot; to find HR contacts via Apollo
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Title</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contacts.map((contact) => {
                const fullName = [contact.first_name, contact.last_name]
                  .filter(Boolean)
                  .join(' ') || '—'
                const company = contact.companies as Pick<CompanyRow, 'name'> | null

                return (
                  <tr key={contact.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{fullName}</td>
                    <td className="px-4 py-3 text-zinc-500">{contact.title ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{company?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span className="text-xs">{contact.email}</span>
                        </a>
                      ) : (
                        <span className="text-zinc-300 text-xs">No email</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {contact.linkedin_url ? (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-zinc-400 hover:text-blue-600 transition-colors"
                          title="View on LinkedIn"
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
