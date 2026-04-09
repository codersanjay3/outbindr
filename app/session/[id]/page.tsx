'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSessionById, type SessionRow } from '@/lib/supabase-sessions'
import { loadSimSnapshot, clearSimSnapshot } from '@/lib/sim-persist'
import type { Message } from '@/lib/types'
import PitchWars from '@/components/PitchWars'
import VerdictScreen from '@/components/VerdictScreen'

export default function SessionPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = params.id as string
  const [session, setSession]         = useState<SessionRow | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  // localStorage may have a more recent snapshot than Supabase (saved on page close)
  const [localHistory, setLocalHistory]   = useState<Message[] | undefined>(undefined)
  const [localRound, setLocalRound]       = useState<number | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/')
        return
      }
      loadSession()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadSession = async () => {
    try {
      const found = await getSessionById(id)
      if (!found) {
        setError('Session not found.')
      } else {
        setSession(found)

        // Check if localStorage has a more recent snapshot than Supabase
        // (this happens when the user closed the tab mid-simulation)
        const snap = loadSimSnapshot(id)
        if (snap && snap.savedAt > new Date(found.updated_at).getTime()) {
          setLocalHistory(snap.history)
          setLocalRound(snap.round)
          // Don't clear the snapshot yet — keep it as backup in case the user
          // navigates away again before the sim's 2s auto-save fires.
          // SimScreen will overwrite it on its next save cycle.
        }
      }
    } catch {
      setError('Failed to load session.')
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => router.push('/')

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#888',
        background: '#fff',
      }}>
        Loading session…
      </div>
    )
  }

  if (error || !session) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: "'IBM Plex Mono', monospace", background: '#fff',
      }}>
        <div style={{ fontSize: 13, color: '#000' }}>{error || 'Session not found.'}</div>
        <button
          onClick={goBack}
          style={{
            background: '#000', color: '#fff', border: 'none', padding: '10px 24px',
            fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', letterSpacing: '0.14em',
          }}
        >
          ← Dashboard
        </button>
      </div>
    )
  }

  // Completed — show the verdict report
  if (session.status === 'completed' && session.verdict) {
    return (
      <VerdictScreen
        verdict={session.verdict}
        config={session.config}
        onRestart={goBack}
        backLabel="← Dashboard"
      />
    )
  }

  // Draft (never launched) — redirect to dashboard
  if (!session.config?.panelists?.length) {
    router.push('/')
    return null
  }

  // In progress — resume simulation
  // Prefer localStorage snapshot if it's more recent than the Supabase save
  const resumeHistory = localHistory ?? session.history
  const resumeRound   = localRound   ?? session.current_round

  return (
    <PitchWars
      initialSessionId={session.id}
      initialConfig={session.config}
      initialHistory={resumeHistory}
      initialIdeaText={session.idea_text}
      initialRound={resumeRound}
      onBackToDashboard={goBack}
    />
  )
}
