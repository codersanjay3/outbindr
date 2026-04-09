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
  is_public:     boolean
}

/** Fetch all sessions for a user (newest first) */
export async function getSessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as SessionRow[]
}

/** Fetch a single session by ID */
export async function getSessionById(id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as SessionRow
}

/** Create a blank draft session the moment the user starts a new session. */
export async function createDraftSession(): Promise<SessionRow> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Don't include setup_state in insert — column may not exist yet on older schemas.
  // Supabase will use the column default (null) if it exists.
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id:       user.id,
      config:        {},
      idea_text:     '',
      title:         'Draft',
      status:        'in_progress',
      history:       [],
      current_round: 0,
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
  try {
    const { error } = await supabase
      .from('sessions')
      .update({
        title: state.title || 'Draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    if (error) console.error('saveSetupState:', error)
  } catch {
    // Non-fatal — setup_state column may not exist on older schemas
  }
}

/** Promote a draft session to a running simulation */
export async function createSession(
  config: SimConfig,
  ideaText: string,
  existingId?: string | null,
): Promise<SessionRow> {
  const title = config.sessionName || config.ideaDocName || 'Untitled Pitch'

  if (existingId) {
    const { data, error } = await supabase
      .from('sessions')
      .update({
        config,
        idea_text:  ideaText,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingId)
      .select()
      .single()
    if (error) throw error
    return data as SessionRow
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id:       user.id,
      config,
      idea_text:     ideaText,
      title,
      status:        'in_progress',
      history:       [],
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

/** Mark a session as publicly shareable and return the watch URL */
export async function makeSessionPublic(sessionId: string): Promise<string> {
  // Embed ownerName into config so the public replay page can display it
  const [{ data: { user } }, { data: current }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('sessions').select('config').eq('id', sessionId).single(),
  ])
  const ownerName = user?.user_metadata?.full_name ?? ''
  const mergedConfig = current?.config ? { ...current.config, ownerName } : { ownerName }

  const { error } = await supabase
    .from('sessions')
    .update({ is_public: true, config: mergedConfig, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
  return `${window.location.origin}/replay/${sessionId}`
}

/** Fetch a session that is publicly visible (no auth required) */
export async function getPublicSession(id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('is_public', true)
    .eq('id', id)
    .single()
  if (error) return null
  return data as SessionRow
}
