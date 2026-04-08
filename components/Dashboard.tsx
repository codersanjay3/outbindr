'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSessions, createSession, deleteSession, type SessionRow } from '@/lib/supabase-sessions'
import type { SimConfig } from '@/lib/types'
import styles from './Dashboard.module.css'

interface Props {
  onStartNew: () => void // navigate back to setup
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: 'in_progress' | 'completed' }) {
  return (
    <span className={`${styles.badge} ${status === 'completed' ? styles.badgeDone : styles.badgeActive}`}>
      {status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
    </span>
  )
}

export default function Dashboard({ onStartNew }: Props) {
  const router = useRouter()
  const [sessions, setSessions]   = useState<SessionRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [deleting, setDeleting]   = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '')
    })
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const rows = await getSessions()
      setSessions(rows)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = (session: SessionRow) => {
    router.push(`/session/${session.id}`)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this session?')) return
    setDeleting(id)
    try {
      await deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const canStartNew = sessions.length < 3

  return (
    <div className={styles.wrap}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.wordmark}>OUTBINDR</div>
        <div className={styles.topRight}>
          <span className={styles.userEmail}>{userEmail}</span>
          <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      <div className={styles.inner}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Your Sessions</h1>
            <p className={styles.pageHint}>
              {sessions.length}/3 sessions used
              {sessions.length >= 3 && ' — delete a session to start a new one'}
            </p>
          </div>
          <button
            className={styles.newBtn}
            onClick={onStartNew}
            disabled={!canStartNew}
          >
            + NEW SESSION
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <span className={styles.loadingDot} /><span className={styles.loadingDot} /><span className={styles.loadingDot} />
          </div>
        ) : sessions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No sessions yet</div>
            <div className={styles.emptyHint}>Start your first panel simulation</div>
            <button className={styles.emptyBtn} onClick={onStartNew}>Launch First Session →</button>
          </div>
        ) : (
          <div className={styles.sessionList}>
            {sessions.map((s, i) => (
              <div
                key={s.id}
                className={`${styles.sessionCard} ${deleting === s.id ? styles.sessionDeleting : ''}`}
                onClick={() => handleOpen(s)}
              >
                <div className={styles.sessionNum}>{String(i + 1).padStart(2, '0')}</div>
                <div className={styles.sessionMain}>
                  <div className={styles.sessionTop}>
                    <div className={styles.sessionTitle}>{s.title ?? 'Untitled Pitch'}</div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className={styles.sessionMeta}>
                    <span>{s.config.panelists.length} panelists</span>
                    <span>·</span>
                    <span>{s.config.rounds} rounds</span>
                    <span>·</span>
                    <span>{formatDate(s.updated_at)}</span>
                    {s.status === 'completed' && s.verdict && (
                      <>
                        <span>·</span>
                        <span className={styles.sessionScore}>{s.verdict.totalScore}/100</span>
                      </>
                    )}
                  </div>
                  <div className={styles.sessionPanelists}>
                    {s.config.panelists.slice(0, 4).map((p, pi) => (
                      <span
                        key={pi}
                        className={styles.pAvatar}
                        style={{ background: p.bg, borderColor: p.bd, color: p.color }}
                        title={p.name}
                      >
                        {p.avatar}
                      </span>
                    ))}
                    {s.config.panelists.length > 4 && (
                      <span className={styles.pMore}>+{s.config.panelists.length - 4}</span>
                    )}
                  </div>
                </div>
                <div className={styles.sessionActions}>
                  <button
                    className={styles.openBtn}
                    onClick={() => handleOpen(s)}
                  >
                    {s.status === 'completed' ? 'VIEW REPORT' : 'CONTINUE'} →
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={e => handleDelete(s.id, e)}
                    disabled={deleting === s.id}
                    title="Delete session"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 3 - sessions.length) }, (_, i) => (
              <div key={`empty-${i}`} className={styles.emptySlot}>
                <span className={styles.emptySlotNum}>
                  {String(sessions.length + i + 1).padStart(2, '0')}
                </span>
                <span className={styles.emptySlotText}>OPEN SLOT</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
