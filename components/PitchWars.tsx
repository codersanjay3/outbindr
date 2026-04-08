'use client'
import { useState } from 'react'
import SetupScreen from './SetupScreen'
import SimScreen from './SimScreen'
import VerdictScreen from './VerdictScreen'
import type { SimConfig, Verdict } from '@/lib/types'

type Phase = 'setup' | 'sim' | 'verdict'

export default function PitchWars() {
  const [phase, setPhase]       = useState<Phase>('setup')
  const [config, setConfig]     = useState<SimConfig | null>(null)
  const [ideaFile, setIdeaFile] = useState<File | null>(null)
  const [ideaText, setIdeaText] = useState('')
  const [verdict, setVerdict]   = useState<Verdict | null>(null)

  const handleLaunch = (cfg: SimConfig, idea: File | null, text?: string) => {
    setConfig(cfg)
    setIdeaFile(idea)
    setIdeaText(text ?? '')
    setPhase('sim')
  }

  const handleVerdict = (v: Verdict) => { setVerdict(v); setPhase('verdict') }

  const handleRestart = () => {
    setPhase('setup')
    setConfig(null)
    setIdeaFile(null)
    setIdeaText('')
    setVerdict(null)
  }

  return (
    <>
      {phase === 'setup' && <SetupScreen onLaunch={handleLaunch} />}
      {phase === 'sim' && config && (
        <SimScreen
          config={config}
          ideaFile={ideaFile}
          ideaText={ideaText}
          onVerdict={handleVerdict}
        />
      )}
      {phase === 'verdict' && verdict && config && (
        <VerdictScreen verdict={verdict} config={config} onRestart={handleRestart} />
      )}
    </>
  )
}
