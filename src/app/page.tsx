import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Scan,
  Users,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  Mail,
} from 'lucide-react'

export default async function HomePage() {
  // Logged-in users go straight to dashboard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-[family-name:var(--font-geist-sans)]">
      {/* ─── Nav ─── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <span className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
              B
            </span>
            BDM Prospector
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-500">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How it works</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="pt-40 pb-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Built for recruitment agency BDMs
          </span>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Find your next client{' '}
            <span className="text-violet-600">before your competition does</span>
          </h1>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            BDM Prospector scans job boards, finds HR decision-makers, scores your leads, and
            writes personalised outreach — all on autopilot.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-12 px-6 border-y border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { value: '10+', label: 'hours saved per week on manual research' },
            { value: '< 30s', label: 'to generate a personalised cold email' },
            { value: '100%', label: 'focused on companies actively hiring' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-4xl font-bold text-zinc-900">{value}</p>
              <p className="mt-1 text-sm text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to win new clients</h2>
            <p className="text-zinc-500 max-w-xl mx-auto">
              From job signal to sent email — the full prospecting workflow in one tool.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Scan,
                color: 'bg-blue-50 text-blue-600',
                title: 'Job Scanning',
                desc: 'Monitor job boards for companies actively hiring the roles you place. New hiring signals every scan.',
              },
              {
                icon: Users,
                color: 'bg-emerald-50 text-emerald-600',
                title: 'Contact Enrichment',
                desc: 'Find HR directors, talent leads, and people managers at every hiring company via Apollo.',
              },
              {
                icon: Zap,
                color: 'bg-amber-50 text-amber-600',
                title: 'Lead Scoring',
                desc: 'Leads are auto-ranked 0–100 based on hiring volume, seniority, contact data, and more.',
              },
              {
                icon: Sparkles,
                color: 'bg-violet-50 text-violet-600',
                title: 'AI Email Drafts',
                desc: 'Claude writes personalised cold emails referencing their open roles. Edit and send in seconds.',
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-zinc-100 bg-white p-6 hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="py-24 px-6 bg-zinc-50">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">From zero to pipeline in 3 steps</h2>
            <p className="text-zinc-500">Set it up once. Let it run.</p>
          </div>
          <div className="space-y-8">
            {[
              {
                step: '01',
                icon: Building2,
                title: 'Tell us what you recruit for',
                desc: 'Set your target job keywords (e.g. "Software Engineer", "Data Scientist") and target locations. That\'s your scan config — takes 2 minutes.',
              },
              {
                step: '02',
                icon: Users,
                title: 'We build your target list automatically',
                desc: 'BDM Prospector scans job boards, detects hiring companies, finds their HR and talent contacts via Apollo, and scores every lead for you.',
              },
              {
                step: '03',
                icon: Mail,
                title: 'Draft, personalise, and reach out',
                desc: 'One click generates a personalised email referencing the company\'s specific open roles. Copy it, tweak it, send it. Done.',
              },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex gap-6 items-start">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
                  {step}
                </div>
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-zinc-400" />
                    <h3 className="font-semibold text-zinc-900">{title}</h3>
                  </div>
                  <p className="text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-3xl bg-zinc-900 px-8 py-16 text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to fill your pipeline?</h2>
            <p className="text-zinc-400 mb-8 text-lg">
              Stop spending hours on LinkedIn. Let BDM Prospector surface your best opportunities automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-700 px-6 py-3.5 text-base font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
              {['No credit card required', 'Free to get started', 'Cancel anytime'].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-zinc-600" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-zinc-100 py-10 px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-zinc-900">
            <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">
              B
            </span>
            BDM Prospector
          </div>
          <p className="text-sm text-zinc-400">
            Built for recruitment agency BDMs who want to work smarter.
          </p>
          <div className="flex gap-6 text-sm text-zinc-400">
            <Link href="/auth/login" className="hover:text-zinc-900 transition-colors">Sign in</Link>
            <Link href="/auth/signup" className="hover:text-zinc-900 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
