'use client'
import { useEffect, useRef } from 'react'
import { type SessionRow } from '@/lib/supabase-sessions'
import { type Message } from '@/lib/types'
import styles from './ConversationModal.module.css'

interface Props {
  session: SessionRow
  onClose: () => void
}

export default function ConversationModal({ session, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose()
  }

  const panelists = session.config?.panelists ?? []
  const panelistMap = Object.fromEntries(panelists.map(p => [p.name, p]))

  const messages: Message[] = (session.history ?? []).filter(
    (m: Message) => !m.content?.startsWith('[Internal deliberation by')
  )

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Conversation History"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerLabel}>SESSION HISTORY</div>
            <div className={styles.headerTitle}>{session.title ?? 'Untitled Pitch'}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Message list */}
        <div className={styles.messageList}>
          {messages.length === 0 ? (
            <div className={styles.empty}>No conversation messages yet.</div>
          ) : (
            messages.map((m: Message, i: number) => {
              const isUser = m.role === 'user'
              const isRfQuestion = !isUser && m.content?.startsWith('[Rapid-fire question]')
              const isRfAnswer   = isUser  && m.content?.startsWith('[Rapid-fire answer]')
              const panelist = m.speaker ? panelistMap[m.speaker] : undefined
              const roundLabel = m.round != null ? `R${m.round}` : null

              const displayContent = isRfQuestion
                ? m.content.replace(/^\[Rapid-fire question\]\s*/, '')
                : isRfAnswer
                  ? m.content.replace(/^\[Rapid-fire answer\]\s*/, '')
                  : m.content

              return (
                <div
                  key={i}
                  className={`${styles.messageRow} ${isUser ? styles.userRow : styles.panelistRow}`}
                >
                  {!isUser && (
                    <div className={styles.avatarCol}>
                      {panelist ? (
                        <span
                          className={styles.avatar}
                          style={{ background: panelist.bg, borderColor: panelist.bd, color: panelist.color }}
                          title={panelist.name}
                        >
                          {panelist.avatar}
                        </span>
                      ) : (
                        <span className={styles.avatarFallback}>
                          {m.speaker ? m.speaker.slice(0, 2).toUpperCase() : 'AI'}
                        </span>
                      )}
                    </div>
                  )}

                  <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.panelistBubble}`}>
                    <div className={styles.bubbleMeta}>
                      <span className={styles.speakerName}>
                        {isUser ? 'You' : (m.speaker ?? 'Panelist')}
                      </span>
                      {(isRfQuestion || isRfAnswer) && (
                        <span className={styles.rfTag}>RAPID-FIRE</span>
                      )}
                      {roundLabel && <span className={styles.roundTag}>{roundLabel}</span>}
                    </div>
                    <div className={styles.bubbleContent}>{displayContent}</div>
                  </div>

                  {isUser && <div className={styles.avatarCol} />}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
