import { supabase } from './supabase'
import type { SimConfig, Message, Verdict } from './types'

export interface SessionRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  status: 'in_progress' | 'completed'
  title: string | null
  config: SimConfig
  history: Message[]
  verdict: Verdict | null
  idea_text: string
  current_round: number
}

/** Fetch all sessions for a user (max 3, newest first) */
export async function getSessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(3)
  if (error) throw error
  return (data ?? []) as SessionRow[]
}

/** Create a new session row */
export async function createSession(
  config: SimConfig,
  ideaText: string
): Promise<SessionRow> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      config,
      idea_text: ideaText,
      title: config.ideaDocName || 'Untitled Pitch',
      status: 'in_progress',
      history: [],
      current_round: 0,
    })
    .select()
    .single()
  if (error) throw error
  return data as SessionRow
}

/** Incrementally update history + round as the simulation progresses */
export async function saveProgress(
  sessionId: string,
  history: Message[],
  currentRound: number
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ history, current_round: currentRound, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) console.error('saveProgress:', error)
}

/** Mark session complete and store the final verdict */
export async function completeSession(
  sessionId: string,
  verdict: Verdict,
  history: Message[]
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'completed', verdict, history, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) console.error('completeSession:', error)
}

/** Delete a session */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
  if (error) throw error
}
