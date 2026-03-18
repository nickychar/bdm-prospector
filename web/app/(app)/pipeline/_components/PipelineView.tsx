'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { filterLeads } from '@/lib/filter-leads'
import { moveStage, archiveLead } from '../actions'
import { BoardView } from './BoardView'
import { ListView } from './ListView'
import { FilterBar } from './FilterBar'
import { LeadDetailPanel } from './LeadDetailPanel'
import type { LeadWithCompany, PipelineStage, PipelineEvent } from '@/lib/types'
import type { PipelineFilters } from '../types'

interface PipelineViewProps {
  initialLeads: LeadWithCompany[]
}

export function PipelineView({ initialLeads }: PipelineViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Leads in local state for optimistic stage moves
  const [leads, setLeads] = useState<LeadWithCompany[]>(initialLeads)
  const [selectedLead, setSelectedLead] = useState<LeadWithCompany | null>(null)
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([])
  const [, startTransition] = useTransition()

  // Filters read from URL — no local state to avoid double-source-of-truth
  const filters: PipelineFilters = {
    scoreBand: (searchParams.get('band') as any) ?? null,
    country: (searchParams.get('country') as any) ?? null,
  }
  const view = searchParams.get('view') ?? 'board'

  function setFilters(next: PipelineFilters) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.scoreBand) params.set('band', next.scoreBand)
    else params.delete('band')
    if (next.country) params.set('country', next.country)
    else params.delete('country')
    router.replace(`/pipeline?${params}`)
  }

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.replace(`/pipeline?${params}`)
  }

  // Fetch pipeline events when a lead is selected
  useEffect(() => {
    if (!selectedLead) {
      setPipelineEvents([])
      return
    }
    const selectedLeadId = selectedLead.id
    let ignore = false

    async function fetchEvents() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pipeline_events')
        .select('*')
        .eq('lead_id', selectedLeadId)
        .order('created_at', { ascending: false })

      if (ignore) return
      if (error) {
        console.error('Failed to fetch pipeline events:', error)
        return
      }
      setPipelineEvents(data ?? [])
    }

    fetchEvents()
    return () => { ignore = true }
  }, [selectedLead?.id])

  // Optimistic stage move: update local state immediately then write to DB
  async function handleMoveStage(leadId: string, toStage: PipelineStage) {
    const previousLeads = leads
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: toStage } : l))
    // Also update the selected lead panel if it's the one being moved
    setSelectedLead(prev => prev?.id === leadId ? { ...prev, stage: toStage } : prev)
    try {
      await moveStage(leadId, toStage)
    } catch {
      setLeads(previousLeads)
    }
  }

  async function handleArchive(leadId: string) {
    const previousLeads = leads
    setLeads(prev => prev.filter(l => l.id !== leadId))
    try {
      await archiveLead(leadId)
    } catch {
      setLeads(previousLeads)
    }
  }

  const filtered = filterLeads(leads, filters)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Pipeline
          <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length} leads</span>
        </h1>
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="mb-4">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <BoardView
            leads={filtered}
            onMoveStage={handleMoveStage}
            onSelectLead={setSelectedLead}
          />
        </TabsContent>

        <TabsContent value="list">
          <ListView leads={filtered} onSelectLead={setSelectedLead} />
        </TabsContent>
      </Tabs>

      <LeadDetailPanel
        lead={selectedLead}
        pipelineEvents={pipelineEvents}
        onClose={() => setSelectedLead(null)}
        onMoveStage={handleMoveStage}
        onArchive={(leadId) => { handleArchive(leadId); setSelectedLead(null) }}
      />
    </div>
  )
}
