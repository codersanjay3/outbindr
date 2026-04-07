import { supabase } from './supabase'
import type { SimConfig, Message, Verdict, Panelist } from './types'

export interface SetupState {
  panelists:  Panelist[]
  ideaText:   string
  rounds:     number
  title:      string
  pitchMode:  'mic' | 'type'
}

export interface SessionRow {
  id:            string
  user_id:       string
  created_at:    string
  updated_at:    string
  status:        'in_progress' | 'completed'
  title:         string | null
  config:        SimConfig
  history:       Message[]
  verdict:       Verdict | null
  idea_text:     string
  current_round: number
  setup_state:   SetupState | null
}

/** Fetch all sessions for a user (max 3, newest first) */
export async function getSessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as SessionRow[]
}

/** Create a blank draft session the moment the user starts a new session.
 *  config defaults to empty — filled in when they actually launch. */
export async function createDraftSession(): Promise<SessionRow> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      config:        {},
      idea_text:     '',
      title:         'Draft',
      status:        'in_progress',
      history:       [],
      current_round: 0,
      setup_state:   null,
    })
    .select()
    .single()
  if (error) throw error
  return data as SessionRow
}

/** Save setup-screen state so the user can resume from the configuration page */
export async function saveSetupState(
  sessionId: string,
  state: SetupState,
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({
      setup_state: state,
      title: state.title || 'Draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
  if (error) console.error('saveSetupState:', error)
}

/** Promote a draft session to a running simulation */
export async function createSession(
  config: SimConfig,
  ideaText: string,
  existingId?: string,
): Promise<SessionRow> {
  if (existingId) {
    // Update the existing draft
    const { data, error } = await supabase
      .from('sessions')
      .update({
        config,
        idea_text:   ideaText,
        title:       config.ideaDocName || 'Untitled Pitch',
        setup_state: null,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', existingId)
      .select()
      .single()
    if (error) throw error
    return data as SessionRow
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      config,
      idea_text:     ideaText,
      title:         config.ideaDocName || 'Untitled Pitch',
      status:        'in_progress',
      history:       [],
      current_round: 0,
      setup_state:   null,
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
  currentRound: number,
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
  history: Message[],
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
