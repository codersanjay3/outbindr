'use client'
import { useEffect, useRef, useState } from 'react'
import SetupScreen from './SetupScreen'
import SimScreen from './SimScreen'
import VerdictScreen from './VerdictScreen'
import { createDraftSession, createSession, saveProgress, completeSession, saveSetupState, deleteSession } from '@/lib/supabase-sessions'
import type { SetupState } from '@/lib/supabase-sessions'
import type { SimConfig, Verdict, Message } from '@/lib/types'

type Phase = 'setup' | 'sim' | 'verdict'

interface Props {
  /** Called when user wants to go back to the dashboard */
  onBackToDashboard?: () => void
  /** Pre-loaded session id (for resuming) */
  initialSessionId?: string
  /** Pre-loaded config (for resuming) */
  initialConfig?: SimConfig
  /** Pre-loaded history (for resuming) */
  initialHistory?: Message[]
  /** Pre-loaded idea text (for resuming) */
  initialIdeaText?: string
  /** Pre-loaded current round (for resuming) */
  initialRound?: number
}

export default function PitchWars({
  onBackToDashboard,
  initialSessionId,
  initialConfig,
  initialHistory,
  initialIdeaText,
  initialRound,
}: Props) {
  const [phase, setPhase]       = useState<Phase>(initialConfig ? 'sim' : 'setup')
  const [config, setConfig]     = useState<SimConfig | null>(initialConfig ?? null)
  const [ideaText, setIdeaText] = useState(initialIdeaText ?? '')
  const [verdict, setVerdict]   = useState<Verdict | null>(null)
  const sessionIdRef            = useRef<string | null>(initialSessionId ?? null)

  // Create a draft session the moment the setup screen appears
  useEffect(() => {
    if (phase !== 'setup') return
    if (sessionIdRef.current) return // already have one (resume flow)
    createDraftSession()
      .then(row => { sessionIdRef.current = row.id })
      .catch(e => console.error('createDraftSession:', e))
  }, [phase])

  const handleAutoSave = async (state: SetupState) => {
    if (!sessionIdRef.current) return
    try {
      await saveSetupState(sessionIdRef.current, state)
    } catch (e) {
      console.error('saveSetupState error:', e)
    }
  }

  const handleLaunch = async (cfg: SimConfig, _idea: File | null, text?: string) => {
    setConfig(cfg)
    setIdeaText(text ?? '')

    // Promote the draft session to a running simulation
    try {
      const row = await createSession(cfg, text ?? '', sessionIdRef.current ?? undefined)
      sessionIdRef.current = row.id
    } catch (e) {
      console.error('Failed to create session:', e)
    }

    setPhase('sim')
  }

  const handleProgress = async (history: Message[], round: number) => {
    if (!sessionIdRef.current) return
    try {
      await saveProgress(sessionIdRef.current, history, round)
    } catch (e) {
      console.error('saveProgress error:', e)
    }
  }

  const handleVerdict = async (v: Verdict, history: Message[]) => {
    setVerdict(v)
    if (sessionIdRef.current) {
      try {
        await completeSession(sessionIdRef.current, v, history)
      } catch (e) {
        console.error('completeSession error:', e)
      }
    }
    setPhase('verdict')
  }

  const handleBack = () => {
    // If the draft was never launched (phase stayed on setup), delete it to keep dashboard clean
    if (phase === 'setup' && sessionIdRef.current) {
      deleteSession(sessionIdRef.current).catch(() => {})
      sessionIdRef.current = null
    }
    onBackToDashboard?.()
  }

  const handleRestart = () => {
    if (onBackToDashboard) {
      onBackToDashboard()
    } else {
      setPhase('setup')
      setConfig(null)
      setIdeaText('')
      setVerdict(null)
      sessionIdRef.current = null
    }
  }

  return (
    <>
      {phase === 'setup' && (
        <SetupScreen
          onLaunch={handleLaunch}
          onBack={handleBack}
          onAutoSave={handleAutoSave}
        />
      )}
      {phase === 'sim' && config && (
        <SimScreen
          config={config}
          ideaFile={null}
          ideaText={ideaText}
          onVerdict={handleVerdict}
          onProgress={handleProgress}
          initialHistory={initialHistory}
          initialRound={initialRound}
        />
      )}
      {phase === 'verdict' && verdict && config && (
        <VerdictScreen
          verdict={verdict}
          config={config}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
