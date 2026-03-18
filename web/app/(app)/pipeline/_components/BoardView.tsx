'use client'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { KANBAN_STAGES } from '@/lib/types'
import { KanbanColumn } from './KanbanColumn'
import type { LeadWithCompany, PipelineStage } from '@/lib/types'

interface BoardViewProps {
  leads: LeadWithCompany[]
  onMoveStage: (leadId: string, toStage: PipelineStage) => void
  onSelectLead: (lead: LeadWithCompany) => void
}

export function BoardView({ leads, onMoveStage, onSelectLead }: BoardViewProps) {
  // PointerSensor with activation constraint prevents drag firing on card click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const leadId = active.id as string
    const toStage = over.id as PipelineStage
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === toStage) return
    onMoveStage(leadId, toStage)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={leads.filter(l => l.stage === stage)}
            onSelectLead={onSelectLead}
          />
        ))}
      </div>
    </DndContext>
  )
}
