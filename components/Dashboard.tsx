'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSessions, deleteSession, type SessionRow } from '@/lib/supabase-sessions'
import ConversationModal from './ConversationModal'
import styles from './Dashboard.module.css'

interface Props {
  onStartNew: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status, isDraft }: { status: 'in_progress' | 'completed'; isDraft: boolean }) {
  if (isDraft) return <span className={`${styles.badge} ${styles.badgeDraft}`}>DRAFT</span>
  return (
    <span className={`${styles.badge} ${status === 'completed' ? styles.badgeDone : styles.badgeActive}`}>
      {status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
    </span>
  )
}

/** A session is a "draft" if it was created on the setup screen but never launched */
function isDraftSession(s: SessionRow) {
  return !s.config?.panelists?.length
}

/** Real sessions = launched (have panelists configured) */
function isRealSession(s: SessionRow) {
  return !!s.config?.panelists?.length
}

export default function Dashboard({ onStartNew }: Props) {
  const router = useRouter()
  const [sessions, setSessions]   = useState<SessionRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [historySession, setHistorySession] = useState<SessionRow | null>(null)

  useEffect(() => {
    loadSessions()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '')
    })

    // Re-fetch sessions whenever the user returns to this tab/page
    // (covers Next.js client-side navigation back, tab switching, etc.)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadSessions()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const rows = await getSessions()
      // Silently remove stale drafts (no panelists, no history, older than 1 hour)
      const stale = rows.filter(r => isDraftSession(r) && !r.history?.length &&
        Date.now() - new Date(r.updated_at).getTime() > 60 * 60 * 1000)
      await Promise.all(stale.map(r => deleteSession(r.id).catch(() => {})))
      setSessions(rows.filter(r => !stale.find(s => s.id === r.id)))
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

  // Only real (launched) sessions count toward the 3-session limit
  const realSessions = sessions.filter(isRealSession)
  const canStartNew  = realSessions.length < 3

  return (
    <div className={styles.wrap}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.wordmark}>
          <img src="/logo.png" alt="Outbindr" className={styles.wordmarkLogo} />
          OUTBINDR
        </div>
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
              {realSessions.length}/3 sessions used
              {realSessions.length >= 3 && ' — delete a session to start a new one'}
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
        ) : realSessions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No sessions yet</div>
            <div className={styles.emptyHint}>Start your first panel simulation</div>
            <button className={styles.emptyBtn} onClick={onStartNew}>Launch First Session →</button>
          </div>
        ) : (
          <div className={styles.sessionList}>
            {realSessions.map((s, i) => {
              const draft   = isDraftSession(s)
              const panelists = s.config?.panelists ?? []
              return (
                <div
                  key={s.id}
                  className={`${styles.sessionCard} ${deleting === s.id ? styles.sessionDeleting : ''}`}
                  onClick={() => handleOpen(s)}
                >
                  <div className={styles.sessionNum}>{String(i + 1).padStart(2, '0')}</div>
                  <div className={styles.sessionMain}>
                    <div className={styles.sessionTop}>
                      <div className={styles.sessionTitle}>{s.title ?? 'Untitled Pitch'}</div>
                      <StatusBadge status={s.status} isDraft={draft} />
                    </div>
                    {s.config?.sessionDescription && (
                      <div className={styles.sessionDesc}>{s.config.sessionDescription}</div>
                    )}
                    <div className={styles.sessionMeta}>
                      {panelists.length > 0 && <span>{panelists.length} panelists</span>}
                      {panelists.length > 0 && s.config?.rounds && <><span>·</span><span>{s.config.rounds} rounds</span></>}
                      <span>{panelists.length > 0 ? '·' : ''}</span>
                      <span>{formatDate(s.updated_at)}</span>
                      {s.status === 'completed' && s.verdict && (
                        <>
                          <span>·</span>
                          <span className={styles.sessionScore}>{Number(s.verdict.totalScore).toFixed(2)}/100</span>
                        </>
                      )}
                    </div>
                    {panelists.length > 0 && (
                      <div className={styles.sessionPanelists}>
                        {panelists.slice(0, 4).map((p, pi) => (
                          <span
                            key={pi}
                            className={styles.pAvatar}
                            style={{ background: p.bg, borderColor: p.bd, color: p.color }}
                            title={p.name}
                          >
                            {p.avatar}
                          </span>
                        ))}
                        {panelists.length > 4 && (
                          <span className={styles.pMore}>+{panelists.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={styles.sessionActions}>
                    <button className={styles.openBtn} onClick={() => handleOpen(s)}>
                      {s.status === 'completed' ? 'VIEW REPORT' : 'CONTINUE'} →
                    </button>
                    <button
                      className={styles.historyBtn}
                      onClick={e => { e.stopPropagation(); setHistorySession(s) }}
                      title="View conversation history"
                    >
                      HISTORY
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
              )
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 3 - realSessions.length) }, (_, i) => (
              <div key={`empty-${i}`} className={styles.emptySlot}>
                <span className={styles.emptySlotNum}>
                  {String(realSessions.length + i + 1).padStart(2, '0')}
                </span>
                <span className={styles.emptySlotText}>OPEN SLOT</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {historySession && (
        <ConversationModal
          session={historySession}
          onClose={() => setHistorySession(null)}
        />
      )}
    </div>
  )
}
