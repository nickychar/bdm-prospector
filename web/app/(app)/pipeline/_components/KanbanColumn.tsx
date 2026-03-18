'use client'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { STAGE_LABELS } from '@/lib/types'
import { LeadCard } from './LeadCard'
import type { LeadWithCompany, PipelineStage } from '@/lib/types'

interface KanbanColumnProps {
  stage: PipelineStage
  leads: LeadWithCompany[]
  onSelectLead: (lead: LeadWithCompany) => void
}

export function KanbanColumn({ stage, leads, onSelectLead }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div className="flex flex-col w-60 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-medium text-sm text-slate-700">{STAGE_LABELS[stage]}</h3>
        <span className="text-xs text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[120px] rounded-lg p-2 flex flex-col gap-2 transition-colors',
          isOver ? 'bg-slate-100 ring-2 ring-slate-300' : 'bg-slate-50'
        )}
      >
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onSelectLead(lead)} />
        ))}
        {leads.length === 0 && (
          <div className="text-xs text-slate-300 text-center pt-4">Drop here</div>
        )}
      </div>
    </div>
  )
}
