'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { SimConfig, Message, Verdict, Panelist } from '@/lib/types'
import { loadKeys, apiHeaders } from '@/lib/keys'
import { speakSentence, extractCompleteSentences, cancelCurrentTTS } from '@/lib/tts'
import AgentGraph, { type GraphEdge } from './AgentGraph'
import styles from './SimScreen.module.css'

interface Props {
  config: SimConfig
  ideaFile: File | null
  ideaText: string
  onVerdict: (v: Verdict, history: Message[]) => void
  onProgress?: (history: Message[], currentRound: number) => void
  initialHistory?: Message[]
  initialRound?: number
}

type Phase =
  | 'thinking'      // deliberating + awaiting stream
  | 'speaking'      // streaming text + TTS
  | 'round-turn'    // all panelists done — show summary + user input
  | 'report'        // generating final verdict

interface HistoryMsg {
  speaker: string; avatar: string; color: string; bg: string; bd: string
  text: string; round: number; isUser?: boolean
}

interface RoundQuestion {
  name: string; avatar: string; color: string; question: string
}

export default function SimScreen({ config, ideaFile, ideaText, onVerdict, onProgress, initialHistory, initialRound }: Props) {
  const { panelists, rounds } = config

  // ── UI state ───────────────────────────────────────────────────────────────
  const [phase, setPhase]                   = useState<Phase>('thinking')
  const [activePanelist, setActivePanelist] = useState<Panelist | null>(null)
  const [streamingText, setStreamingText]   = useState('')
  const [subtitle, setSubtitle]             = useState('')
  const [historyMsgs, setHistoryMsgs]       = useState<HistoryMsg[]>([])
  const [showHistory, setShowHistory]       = useState(false)
  const [userReply, setUserReply]           = useState('')
  const [edges, setEdges]                   = useState<GraphEdge[]>([])
  const [currentRound, setCurrentRound]     = useState(initialRound ?? 0)
  const [roundQuestions, setRoundQuestions] = useState<RoundQuestion[]>([])
  const [paused, setPaused]                 = useState(false)

  // ── Stable refs ────────────────────────────────────────────────────────────
  const historyRef         = useRef<Message[]>(initialHistory ?? [])
  const ideaRef            = useRef('')
  const ideaB64Ref         = useRef('')
  const ideaMimeRef        = useRef('')
  const pausedRef          = useRef(false)
  const interruptRef       = useRef(false)
  const abortRef           = useRef<AbortController | null>(null)
  const resolveUserTurnRef = useRef<((reply: string) => void) | null>(null)
  const userReplyRef       = useRef('')

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { userReplyRef.current = userReply }, [userReply])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init() }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const waitIfPaused = () =>
    new Promise<void>(resolve => {
      const check = () => (pausedRef.current ? setTimeout(check, 200) : resolve())
      check()
    })

  const waitForUserTurn = (): Promise<string> =>
    new Promise(resolve => { resolveUserTurnRef.current = resolve })

  const handleUserSubmit = useCallback(() => {
    const reply = userReplyRef.current.trim()
    resolveUserTurnRef.current?.(reply)
    resolveUserTurnRef.current = null
    setUserReply('')
    // Save progress after user submits their reply
    if (onProgress) {
      onProgress(historyRef.current, currentRound)
    }
  }, [currentRound, onProgress])

  const handleInterrupt = useCallback(() => {
    interruptRef.current = true
    cancelCurrentTTS()
    abortRef.current?.abort()
  }, [])

  /** Light up a graph edge when one panelist mentions another */
  const detectEdges = useCallback((speakerName: string, text: string) => {
    setEdges(prev => {
      const next = [...prev]
      for (const p of panelists) {
        if (p.name === speakerName) continue
        const first = p.name.split(' ')[0]
        if (text.includes(p.name) || text.toLowerCase().includes(first.toLowerCase())) {
          const ex = next.find(e => e.from === speakerName && e.to === p.name)
          if (ex) ex.active = true
          else next.push({ from: speakerName, to: p.name, active: true })
        }
      }
      return next.map(e => (e.from === speakerName ? e : { ...e, active: false }))
    })
  }, [panelists])

  /** Pull the clearest question sentence from a panelist turn */
  const extractQuestion = (text: string): string => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    const q = [...sentences].reverse().find(s => s.includes('?'))
    return (q || sentences[sentences.length - 1])?.trim() || text.slice(0, 150)
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  const init = async () => {
    if (ideaFile) {
      if (ideaFile.type === 'application/pdf') {
        const ab = await ideaFile.arrayBuffer()
        ideaB64Ref.current  = Buffer.from(ab).toString('base64')
        ideaMimeRef.current = 'application/pdf'
      } else {
        ideaRef.current = await ideaFile.text()
      }
    } else {
      ideaRef.current = ideaText
    }
    run()
  }

  // ── Main simulation loop ───────────────────────────────────────────────────

  const run = async () => {
    const keys = loadKeys()

    for (let r = 0; r < rounds; r++) {
      setCurrentRound(r)
      const roundQs: RoundQuestion[] = []

      for (let pi = 0; pi < panelists.length; pi++) {
        await waitIfPaused()
        const p = panelists[pi]
        const isFirst = r === 0 && pi === 0

        setActivePanelist(p)
        setStreamingText('')
        setPhase('thinking')
        interruptRef.current = false

        // ── STEP 1: Internal deliberation (hidden — more tokens allowed) ────
        if (!isFirst) {
          try {
            const dr = await fetch('/api/deliberate', {
              method: 'POST',
              headers: apiHeaders(keys),
              body: JSON.stringify({
                panelist: p,
                allPanelists: panelists,
                ideaText: ideaRef.current,
                history: historyRef.current,
                round: r,
                totalRounds: rounds,
              }),
            })
            const { deliberation } = await dr.json()
            if (deliberation) {
              // Add to context so other panelists can see it — NEVER displayed to user
              historyRef.current.push({
                role: 'assistant',
                content: `[Internal deliberation by ${p.name}]: ${deliberation}`,
                speaker: p.name,
                round: r,
              })
            }
          } catch { /* silently skip — not critical */ }
        }

        // ── STEP 2: Public response — short, streamed, spoken ────────────
        abortRef.current = new AbortController()
        let res: Response

        try {
          res = await fetch('/api/simulate', {
            method: 'POST',
            headers: apiHeaders(keys),
            signal: abortRef.current.signal,
            body: JSON.stringify({
              panelist: p,
              allPanelists: panelists,
              ideaText: ideaRef.current,
              ideaBase64:   ideaB64Ref.current  || undefined,
              ideaMimeType: ideaMimeRef.current || undefined,
              history: historyRef.current,
              round: r, totalRounds: rounds, isFirst,
            }),
          })
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') continue
          throw e
        }

        const reader  = res.body!.getReader()
        const decoder = new TextDecoder()
        let fullText  = ''
        let ttsBuf    = ''

        const flushSentences = async (buf: string): Promise<string> => {
          if (interruptRef.current) return buf
          const { sentences, remainder } = extractCompleteSentences(buf)
          for (const s of sentences) {
            if (interruptRef.current) break
            setSubtitle(s)
            await speakSentence(s, p.voiceId, p.webSpeechVoice, keys.elevenlabs || null,
              p.webSpeechPitch, p.webSpeechRate)
            await waitIfPaused()
          }
          return remainder
        }

        setPhase('speaking')
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value)
            fullText += chunk
            ttsBuf   += chunk
            setStreamingText(fullText)
            detectEdges(p.name, fullText)
            if (!interruptRef.current) ttsBuf = await flushSentences(ttsBuf)
          }
        } catch (e) {
          if (!(e instanceof Error && e.name === 'AbortError')) throw e
        }

        if (!interruptRef.current && ttsBuf.trim()) {
          setSubtitle(ttsBuf.trim())
          await speakSentence(ttsBuf.trim(), p.voiceId, p.webSpeechVoice, keys.elevenlabs || null,
            p.webSpeechPitch, p.webSpeechRate)
        }
        setSubtitle('')

        if (fullText) {
          historyRef.current.push({ role: 'assistant', content: fullText, speaker: p.name, round: r })
          setHistoryMsgs(prev => [...prev, {
            speaker: p.name, avatar: p.avatar, color: p.color,
            bg: p.bg, bd: p.bd, text: fullText, round: r,
          }])
          roundQs.push({ name: p.name, avatar: p.avatar, color: p.color, question: extractQuestion(fullText) })
        }

        // Brief pause between panelists
        await new Promise(r => setTimeout(r, 400))
      }

      // ── END OF ROUND: combined summary + user turn ───────────────────────
      setActivePanelist(null)
      setStreamingText('')
      setRoundQuestions(roundQs)
      setPhase('round-turn')

      const reply = await waitForUserTurn()
      if (reply) {
        historyRef.current.push({ role: 'user', content: reply, speaker: 'You', round: r })
        setHistoryMsgs(prev => [...prev, {
          speaker: 'You', avatar: '💬', color: '#ffffff',
          bg: 'rgba(255,255,255,0.04)', bd: 'rgba(255,255,255,0.1)',
          text: reply, round: r, isUser: true,
        }])
      }
      setRoundQuestions([])
    }

    // ── Generate final evaluation report ──────────────────────────────────
    setActivePanelist(null)
    setStreamingText('')
    setPhase('report')

    const keys2 = loadKeys()
    const vRes = await fetch('/api/verdict', {
      method: 'POST',
      headers: apiHeaders(keys2),
      body: JSON.stringify({ panelists, history: historyRef.current }),
    })
    const verdict = await vRes.json()
    onVerdict(verdict, historyRef.current)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isSpeaking  = phase === 'speaking'
  const isThinking  = phase === 'thinking'
  const isRoundTurn = phase === 'round-turn'
  const isReport    = phase === 'report'

  return (
    <div className={styles.wrap}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>Panel Session</div>
          <div className={styles.headerSub}>{config.ideaDocName}</div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.roundPips}>
            {Array.from({ length: rounds }, (_, i) => (
              <div key={i} className={`${styles.pip}
                ${i < currentRound ? styles.pipDone : i === currentRound ? styles.pipActive : ''}`} />
            ))}
          </div>
          <span className={styles.roundLabel}>Round {currentRound + 1} / {rounds}</span>
        </div>

        <div className={styles.headerRight}>
          <button
            className={styles.pauseBtn}
            onClick={() => setPaused(p => !p)}
            disabled={isReport}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <AgentGraph
            panelists={panelists}
            activePanelist={activePanelist?.name ?? null}
            edges={edges}
          />
        </div>
      </header>

      {/* ── History drawer ── */}
      <div className={styles.historyBar}>
        <button
          className={styles.historyToggle}
          onClick={() => setShowHistory(h => !h)}
          disabled={historyMsgs.length === 0}
        >
          {showHistory ? '▴' : '▾'} Conversation history
          {historyMsgs.length > 0 && ` (${historyMsgs.length})`}
        </button>
      </div>

      {showHistory && (
        <div className={styles.historyList}>
          {historyMsgs.map((m, i) => (
            <div key={i} className={`${styles.histItem} ${m.isUser ? styles.histUser : ''}`}>
              <span className={styles.histAvatar} style={{ background: m.bg, borderColor: m.bd }}>
                {m.avatar}
              </span>
              <div className={styles.histBody}>
                <div className={styles.histMeta}>
                  <span className={styles.histName} style={{ color: m.color }}>{m.speaker}</span>
                  <span className={styles.histRound}>R{m.round + 1}</span>
                </div>
                <p className={styles.histText}>{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stage ── */}
      <div className={styles.stage}>

        {/* Generating report */}
        {isReport && (
          <div className={styles.reportCard}>
            <span className={styles.spinner} />
            <span>Generating performance report…</span>
          </div>
        )}

        {/* Round turn — summary of questions + user response input */}
        {isRoundTurn && (
          <div className={styles.roundTurnCard}>
            <div className={styles.roundTurnTitle}>
              Round {currentRound + 1} — Address the panel
            </div>

            {roundQuestions.length > 0 && (
              <div className={styles.questionsList}>
                {roundQuestions.map((q, i) => (
                  <div key={i} className={styles.questionItem}>
                    <span className={styles.questionAvatar}>{q.avatar}</span>
                    <div>
                      <div className={styles.questionName} style={{ color: q.color }}>{q.name}</div>
                      <div className={styles.questionText}>"{q.question}"</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.userTurnSection}>
              <div className={styles.userTurnLabel}>
                Your response — answer their questions, raise new points, push back
              </div>
              <textarea
                className={styles.userTextarea}
                value={userReply}
                onChange={e => setUserReply(e.target.value)}
                placeholder="Type your response here, or press Enter + Shift to submit (Enter alone to add lines)…"
                rows={4}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.shiftKey)) {
                    e.preventDefault()
                    handleUserSubmit()
                  }
                }}
              />
              <div className={styles.userTurnActions}>
                <span className={styles.userTurnHint}>⌘↵ or Shift↵ to submit</span>
                <div className={styles.userTurnBtns}>
                  <button
                    className={styles.skipBtn}
                    onClick={() => { setUserReply(''); handleUserSubmit() }}
                  >
                    Skip round →
                  </button>
                  <button className={styles.sendBtn} onClick={handleUserSubmit}>
                    Submit response →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active speaker spotlight */}
        {!isRoundTurn && !isReport && activePanelist && (
          <div
            className={`${styles.speakerCard} ${isSpeaking ? styles.speakerCardActive : ''}`}
            style={{
              '--pc': activePanelist.color,
              '--pbg': activePanelist.bg,
              '--pbd': activePanelist.bd,
            } as React.CSSProperties}
          >
            {/* Header */}
            <div className={styles.speakerHeader}>
              <div className={styles.speakerAvatarWrap}>
                <div
                  className={styles.speakerAvatar}
                  style={{ background: activePanelist.bg, borderColor: activePanelist.color }}
                >
                  {activePanelist.avatar}
                </div>
                {isSpeaking && <div className={styles.speakingRing} />}
              </div>

              <div className={styles.speakerInfo}>
                <div className={styles.speakerName} style={{ color: activePanelist.color }}>
                  {activePanelist.name}
                </div>
                <div className={styles.speakerRole}>{activePanelist.role}</div>
              </div>

              <div className={styles.speakerBadge}>
                {isThinking && <span className={styles.badgeThinking}>● thinking</span>}
                {isSpeaking && <span className={styles.badgeSpeaking}>● speaking</span>}
              </div>
            </div>

            {/* Content */}
            <div className={styles.speakerText}>
              {isThinking ? (
                <div className={styles.dots}>
                  <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
                </div>
              ) : (
                <>
                  {streamingText || '…'}
                  {isSpeaking && <span className={styles.cursor} />}
                </>
              )}
            </div>

            {isSpeaking && (
              <button className={styles.interruptBtn} onClick={handleInterrupt}>
                ⚡ Interrupt
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Subtitle bar ── */}
      {subtitle && isSpeaking && (
        <div className={styles.subtitleBar}>
          <span className={styles.subtitleIcon}>🎙</span>
          <span className={styles.subtitleText}>{subtitle}</span>
        </div>
      )}
    </div>
  )
}
