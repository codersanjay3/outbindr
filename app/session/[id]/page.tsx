'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSessions, type SessionRow } from '@/lib/supabase-sessions'
import PitchWars from '@/components/PitchWars'
import VerdictScreen from '@/components/VerdictScreen'

export default function SessionPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = params.id as string
  const [session, setSession] = useState<SessionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    // Verify auth
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/')
        return
      }
      loadSession()
    })
  }, [id])

  const loadSession = async () => {
    try {
      const rows = await getSessions()
      const found = rows.find(r => r.id === id)
      if (!found) {
        setError('Session not found.')
      } else {
        setSession(found)
      }
    } catch (e) {
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

  // In progress — resume simulation
  return (
    <PitchWars
      initialSessionId={session.id}
      initialConfig={session.config}
      initialHistory={session.history}
      initialIdeaText={session.idea_text}
      initialRound={session.current_round}
      onBackToDashboard={goBack}
    />
  )
}
