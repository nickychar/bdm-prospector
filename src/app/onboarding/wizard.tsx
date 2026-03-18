'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Mail, GitMerge, PartyPopper, Building2 } from 'lucide-react'
import { saveDeduplicateRule, completeOnboarding } from './actions'
import { connectGmail } from './gmail-actions'

const STEPS = ['Connect CRM', 'Gmail', 'Dedup rule', 'Done']

const DEDUP_OPTIONS = [
  { value: 'email', label: 'Match by email address', description: 'Deduplicate leads using exact email match' },
  { value: 'domain', label: 'Match by email domain', description: 'Group leads from the same company domain' },
  { value: 'name_and_company', label: 'Match by name + company', description: 'Deduplicate using full name and company name' },
]

const CRM_OPTIONS = [
  { name: 'Salesforce', color: 'bg-blue-50', textColor: 'text-blue-600' },
  { name: 'HubSpot', color: 'bg-orange-50', textColor: 'text-orange-600' },
  { name: 'Pipedrive', color: 'bg-green-50', textColor: 'text-green-600' },
  { name: 'Zoho CRM', color: 'bg-red-50', textColor: 'text-red-600' },
]

interface Props {
  initialStep: number
  initialDedupRule: string
  hasGmail: boolean
}

export function OnboardingWizard({ initialStep, initialDedupRule, hasGmail }: Props) {
  const [step, setStep] = useState(Math.min(initialStep, 3))
  const [dedupRule, setDedupRule] = useState(initialDedupRule)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSaveDedup() {
    setError(null)
    const fd = new FormData()
    fd.append('dedup_rule', dedupRule)
    startTransition(async () => {
      const result = await saveDeduplicateRule(fd)
      if (result?.error) { setError(result.error); return }
      setStep(3)
    })
  }

  function handleComplete() {
    startTransition(async () => {
      await completeOnboarding()
    })
  }

  function handleConnectGmail() {
    startTransition(async () => {
      const result = await connectGmail()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="w-full max-w-lg">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                i < step ? 'bg-zinc-900 text-white' :
                i === step ? 'bg-zinc-900 text-white ring-4 ring-zinc-200' :
                'bg-zinc-100 text-zinc-400'
              }`}>
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-5 h-px w-10 ${i < step ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {step === 0 && <StepConnectCRM onNext={() => setStep(1)} />}
        {step === 1 && (
          <StepGmail
            connected={hasGmail}
            onNext={() => setStep(2)}
            onConnect={handleConnectGmail}
            isPending={isPending}
            error={error}
          />
        )}
        {step === 2 && (
          <StepDedup
            value={dedupRule}
            onChange={setDedupRule}
            onSave={handleSaveDedup}
            isPending={isPending}
            error={error}
          />
        )}
        {step === 3 && (
          <StepDone
            hasGmail={hasGmail}
            dedupRule={dedupRule}
            onComplete={handleComplete}
            isPending={isPending}
          />
        )}
      </div>
    </div>
  )
}

function StepConnectCRM({ onNext }: { onNext: () => void }) {
  return (
    <div className="p-8">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100">
        <Building2 className="h-7 w-7 text-zinc-600" />
      </div>
      <h2 className="text-xl font-semibold text-zinc-900">Connect your CRM</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Link your CRM so BDM Prospector can check for existing leads before adding new ones.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {CRM_OPTIONS.map((crm) => (
          <div
            key={crm.name}
            className={`relative flex flex-col items-center gap-2 rounded-xl border border-zinc-200 p-4 opacity-60`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${crm.color}`}>
              <Building2 className={`h-5 w-5 ${crm.textColor}`} />
            </div>
            <span className="text-sm font-medium text-zinc-700">{crm.name}</span>
            <span className="text-xs text-zinc-400">Coming soon</span>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="mt-6 w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        Skip for now →
      </button>
    </div>
  )
}

function StepGmail({
  connected, onNext, onConnect, isPending, error,
}: {
  connected: boolean
  onNext: () => void
  onConnect: () => void
  isPending: boolean
  error: string | null
}) {
  return (
    <div className="p-8">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-red-50">
        <Mail className="h-7 w-7 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold text-zinc-900">Connect Gmail</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Link your work Gmail so BDM Prospector can send outreach emails on your behalf.
      </p>
      <div className="mt-6 space-y-3">
        {connected ? (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              Gmail connected
            </div>
            <button
              onClick={onNext}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Continue →
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onConnect}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              <Mail className="h-4 w-4" />
              {isPending ? 'Redirecting…' : 'Connect Gmail'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={onNext}
              className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Skip for now →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StepDedup({
  value, onChange, onSave, isPending, error,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  isPending: boolean
  error: string | null
}) {
  return (
    <div className="p-8">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-50">
        <GitMerge className="h-7 w-7 text-purple-600" />
      </div>
      <h2 className="text-xl font-semibold text-zinc-900">Deduplication rule</h2>
      <p className="mt-2 text-sm text-zinc-500">
        How should we detect if a lead already exists in your CRM?
      </p>
      <div className="mt-6 space-y-2">
        {DEDUP_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              value === opt.value
                ? 'border-zinc-900 bg-zinc-50'
                : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <input
              type="radio"
              name="dedup_rule"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-zinc-900"
            />
            <div>
              <div className="text-sm font-medium text-zinc-900">{opt.label}</div>
              <div className="text-xs text-zinc-500">{opt.description}</div>
            </div>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        onClick={onSave}
        disabled={isPending}
        className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : 'Save & Continue →'}
      </button>
    </div>
  )
}

function StepDone({
  hasGmail, dedupRule, onComplete, isPending,
}: {
  hasGmail: boolean
  dedupRule: string
  onComplete: () => void
  isPending: boolean
}) {
  const dedupLabel = DEDUP_OPTIONS.find(o => o.value === dedupRule)?.label ?? dedupRule

  return (
    <div className="p-8 text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-50">
          <PartyPopper className="h-7 w-7 text-green-600" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-zinc-900">You&apos;re all set!</h2>
      <p className="mt-2 text-sm text-zinc-500">Here&apos;s your setup summary.</p>

      <div className="mt-6 rounded-lg border border-zinc-200 divide-y divide-zinc-100 text-left">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-zinc-600">CRM</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
            Not connected
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-zinc-600">Gmail</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hasGmail ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
            {hasGmail ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-zinc-600">Dedup rule</span>
          <span className="text-xs font-medium text-zinc-700">{dedupLabel}</span>
        </div>
      </div>

      <button
        onClick={onComplete}
        disabled={isPending}
        className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Loading…' : 'Go to Dashboard →'}
      </button>
    </div>
  )
}
