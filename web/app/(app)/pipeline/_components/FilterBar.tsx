'use client'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { PipelineFilters } from '../types'
import type { ScoreBand, Country } from '@/lib/types'

interface FilterBarProps {
  filters: PipelineFilters
  onChange: (filters: PipelineFilters) => void
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof PipelineFilters>(key: K, value: PipelineFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={filters.scoreBand ?? 'all'}
        onValueChange={v => set('scoreBand', v === 'all' ? null : v as ScoreBand)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Score band" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All bands</SelectItem>
          <SelectItem value="hot">Hot (70+)</SelectItem>
          <SelectItem value="warm">Warm (45–69)</SelectItem>
          <SelectItem value="cold">Cold (20–44)</SelectItem>
          <SelectItem value="hidden">Hidden (&lt;20)</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.country ?? 'all'}
        onValueChange={v => set('country', v === 'all' ? null : v as Country)}
      >
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All countries</SelectItem>
          <SelectItem value="uk">UK</SelectItem>
          <SelectItem value="nl">NL</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
