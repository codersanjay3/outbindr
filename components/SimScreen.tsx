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
  onVerdict: (v: Verdict) => void
}

type Phase =
  | 'thinking'    // LLM call in progress, dots showing
  | 'speaking'    // Streaming + TTS playing, interrupt available
  | 'user-turn'   // Investor done, waiting for user reply/skip
  | 'round-summary' // End of round — quick question recap
  | 'report'      // All rounds done, generating verdict

interface HistoryMsg {
  speaker: string
  avatar: string
  color: string
  bg: string
  bd: string
  text: string
  round: number
  isUser?: boolean
}

interface RoundSummaryItem {
  name: string
  avatar: string
  color: string
  question: string
}

export default function SimScreen({ config, ideaFile, ideaText, onVerdict }: Props) {
  const { panelists, rounds } = config

  const [phase, setPhase]                   = useState<Phase>('thinking')
  const [activePanelist, setActivePanelist] = useState<Panelist | null>(null)
  const [streamingText, setStreamingText]   = useState('')
  const [subtitle, setSubtitle]             = useState('')
  const [historyMsgs, setHistoryMsgs]       = useState<HistoryMsg[]>([])
  const [showHistory, setShowHistory]       = useState(false)
  const [userReply, setUserReply]           = useState('')
  const [edges, setEdges]                   = useState<GraphEdge[]>([])
  const [currentRound, setCurrentRound]     = useState(0)
  const [roundSummary, setRoundSummary]     = useState<RoundSummaryItem[] | null>(null)
  const [paused, setPaused]                 = useState(false)

  // Stable refs — won't cause re-renders
  const historyRef          = useRef<Message[]>([])
  const ideaRef             = useRef('')
  const ideaB64Ref          = useRef('')
  const ideaMimeRef         = useRef('')
  const pausedRef           = useRef(false)
  const interruptRef        = useRef(false)
  const abortControllerRef  = useRef<AbortController | null>(null)
  const resolveUserTurnRef  = useRef<((reply: string) => void) | null>(null)
  const resolveRoundRef     = useRef<(() => void) | null>(null)
  const userReplyRef        = useRef('')

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { userReplyRef.current = userReply }, [userReply])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAndRun() }, [])

  // ─── helpers ──────────────────────────────────────────────────────────────

  const waitIfPaused = () =>
    new Promise<void>(resolve => {
      const check = () => (pausedRef.current ? setTimeout(check, 200) : resolve())
      check()
    })

  const waitForUserTurn = (): Promise<string> =>
    new Promise(resolve => { resolveUserTurnRef.current = resolve })

  const waitForRoundAdvance = (): Promise<void> =>
    new Promise(resolve => { resolveRoundRef.current = resolve })

  const handleUserSubmit = useCallback(() => {
    const reply = userReplyRef.current.trim()
    resolveUserTurnRef.current?.(reply)
    resolveUserTurnRef.current = null
    setUserReply('')
  }, [])

  const handleInterrupt = useCallback(() => {
    interruptRef.current = true
    cancelCurrentTTS()
    abortControllerRef.current?.abort()
  }, [])

  /** Detect when a panelist mentions another by name — updates graph edges */
  const detectEdges = useCallback((speakerName: string, text: string) => {
    setEdges(prev => {
      const next = [...prev]
      for (const p of panelists) {
        if (p.name === speakerName) continue
        const firstName = p.name.split(' ')[0]
        if (
          text.includes(p.name) ||
          text.toLowerCase().includes(firstName.toLowerCase())
        ) {
          const existing = next.find(e => e.from === speakerName && e.to === p.name)
          if (existing) existing.active = true
          else next.push({ from: speakerName, to: p.name, active: true })
        }
      }
      // Dim all other edges after new ones light up
      return next.map(e => (e.from === speakerName ? e : { ...e, active: false }))
    })
  }, [panelists])

  /** Pull the last question sentence out of a panelist's response */
  const extractQuestion = (text: string): string => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    const q = [...sentences].reverse().find(s => s.includes('?'))
    return (q || sentences[sentences.length - 1])?.trim() || text.slice(0, 120)
  }

  // ─── init ─────────────────────────────────────────────────────────────────

  const loadAndRun = async () => {
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
    runSimulation()
  }

  // ─── main orchestration loop ───────────────────────────────────────────────

  const runSimulation = async () => {
    const keys = loadKeys()

    for (let r = 0; r < rounds; r++) {
      setCurrentRound(r)
      const roundMsgs: { name: string; avatar: string; color: string; text: string }[] = []

      for (let pi = 0; pi < panelists.length; pi++) {
        await waitIfPaused()
        const p = panelists[pi]
        const isFirst = r === 0 && pi === 0

        setActivePanelist(p)
        setStreamingText('')
        setPhase('thinking')
        interruptRef.current = false

        // ── fetch stream ───────────────────────────────────────────────────
        abortControllerRef.current = new AbortController()
        let res: Response

        try {
          res = await fetch('/api/simulate', {
            method: 'POST',
            headers: apiHeaders(keys),
            signal: abortControllerRef.current.signal,
            body: JSON.stringify({
              panelist: p,
              allPanelists: panelists,
              ideaText: ideaRef.current,
              ideaBase64:   ideaB64Ref.current  || undefined,
              ideaMimeType: ideaMimeRef.current || undefined,
              history: historyRef.current,
              round: r,
              totalRounds: rounds,
              isFirst,
            }),
          })
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            // Interrupted before stream even started
            setPhase('user-turn')
            const reply = await waitForUserTurn()
            if (reply) pushUserReply(reply, r)
            continue
          }
          throw e
        }

        // ── stream + TTS pipeline ─────────────────────────────────────────
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
            await speakSentence(
              s,
              p.voiceId,
              p.webSpeechVoice,
              keys.elevenlabs || null,
              p.webSpeechPitch,
              p.webSpeechRate
            )
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

        // Flush any leftover TTS buffer (unless interrupted)
        if (!interruptRef.current && ttsBuf.trim()) {
          setSubtitle(ttsBuf.trim())
          await speakSentence(
            ttsBuf.trim(),
            p.voiceId,
            p.webSpeechVoice,
            keys.elevenlabs || null,
            p.webSpeechPitch,
            p.webSpeechRate
          )
        }

        setSubtitle('')

        // ── save to history ───────────────────────────────────────────────
        if (fullText) {
          historyRef.current.push({
            role: 'assistant',
            content: fullText,
            speaker: p.name,
            round: r,
          })
          setHistoryMsgs(prev => [...prev, {
            speaker: p.name, avatar: p.avatar, color: p.color,
            bg: p.bg, bd: p.bd, text: fullText, round: r,
          }])
          roundMsgs.push({ name: p.name, avatar: p.avatar, color: p.color, text: fullText })
        }

        // ── user turn ─────────────────────────────────────────────────────
        setPhase('user-turn')
        const reply = await waitForUserTurn()
        if (reply) pushUserReply(reply, r)
      }

      // ── round summary ──────────────────────────────────────────────────
      const summaryItems: RoundSummaryItem[] = roundMsgs.map(m => ({
        name: m.name,
        avatar: m.avatar,
        color: m.color,
        question: extractQuestion(m.text),
      }))

      setActivePanelist(null)
      setStreamingText('')
      setRoundSummary(summaryItems)
      setPhase('round-summary')

      // Auto-advance after 5 s; user can also click Continue
      await Promise.race([
        waitForRoundAdvance(),
        new Promise<void>(resolve => setTimeout(resolve, 5000)),
      ])
      resolveRoundRef.current = null
      setRoundSummary(null)
    }

    // ── generate final report ──────────────────────────────────────────────
    setActivePanelist(null)
    setStreamingText('')
    setPhase('report')

    const keys2 = loadKeys()
    const reportRes = await fetch('/api/verdict', {
      method: 'POST',
      headers: apiHeaders(keys2),
      body: JSON.stringify({ panelists, history: historyRef.current }),
    })
    const verdict: Verdict = await reportRes.json()
    onVerdict(verdict)
  }

  const pushUserReply = (reply: string, round: number) => {
    historyRef.current.push({ role: 'user', content: reply, speaker: 'You', round })
    setHistoryMsgs(prev => [...prev, {
      speaker: 'You', avatar: '💬', color: '#c8962a',
      bg: 'rgba(200,150,42,0.07)', bd: 'rgba(200,150,42,0.2)',
      text: reply, round, isUser: true,
    }])
  }

  // ─── render ────────────────────────────────────────────────────────────────

  const isUserTurn   = phase === 'user-turn'
  const isSpeaking   = phase === 'speaking'
  const isThinking   = phase === 'thinking'
  const isSummary    = phase === 'round-summary'
  const isReport     = phase === 'report'

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>Panel in session</div>
          <div className={styles.headerSub}>{config.ideaDocName}</div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.roundPips}>
            {Array.from({ length: rounds }, (_, i) => (
              <div
                key={i}
                className={`${styles.pip} ${
                  i < currentRound ? styles.pipDone
                  : i === currentRound ? styles.pipActive
                  : ''
                }`}
              />
            ))}
          </div>
          <span className={styles.roundLabel}>
            Round {currentRound + 1} / {rounds}
          </span>
        </div>

        <div className={styles.headerRight}>
          <button
            className={styles.pauseBtn}
            onClick={() => setPaused(p => !p)}
            disabled={isReport}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          {/* Network graph lives in the header */}
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
            <div
              key={i}
              className={`${styles.histItem} ${m.isUser ? styles.histUser : ''}`}
            >
              <span
                className={styles.histAvatar}
                style={{ background: m.bg, borderColor: m.bd }}
              >
                {m.avatar}
              </span>
              <div className={styles.histBody}>
                <div className={styles.histMeta}>
                  <span className={styles.histName} style={{ color: m.color }}>
                    {m.speaker}
                  </span>
                  <span className={styles.histRound}>R{m.round + 1}</span>
                </div>
                <p className={styles.histText}>{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stage — main content area ── */}
      <div className={styles.stage}>

        {/* Round summary card */}
        {isSummary && roundSummary && (
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>
              Round {currentRound + 1} — Questions from the floor
            </div>
            <div className={styles.summaryItems}>
              {roundSummary.map((item, i) => (
                <div key={i} className={styles.summaryItem}>
                  <span className={styles.summaryAvatar}>{item.avatar}</span>
                  <div>
                    <div className={styles.summaryName} style={{ color: item.color }}>
                      {item.name}
                    </div>
                    <div className={styles.summaryQ}>{item.question}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              className={styles.continueBtn}
              onClick={() => resolveRoundRef.current?.()}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Generating report */}
        {isReport && (
          <div className={styles.reportCard}>
            <span className={styles.spinner} />
            <span>Generating final report…</span>
          </div>
        )}

        {/* Active speaker card */}
        {!isSummary && !isReport && activePanelist && (
          <div
            className={`${styles.speakerCard} ${isSpeaking ? styles.speakerCardSpeaking : ''}`}
            style={{
              '--c':  activePanelist.color,
              '--bg': activePanelist.bg,
              '--bd': activePanelist.bd,
            } as React.CSSProperties}
          >
            {/* Speaker identity */}
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

              <div className={styles.speakerStatus}>
                {isThinking && <span className={styles.statusDot}>thinking</span>}
                {isSpeaking && <span className={`${styles.statusDot} ${styles.statusDotOn}`}>● speaking</span>}
                {isUserTurn && <span className={styles.statusDot}>done</span>}
              </div>
            </div>

            {/* Speech content */}
            <div className={styles.speakerText}>
              {isThinking ? (
                <div className={styles.thinkingRow}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              ) : (
                <>
                  {streamingText || '…'}
                  {isSpeaking && <span className={styles.cursor} />}
                </>
              )}
            </div>

            {/* Interrupt button — only during active speech */}
            {isSpeaking && (
              <button className={styles.interruptBtn} onClick={handleInterrupt}>
                ⚡ Interrupt
              </button>
            )}
          </div>
        )}

        {/* User response input — appears after speaker finishes */}
        {isUserTurn && activePanelist && (
          <div className={styles.userTurnCard}>
            <div className={styles.userTurnLabel}>
              Your response to{' '}
              <span style={{ color: activePanelist.color }}>{activePanelist.name}</span>
            </div>
            <div className={styles.userInputRow}>
              <input
                className={styles.userInput}
                value={userReply}
                onChange={e => setUserReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleUserSubmit() }}
                placeholder="Type a reply, question or press Enter to skip…"
                autoFocus
              />
              <button className={styles.sendBtn} onClick={handleUserSubmit}>
                {userReply.trim() ? 'Send →' : 'Skip →'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Subtitle bar — current TTS sentence ── */}
      {subtitle && isSpeaking && (
        <div className={styles.subtitleBar}>
          <span className={styles.subtitleIcon}>🎙</span>
          <span className={styles.subtitleText}>{subtitle}</span>
        </div>
      )}
    </div>
  )
}
