'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import VerdictScreen from '@/components/VerdictScreen'
import type { SessionRow } from '@/lib/supabase-sessions'
import type { Message } from '@/lib/types'

export default function ReplayPage() {
  const params = useParams()
  const id = params.id as string
  const [session, setSession] = useState<SessionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .eq('is_public', true)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Session not found or not public.')
        } else {
          setSession(data as SessionRow)
        }
        setLoading(false)
      })
  }, [id])

  if (loading) return <div style={{ fontFamily: "'IBM Plex Mono', monospace", padding: 40, color: '#888' }}>Loading…</div>
  if (error || !session?.verdict) return <div style={{ fontFamily: "'IBM Plex Mono', monospace", padding: 40 }}>{error || 'No report available.'}</div>

  return (
    <div>
      {/* Conversation history */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 0', fontFamily: "'IBM Plex Mono', monospace" }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#aaa', textTransform: 'uppercase', marginBottom: 16 }}>Conversation History</div>
        {(session.history ?? [])
          .filter((m: Message) => !m.content.startsWith('[Internal deliberation by'))
          .map((m: Message, i: number) => (
            <div key={i} style={{
              padding: '12px 0', borderBottom: '1px solid #f0f0f0',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 10, color: '#bbb', minWidth: 48, paddingTop: 2 }}>R{(m.round ?? 0) + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: m.role === 'user' ? '#000' : '#555', marginBottom: 4 }}>
                  {m.speaker ?? (m.role === 'user' ? 'You' : 'Panelist')}
                </div>
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>{m.content}</div>
              </div>
            </div>
          ))}
      </div>
      <VerdictScreen
        verdict={session.verdict}
        config={session.config}
        onRestart={() => window.location.href = '/'}
        backLabel="← Home"
      />
    </div>
  )
}
