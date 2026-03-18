'use client'
import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { sortLeads, type SortField, type SortDir } from '@/lib/filter-leads'
import { getScoreBand, STAGE_LABELS, SCORE_BAND_COLORS } from '@/lib/types'
import type { LeadWithCompany } from '@/lib/types'

interface ListViewProps {
  leads: LeadWithCompany[]
  onSelectLead: (lead: LeadWithCompany) => void
}

export function ListView({ leads, onSelectLead }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = sortLeads(leads, sortField, sortDir)

  function SortHead({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    return (
      <TableHead
        className="cursor-pointer select-none whitespace-nowrap"
        onClick={() => toggleSort(field)}
      >
        {label}
        {active && <span className="ml-1 text-slate-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </TableHead>
    )
  }

  if (leads.length === 0) {
    return <p className="text-slate-400 text-sm py-8 text-center">No leads match your filters.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Country</TableHead>
          <SortHead field="score" label="Score" />
          <TableHead>Stage</TableHead>
          <TableHead>Contacts Found</TableHead>
          <SortHead field="last_activity_at" label="Last Activity" />
          <TableHead>Days in Stage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(lead => {
          const band = getScoreBand(lead.score)
          const daysAgo = Math.floor(
            (Date.now() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          // MVP approximation: daysInStage uses last_activity_at as a proxy for stage-entry time
          return (
            <TableRow
              key={lead.id}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onSelectLead(lead)}
            >
              <TableCell className="font-medium text-slate-900">
                {lead.company.name}
              </TableCell>
              <TableCell className="uppercase text-xs text-slate-500">
                {lead.company.country}
              </TableCell>
              <TableCell>
                <Badge className={cn('text-xs', SCORE_BAND_COLORS[band])}>
                  {lead.score}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-700">{STAGE_LABELS[lead.stage]}</TableCell>
              <TableCell className="text-slate-500">{lead.contacts.length}</TableCell>
              <TableCell className="text-slate-400 text-sm">
                {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
              </TableCell>
              <TableCell className="text-slate-500">
                {daysAgo === 0 ? '<1d' : `${daysAgo}d`}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
