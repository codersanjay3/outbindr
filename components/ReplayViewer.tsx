'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { SessionRow } from '@/lib/supabase-sessions'
import type { Panelist } from '@/lib/types'
import VerdictScreen from './VerdictScreen'
import styles from './ReplayViewer.module.css'

interface ReplayMsg {
  idx:     number
  type:    'panelist' | 'user' | 'rf-answer'
  speaker: string
  avatar:  string
  color:   string
  bg:      string
  bd:      string
  text:    string
  round:   number
}

interface VisibleMsg extends ReplayMsg {
  displayed: string
  done:      boolean
}

function buildMsgs(history: SessionRow['history'], panelists: Panelist[]): ReplayMsg[] {
  const out: ReplayMsg[] = []
  for (const m of (history ?? [])) {
    if (m.content.startsWith('[Internal deliberation by')) continue
    if (m.role === 'assistant') {
      const p = panelists.find(x => x.name === m.speaker)
      out.push({
        idx: out.length, type: 'panelist',
        speaker: p?.name ?? m.speaker ?? 'Panel',
        avatar: p?.avatar ?? '🎙',
        color: p?.color ?? '#888',
        bg: p?.bg ?? '#f5f5f5',
        bd: p?.bd ?? '#e0e0e0',
        text: m.content, round: m.round ?? 0,
      })
    } else {
      const isRf = m.content.startsWith('[Rapid-fire answer]')
      out.push({
        idx: out.length,
        type: isRf ? 'rf-answer' : 'user',
        speaker: 'You', avatar: '💬',
        color: '#555', bg: '#f5f5f5', bd: '#e0e0e0',
        text: isRf ? m.content.replace('[Rapid-fire answer] ', '') : m.content,
        round: m.round ?? 0,
      })
    }
  }
  return out
}

export default function ReplayViewer({ session }: { session: SessionRow }) {
  const { config, history, verdict } = session
  const panelists   = config?.panelists ?? []
  const sessionTitle = config?.sessionName || config?.ideaDocName || 'Session'

  const allMsgs = useRef<ReplayMsg[]>(buildMsgs(history, panelists))

  // ── playback state ─────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState<'ready'|'playing'|'paused'|'verdict'>('ready')
  const [speed, setSpeed]           = useState<1|2>(1)
  const [soundOn, setSoundOn]       = useState(false)
  const [visible, setVisible]       = useState<VisibleMsg[]>([])
  const [curIdx, setCurIdx]         = useState(-1)

  // refs so interval callbacks always see latest values
  const phaseRef   = useRef(phase)
  const speedRef   = useRef(speed)
  const soundRef   = useRef(soundOn)
  const curIdxRef  = useRef(curIdx)
  const charRef    = useRef(0)
  const timerRef   = useRef<ReturnType<typeof setInterval>|null>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { phaseRef.current  = phase   }, [phase])
  useEffect(() => { speedRef.current  = speed   }, [speed])
  useEffect(() => { soundRef.current  = soundOn }, [soundOn])
  useEffect(() => { curIdxRef.current = curIdx  }, [curIdx])

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [visible])

  // ── advance to next message ─────────────────────────────────────────────────
  const advanceTo = useCallback((nextIdx: number) => {
    if (nextIdx >= allMsgs.current.length) {
      setPhase('verdict')
      return
    }
    setCurIdx(nextIdx)
    charRef.current = 0
    setVisible(prev => [...prev, { ...allMsgs.current[nextIdx], displayed: '', done: false }])
  }, [])

  // ── typewriter loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || curIdx < 0) return
    const msg = allMsgs.current[curIdx]
    if (!msg) return

    const spd = speedRef.current
    const charsPerTick = spd === 2 ? 5 : 2
    const tickMs = 18

    timerRef.current = setInterval(() => {
      if (phaseRef.current === 'paused') return

      charRef.current = Math.min(charRef.current + charsPerTick, msg.text.length)
      const slice = msg.text.slice(0, charRef.current)

      setVisible(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, displayed: slice } : m
      ))

      if (charRef.current >= msg.text.length) {
        clearInterval(timerRef.current!)
        // mark done
        setVisible(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, displayed: msg.text, done: true } : m
        ))
        // speak then advance
        const pause = speedRef.current === 2 ? 150 : 500
        if (soundRef.current && msg.type === 'panelist' && typeof window !== 'undefined') {
          try {
            window.speechSynthesis?.cancel()
            const p   = panelists.find(x => x.name === msg.speaker)
            const utt = new SpeechSynthesisUtterance(msg.text.slice(0, 350))
            utt.rate  = (p?.webSpeechRate ?? 1)
            utt.pitch = (p?.webSpeechPitch ?? 1)
            utt.onend = () => {
              if (phaseRef.current === 'playing') advanceTo(curIdxRef.current + 1)
            }
            window.speechSynthesis.speak(utt)
          } catch { setTimeout(() => advanceTo(curIdxRef.current + 1), pause) }
        } else {
          setTimeout(() => {
            if (phaseRef.current === 'playing') advanceTo(curIdxRef.current + 1)
          }, pause)
        }
      }
    }, tickMs)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, curIdx])

  // ── controls ───────────────────────────────────────────────────────────────
  const start = () => {
    if (allMsgs.current.length === 0) { setPhase('verdict'); return }
    setPhase('playing')
    advanceTo(0)
  }

  const pause = () => {
    setPhase('paused')
    window.speechSynthesis?.cancel()
  }

  const resume = () => setPhase('playing')

  const skipToVerdict = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    window.speechSynthesis?.cancel()
    setVisible(allMsgs.current.map(m => ({ ...m, displayed: m.text, done: true })))
    setCurIdx(allMsgs.current.length - 1)
    setPhase('verdict')
  }

  const total = allMsgs.current.length
  const pct   = total > 0 ? Math.round(((curIdx + 1) / total) * 100) : 0

  // ── verdict view ──────────────────────────────────────────────────────────
  if (phase === 'verdict' && verdict) {
    return (
      <div className={styles.verdictWrap}>
        <div className={styles.verdictTopBar}>
          <span className={styles.verdictBrand}>OUTBINDR <span className={styles.replayBadge}>REPLAY</span></span>
          <a href="/" className={styles.ctaBtn}>Try Outbindr free →</a>
        </div>
        <VerdictScreen verdict={verdict} config={config} onRestart={() => { window.location.href = '/' }} backLabel="Try Outbindr →" />
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.brand}>OUTBINDR</span>
          <span className={styles.replayBadge}>REPLAY</span>
          <span className={styles.sessionTitle}>{sessionTitle}</span>
        </div>
        <a href="/" className={styles.ctaBtn}>Try Outbindr free →</a>
      </header>

      {/* ── Panelist chips ── */}
      {panelists.length > 0 && (
        <div className={styles.chips}>
          {panelists.map((p, i) => (
            <span key={i} className={styles.chip} style={{ borderLeftColor: p.color }}>
              {p.avatar} {p.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Progress bar ── */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>

      {/* ── Controls ── */}
      <div className={styles.controls}>
        {phase === 'ready' && (
          <button className={styles.playBtn} onClick={start}>▶ Play Replay</button>
        )}
        {phase === 'playing' && (
          <button className={styles.playBtn} onClick={pause}>⏸ Pause</button>
        )}
        {phase === 'paused' && (
          <button className={styles.playBtn} onClick={resume}>▶ Resume</button>
        )}

        <button
          className={`${styles.speedBtn} ${speed === 2 ? styles.active : ''}`}
          onClick={() => setSpeed(s => s === 1 ? 2 : 1)}
        >
          {speed}×
        </button>

        <button
          className={`${styles.soundBtn} ${soundOn ? styles.active : ''}`}
          onClick={() => { setSoundOn(s => !s); window.speechSynthesis?.cancel() }}
          title={soundOn ? 'Mute' : 'Enable voice'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>

        {phase !== 'ready' && (
          <button className={styles.skipBtn} onClick={skipToVerdict}>
            Skip to verdict →
          </button>
        )}

        <span className={styles.progressLabel}>
          {phase === 'ready' ? `${total} messages` : `${Math.max(0, curIdx + 1)} / ${total}`}
        </span>
      </div>

      {/* ── Messages ── */}
      <div className={styles.messages} ref={scrollRef}>
        {phase === 'ready' && (
          <div className={styles.readyState}>
            <div className={styles.readyIcon}>▶</div>
            <div className={styles.readyTitle}>Watch the panel session replay</div>
            <div className={styles.readyMeta}>
              {panelists.length} judges · {config.rounds} rounds · {total} messages
            </div>
            <button className={styles.readyBtn} onClick={start}>Play Replay</button>
          </div>
        )}

        {visible.map((m, i) => {
          const prevRound = i > 0 ? visible[i - 1].round : -1
          const showDivider = m.round !== prevRound && (m.type === 'panelist' || m.type === 'user')
          return (
            <div key={i}>
              {showDivider && (
                <div className={styles.roundDivider}>
                  <span>Round {m.round + 1}</span>
                </div>
              )}
              <div className={`${styles.msgRow} ${m.type !== 'panelist' ? styles.msgRowUser : ''}`}>
                <span
                  className={styles.msgAvatar}
                  style={{ background: m.bg, borderColor: m.bd }}
                >
                  {m.avatar}
                </span>
                <div className={styles.msgBody}>
                  <div className={styles.msgMeta}>
                    <span className={styles.msgSpeaker} style={{ color: m.color }}>{m.speaker}</span>
                    <span className={styles.msgRound}>R{m.round + 1}</span>
                    {m.type === 'rf-answer' && <span className={styles.rfTag}>rapid-fire answer</span>}
                  </div>
                  <p className={styles.msgText}>
                    {m.displayed}
                    {!m.done && i === visible.length - 1 && (
                      <span className={styles.cursor} />
                    )}
                  </p>
                </div>
              </div>
            </div>
          )
        })}

        {phase === 'verdict' && !verdict && (
          <div className={styles.noVerdict}>Session ended before verdict was generated.</div>
        )}
      </div>
    </div>
  )
}
