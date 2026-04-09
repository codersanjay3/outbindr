'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import VerdictScreen from '@/components/VerdictScreen'
import type { SessionRow } from '@/lib/supabase-sessions'
import type { Message } from '@/lib/types'

function stripPrefix(content: string): string {
  return content
    .replace(/^\[Rapid-fire question\]\s*/, '')
    .replace(/^\[Rapid-fire answer\]\s*/, '')
    .replace(/^\[Interrupts [^\]]+\]:\s*/, '')
}

function isRapidFire(m: Message): boolean {
  return m.content?.startsWith('[Rapid-fire question]') || m.content?.startsWith('[Rapid-fire answer]')
}

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

  const sessionTitle = session.config?.sessionName || session.config?.ideaDocName || session.title || 'Untitled Pitch'
  const ownerName    = session.config?.ownerName ?? ''

  const messages = (session.history ?? []).filter(
    (m: Message) => !m.content?.startsWith('[Internal deliberation by')
  )

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: '#fff', minHeight: '100vh' }}>

      {/* ── Replay branding banner ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, padding: '32px 24px 16px', borderBottom: '1px solid #f0f0f0',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', color: '#aaa', textTransform: 'uppercase' }}>
          OUTBINDR SIMULATION
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#000', letterSpacing: '0.04em' }}>
          {sessionTitle}
        </div>
        {ownerName && (
          <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.1em' }}>
            {ownerName}&apos;s Session
          </div>
        )}
      </div>

      {/* ── Conversation history ── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 0' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#aaa', textTransform: 'uppercase', marginBottom: 16 }}>
          Conversation History
        </div>
        {messages.map((m: Message, i: number) => {
          const rf = isRapidFire(m)
          const isUser = m.role === 'user'
          return (
            <div key={i} style={{
              padding: '12px 0', borderBottom: '1px solid #f0f0f0',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 10, color: '#bbb', minWidth: 48, paddingTop: 2 }}>
                R{(m.round ?? 0) + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isUser ? '#000' : '#555' }}>
                    {m.speaker ?? (isUser ? 'You' : 'Panelist')}
                  </span>
                  {rf && (
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                      color: '#7c3aed', background: '#f3e8ff', border: '1px solid #ddd6fe',
                      padding: '1px 5px',
                    }}>
                      RAPID-FIRE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>
                  {stripPrefix(m.content)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <VerdictScreen
        verdict={session.verdict}
        config={session.config}
        onRestart={() => { window.location.href = '/' }}
        backLabel="← Home"
      />
    </div>
  )
}
