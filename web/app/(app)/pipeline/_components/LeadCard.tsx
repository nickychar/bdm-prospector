'use client'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getScoreBand, SCORE_BAND_COLORS } from '@/lib/types'
import type { LeadWithCompany } from '@/lib/types'

interface LeadCardProps {
  lead: LeadWithCompany
  onClick: () => void
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  })

  const style = { transform: CSS.Translate.toString(transform) }
  const band = getScoreBand(lead.score)
  // MVP approximation: uses last_activity_at as a proxy for days in current stage.
  const daysInStage = Math.floor(
    (Date.now() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  const lastActivityDate = new Date(lead.last_activity_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-slate-200 p-3 cursor-grab hover:border-slate-400 select-none',
        isDragging && 'opacity-40 cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-sm text-slate-900 leading-snug line-clamp-2">
          {lead.company.name}
        </span>
        <Badge className={cn('shrink-0 text-xs', SCORE_BAND_COLORS[band])}>
          {lead.score}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{lead.contacts.length} contact{lead.contacts.length !== 1 ? 's' : ''}</span>
        <span>{daysInStage}d in stage</span>
        <span className="uppercase text-[10px] tracking-wide">{lead.company.country}</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{lastActivityDate}</div>
    </div>
  )
}
