'use client'
import { useState, useTransition } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { computeScoreBreakdown } from '@/lib/score-breakdown'
import { getScoreBand, PIPELINE_STAGES, STAGE_LABELS, SCORE_BAND_COLORS } from '@/lib/types'
import { moveStage, addNote, archiveLead } from '../actions'
import type { LeadWithCompany, PipelineStage, PipelineEvent } from '@/lib/types'

interface LeadDetailPanelProps {
  lead: LeadWithCompany | null
  pipelineEvents: PipelineEvent[]
  onClose: () => void
  onArchive?: (leadId: string) => void
}

export function LeadDetailPanel({ lead, pipelineEvents, onClose, onArchive }: LeadDetailPanelProps) {
  const [noteText, setNoteText] = useState('')
  const [revealedEmails, setRevealedEmails] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  if (!lead) return null

  const band = getScoreBand(lead.score)
  const breakdown = computeScoreBreakdown(lead)

  function handleMoveStage(toStage: PipelineStage) {
    startTransition(() => moveStage(lead!.id, toStage))
  }

  function handleAddNote() {
    if (!noteText.trim()) return
    const text = noteText.trim()
    setNoteText('')
    startTransition(() => addNote(lead!.id, text))
  }

  function handleArchive() {
    if (onArchive) {
      onArchive(lead!.id)
    } else {
      startTransition(() => archiveLead(lead!.id))
      onClose()
    }
  }

  return (
    <Sheet open={!!lead} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[580px] p-0 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">

            {/* Header */}
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-tight">{lead.company.name}</SheetTitle>
                  <a
                    href={`https://${lead.company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:underline break-all"
                  >
                    {lead.company.domain}
                  </a>
                </div>
                <Badge className={cn('shrink-0 text-sm px-2', SCORE_BAND_COLORS[band])}>
                  {lead.score}
                </Badge>
              </div>
              <div className="flex gap-2 text-sm text-slate-500 flex-wrap">
                {lead.company.size_band && <span>{lead.company.size_band}</span>}
                {lead.company.sector && <span>· {lead.company.sector}</span>}
                {lead.company.country && (
                  <span className="uppercase">· {lead.company.country}</span>
                )}
              </div>
            </SheetHeader>

            {/* Quick actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={lead.stage}
                onValueChange={v => handleMoveStage(v as PipelineStage)}
                disabled={isPending}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map(s => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={isPending}
              >
                Archive
              </Button>
            </div>

            {/* Score breakdown */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Score Breakdown</h4>
              {breakdown.length === 0 ? (
                <p className="text-sm text-slate-400">No signals yet.</p>
              ) : (
                <div className="space-y-0">
                  {breakdown.map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0"
                    >
                      <span className="text-slate-600">{item.label}</span>
                      <span
                        className={cn(
                          'font-medium tabular-nums',
                          item.points < 0 ? 'text-red-600' : 'text-slate-900'
                        )}
                      >
                        {item.points > 0 ? '+' : ''}{item.points}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-1.5 font-semibold border-t border-slate-200 mt-1">
                    <span className="text-slate-700">Total</span>
                    <span>{lead.score}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Job signals */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                Job Signals ({lead.job_signals.length})
              </h4>
              <div className="space-y-2">
                {lead.job_signals.slice(0, 5).map(signal => (
                  <div key={signal.id} className="text-sm border rounded-md p-2 bg-slate-50">
                    <div className="font-medium text-slate-800">{signal.title ?? '—'}</div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {signal.board} · {signal.posted_date ?? 'unknown date'}
                      {signal.contract_type && ` · ${signal.contract_type}`}
                    </div>
                  </div>
                ))}
                {lead.job_signals.length > 5 && (
                  <p className="text-xs text-slate-400">
                    +{lead.job_signals.length - 5} more signals
                  </p>
                )}
              </div>
            </section>

            {/* Contacts */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                Contacts ({lead.contacts.length})
              </h4>
              <div className="space-y-2">
                {lead.contacts.length === 0 ? (
                  <p className="text-sm text-slate-400">No contacts found yet.</p>
                ) : (
                  lead.contacts.map(contact => (
                    <div key={contact.id} className="border rounded-md p-3 text-sm bg-slate-50">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-slate-800">{contact.name ?? '—'}</span>
                        <Badge variant="outline" className="text-xs">
                          {contact.persona_type === 'hiring_manager' ? 'Hiring Manager' : 'Agency Selector'}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {contact.confidence}
                        </Badge>
                      </div>
                      <div className="text-slate-500">{contact.title ?? '—'}</div>
                      {contact.email && (
                        <div className="mt-1 text-slate-500">
                          {revealedEmails.has(contact.id) ? (
                            <span>{contact.email}</span>
                          ) : (
                            <button
                              className="text-xs text-slate-400 underline hover:text-slate-600"
                              onClick={() =>
                                setRevealedEmails(s => new Set([...s, contact.id]))
                              }
                            >
                              Reveal email
                            </button>
                          )}
                          {contact.smtp_verified && (
                            <span className="ml-2 text-green-600 text-xs">✓ verified</span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-1">{contact.source}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Add note */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Add Note</h4>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Write a note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={isPending || !noteText.trim()}
                >
                  Add
                </Button>
              </div>
            </section>

            {/* Activity log — notes only */}
            {(() => {
              const notes = pipelineEvents.filter(e => e.note)
              return (
                <section>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Activity Log</h4>
                  {notes.length === 0 ? (
                    <p className="text-sm text-slate-400">No notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.map(event => (
                        <div
                          key={event.id}
                          className="text-sm text-slate-600 border-l-2 border-blue-200 pl-3 py-1"
                        >
                          <span className="italic">&quot;{event.note}&quot;</span>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(event.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })()}

            {/* Pipeline history — stage moves only */}
            {(() => {
              const stageMoves = pipelineEvents.filter(e => !e.note)
              return (
                <section>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Pipeline History</h4>
                  {stageMoves.length === 0 ? (
                    <p className="text-sm text-slate-400">No stage moves yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {stageMoves.map(event => (
                        <div
                          key={event.id}
                          className="text-sm text-slate-600 border-l-2 border-slate-200 pl-3 py-1"
                        >
                          <span>
                            Moved from{' '}
                            <strong>
                              {event.from_stage
                                ? (STAGE_LABELS[event.from_stage as PipelineStage] ?? event.from_stage)
                                : 'none'}
                            </strong>
                            {' '}to{' '}
                            <strong>
                              {event.to_stage
                                ? (STAGE_LABELS[event.to_stage as PipelineStage] ?? event.to_stage)
                                : '?'}
                            </strong>
                          </span>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(event.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })()}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
