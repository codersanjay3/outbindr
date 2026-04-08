'use client'
import { useEffect, useRef, useState } from 'react'
import SetupScreen from './SetupScreen'
import SimScreen from './SimScreen'
import VerdictScreen from './VerdictScreen'
import { createSession, saveProgress, completeSession } from '@/lib/supabase-sessions'
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
  const [ideaFile, setIdeaFile] = useState<File | null>(null)
  const [ideaText, setIdeaText] = useState(initialIdeaText ?? '')
  const [verdict, setVerdict]   = useState<Verdict | null>(null)
  const sessionIdRef            = useRef<string | null>(initialSessionId ?? null)

  const handleLaunch = async (cfg: SimConfig, idea: File | null, text?: string) => {
    setConfig(cfg)
    setIdeaFile(idea)
    setIdeaText(text ?? '')

    // Create Supabase session row
    try {
      const row = await createSession(cfg, text ?? '')
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

  const handleRestart = () => {
    if (onBackToDashboard) {
      onBackToDashboard()
    } else {
      setPhase('setup')
      setConfig(null)
      setIdeaFile(null)
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
          onBack={onBackToDashboard}
        />
      )}
      {phase === 'sim' && config && (
        <SimScreen
          config={config}
          ideaFile={ideaFile}
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
