import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-sm">BDM Prospector</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/search" className="text-muted-foreground hover:text-foreground">Search</Link>
          <Link href="/pipeline" className="text-muted-foreground hover:text-foreground">Pipeline</Link>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
