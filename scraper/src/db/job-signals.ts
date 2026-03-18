import { db } from './client.js'
import type { ContractType, Seniority } from '../types.js'

interface JobSignalInput {
  companyId: string
  title: string | null
  seniority?: Seniority | null
  contractType?: ContractType | null
  board: string
  postedDate?: string | null
  snippet?: string | null
  boardsCount: number
  scrapeJobId: string
}

export async function insertJobSignal(input: JobSignalInput): Promise<void> {
  const { error } = await db.from('job_signals').insert({
    company_id: input.companyId,
    title: input.title,
    seniority: input.seniority ?? null,
    contract_type: input.contractType ?? null,
    board: input.board,
    posted_date: input.postedDate ?? null,
    raw_snippet: input.snippet ?? null,
    boards_count: input.boardsCount,
    scrape_job_id: input.scrapeJobId,
  })
  if (error) throw new Error(error.message)
}
