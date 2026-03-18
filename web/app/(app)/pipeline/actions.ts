'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PipelineStage } from '@/lib/types'

export async function moveStage(leadId: string, toStage: PipelineStage): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('stage')
    .eq('id', leadId)
    .single()
  if (fetchError || !lead) throw new Error('Lead not found')

  const { error: updateError } = await supabase
    .from('leads')
    .update({ stage: toStage, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
  if (updateError) throw new Error(updateError.message)

  const { error: eventError } = await supabase
    .from('pipeline_events')
    .insert({ lead_id: leadId, from_stage: lead.stage, to_stage: toStage })
  if (eventError) throw new Error(eventError.message)

  revalidatePath('/pipeline')
}

export async function addNote(leadId: string, note: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('pipeline_events')
    .insert({ lead_id: leadId, note })
  if (error) throw new Error(error.message)
  const { error: updateError } = await supabase
    .from('leads')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
  if (updateError) throw new Error(updateError.message)
  revalidatePath('/pipeline')
}

export async function archiveLead(leadId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('leads')
    .update({ is_suppressed: true, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
  if (error) throw new Error(error.message)
  revalidatePath('/pipeline')
}
