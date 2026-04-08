'use client'
import { useEffect, useState } from 'react'
import { getPublicSession } from '@/lib/supabase-sessions'
import type { SessionRow } from '@/lib/supabase-sessions'
import ReplayViewer from '@/components/ReplayViewer'

export default function WatchPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<SessionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getPublicSession(params.id)
      .then(row => {
        if (!row) {
          setNotFound(true)
        } else {
          setSession(row)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '13px', color: '#888', background: '#fff',
      }}>
        Loading session…
      </div>
    )
  }

  if (notFound || !session) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: "'IBM Plex Mono', monospace",
        background: '#fff', gap: '16px',
      }}>
        <div style={{ fontSize: '13px', color: '#888' }}>Session not found or not public.</div>
        <a href="/" style={{
          fontSize: '11px', color: '#000', textDecoration: 'none',
          borderBottom: '1px solid #000', paddingBottom: '2px',
        }}>← Back to Outbindr</a>
      </div>
    )
  }

  return <ReplayViewer session={session} />
}
