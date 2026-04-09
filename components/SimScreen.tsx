'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { SimConfig, Message, Verdict, Panelist } from '@/lib/types'
import { loadKeys, apiHeaders } from '@/lib/keys'
import { speakSentence, extractCompleteSentences, cancelCurrentTTS, setMuted } from '@/lib/tts'
import { saveSimSnapshot } from '@/lib/sim-persist'
import AgentGraph, { type GraphEdge } from './AgentGraph'
import AudioPitchRecorder from './AudioPitchRecorder'
import styles from './SimScreen.module.css'

interface Props {
  config: SimConfig
  ideaFile: File | null
  ideaText: string
  onVerdict: (v: Verdict, history: Message[]) => void
  onProgress?: (history: Message[], currentRound: number) => void
  initialHistory?: Message[]
  initialRound?: number
  sessionId?: string
}

type Phase =
  | 'thinking'        // deliberating + awaiting stream
  | 'speaking'        // streaming text + TTS
  | 'waiting-muted'   // muted: text done, waiting for user to click Next
  | 'interrupted'     // user cut in — waiting for their response
  | 'round-turn'      // all panelists done — show summary + user input
  | 'rapid-fire'      // collaborative follow-up questions
  | 'report'          // generating final verdict

interface HistoryMsg {
  speaker: string; avatar: string; color: string; bg: string; bd: string
  text: string; round: number; isUser?: boolean
}

interface RoundQuestion {
  name: string; avatar: string; color: string; question: string
}

interface RapidFireQ {
  panelist: string; avatar: string; color: string; question: string
}

export default function SimScreen({ config, ideaFile, ideaText, onVerdict, onProgress, initialHistory, initialRound, sessionId }: Props) {
  const { panelists, rounds } = config

  // ── UI state ───────────────────────────────────────────────────────────────
  const [phase, setPhase]                   = useState<Phase>('thinking')
  const [activePanelist, setActivePanelist] = useState<Panelist | null>(null)
  const [streamingText, setStreamingText]   = useState('')
  const [subtitle, setSubtitle]             = useState('')
  const [historyMsgs, setHistoryMsgs]       = useState<HistoryMsg[]>(() => {
    // Pre-populate from initialHistory so the drawer is full on resume
    if (!initialHistory?.length) return []
    return initialHistory
      .filter(m => !m.content.startsWith('[Internal deliberation by'))
      .map(m => {
        if (m.role === 'user') {
          return {
            speaker: 'You', avatar: '💬', color: '#888',
            bg: '#f5f5f5', bd: '#e0e0e0',
            text: m.content.replace(/^\[Rapid-fire answer\]\s*/,'').replace(/^\[Interrupts [^\]]+\]:\s*/,''),
            round: m.round ?? 0, isUser: true,
          }
        }
        const p = panelists.find(px => px.name === m.speaker)
        return {
          speaker: m.speaker ?? '',
          avatar:  p?.avatar  ?? '🎤',
          color:   p?.color   ?? '#555',
          bg:      p?.bg      ?? '#f5f5f5',
          bd:      p?.bd      ?? '#e0e0e0',
          text:    m.content,
          round:   m.round ?? 0,
          isUser:  false,
        }
      })
  })
  const [showHistory, setShowHistory]       = useState(false)
  const [userReply, setUserReply]           = useState('')
  const [edges, setEdges]                   = useState<GraphEdge[]>([])
  const [currentRound, setCurrentRound]     = useState(initialRound ?? 0)
  const [roundQuestions, setRoundQuestions] = useState<RoundQuestion[]>([])
  const [paused, setPaused]                 = useState(false)
  const [muted, setMuted_]                  = useState(false)
  const [responseMode, setResponseMode]     = useState<'type' | 'voice'>('type')

  // Interrupt response state
  const [interruptedBy, setInterruptedBy]       = useState<Panelist | null>(null)
  const [interruptReply, setInterruptReply]     = useState('')
  const [interruptMode, setInterruptMode]       = useState<'type' | 'voice'>('type')

  // Rapid-fire state
  const [rapidFireQs, setRapidFireQs]     = useState<RapidFireQ[]>([])
  const [rfIndex, setRfIndex]             = useState(0)
  const [rfAnswer, setRfAnswer]           = useState('')
  const [rfAnswerMode, setRfAnswerMode]   = useState<'type' | 'voice'>('type')
  const [rfLoading, setRfLoading]         = useState(false)

  // ── Stable refs ────────────────────────────────────────────────────────────
  const historyRef            = useRef<Message[]>(initialHistory ?? [])
  const ideaRef               = useRef('')
  const ideaB64Ref            = useRef('')
  const ideaMimeRef           = useRef('')
  const pausedRef             = useRef(false)
  const muteRef               = useRef(false)
  const interruptRef          = useRef(false)
  const abortRef              = useRef<AbortController | null>(null)
  const resolveUserTurnRef    = useRef<((reply: string) => void) | null>(null)
  const resolveInterruptRef   = useRef<((reply: string) => void) | null>(null)
  const resolveRapidFireRef   = useRef<(() => void) | null>(null)
  const mutedAdvanceRef       = useRef<(() => void) | null>(null)
  const userReplyRef          = useRef('')
  const interruptReplyRef     = useRef('')
  const rfAnswerRef           = useRef('')
  const currentRoundRef       = useRef(initialRound ?? 0)
  const roundTurnCardRef      = useRef<HTMLDivElement | null>(null)

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { muteRef.current = muted }, [muted])
  useEffect(() => { userReplyRef.current = userReply }, [userReply])
  useEffect(() => { interruptReplyRef.current = interruptReply }, [interruptReply])
  useEffect(() => { rfAnswerRef.current = rfAnswer }, [rfAnswer])
  useEffect(() => { currentRoundRef.current = currentRound }, [currentRound])

  // ── Scroll round-turn card into view when phase changes ──────────────────
  useEffect(() => {
    if (phase === 'round-turn' && roundTurnCardRef.current) {
      roundTurnCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [phase])

  // ── Sync mute state to tts module ─────────────────────────────────────────
  useEffect(() => {
    setMuted(muted)
    if (muted) cancelCurrentTTS()
  }, [muted])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init() }, [])

  // ── Save helpers ───────────────────────────────────────────────────────────
  const snapshotRef = useRef({ config, ideaText, sessionId })
  useEffect(() => { snapshotRef.current = { config, ideaText, sessionId } }, [config, ideaText, sessionId])

  /** Persist to Supabase (async — may not complete on tab close) */
  const saveToServer = useCallback(() => {
    if (onProgress) onProgress(historyRef.current, currentRoundRef.current)
  }, [onProgress])

  /** Persist to localStorage (synchronous — always completes, even on tab close) */
  const saveLocally = useCallback(() => {
    const { config: cfg, ideaText: it, sessionId: sid } = snapshotRef.current
    if (!sid) return
    saveSimSnapshot({
      sessionId: sid,
      history:   historyRef.current,
      round:     currentRoundRef.current,
      config:    cfg,
      ideaText:  it,
      savedAt:   Date.now(),
    })
  }, [])

  // ── Auto-save every 5 seconds to Supabase + localStorage ──────────────────
  useEffect(() => {
    const id = setInterval(() => {
      saveLocally()   // synchronous — always safe
      saveToServer()  // async — best effort
    }, 5_000)
    return () => clearInterval(id)
  }, [saveLocally, saveToServer])

  // ── Emergency save when tab is hidden or closed ───────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveLocally()   // synchronous — completes before page dies
        saveToServer()  // async — may or may not complete
      }
    }
    const onUnload = () => {
      saveLocally()  // synchronous — guaranteed to complete
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [saveLocally, saveToServer])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const waitIfPaused = () =>
    new Promise<void>(resolve => {
      const check = () => (pausedRef.current ? setTimeout(check, 200) : resolve())
      check()
    })

  const waitForUserTurn = (): Promise<string> =>
    new Promise(resolve => { resolveUserTurnRef.current = resolve })

  const waitForInterruptResponse = (): Promise<string> =>
    new Promise(resolve => { resolveInterruptRef.current = resolve })

  const waitForRapidFireDone = (): Promise<void> =>
    new Promise(resolve => { resolveRapidFireRef.current = resolve })

  /** When muted, pause auto-advance until user clicks "NEXT →". */
  const waitForMutedAdvance = (): Promise<void> =>
    new Promise(resolve => { mutedAdvanceRef.current = resolve })

  const handleMutedAdvance = useCallback(() => {
    mutedAdvanceRef.current?.()
    mutedAdvanceRef.current = null
  }, [])

  const handleUserSubmit = useCallback(() => {
    const reply = userReplyRef.current.trim()
    resolveUserTurnRef.current?.(reply)
    resolveUserTurnRef.current = null
    setUserReply('')
    if (onProgress) onProgress(historyRef.current, currentRoundRef.current)
  }, [onProgress])

  const handleInterruptSubmit = useCallback(() => {
    const reply = interruptReplyRef.current.trim()
    resolveInterruptRef.current?.(reply)
    resolveInterruptRef.current = null
    setInterruptReply('')
  }, [])

  const handleRfSubmit = useCallback(() => {
    const answer = rfAnswerRef.current.trim()
    setRfAnswer('')
    setRapidFireQs(prev => {
      const next = rfIndex + 1
      if (answer) {
        historyRef.current.push({
          role: 'user',
          content: `[Rapid-fire answer] ${answer}`,
          speaker: 'You',
          round: currentRoundRef.current,
        })
      }
      if (next >= prev.length) {
        resolveRapidFireRef.current?.()
        resolveRapidFireRef.current = null
      } else {
        setRfIndex(next)
      }
      return prev
    })
  }, [rfIndex])

  const handleInterrupt = useCallback(() => {
    interruptRef.current = true
    cancelCurrentTTS()
    abortRef.current?.abort()
    // Phase transition to 'interrupted' happens in run() after stream abort
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
    // Start from initialRound so resumed sessions don't redo completed rounds
    const startRound = initialRound ?? 0

    for (let r = startRound; r < rounds; r++) {
      setCurrentRound(r)
      currentRoundRef.current = r
      const roundQs: RoundQuestion[] = []

      for (let pi = 0; pi < panelists.length; pi++) {
        await waitIfPaused()
        const p = panelists[pi]
        // Only treat as "first ever" if we're genuinely starting fresh (no prior history)
        const isFirst = r === 0 && pi === 0 && !initialHistory?.length

        setActivePanelist(p)
        setStreamingText('')
        setPhase('thinking')
        interruptRef.current = false

        // ── STEP 1: Internal deliberation ────────────────────────────────────
        if (!isFirst) {
          try {
            const dr = await fetch('/api/deliberate', {
              method: 'POST',
              headers: apiHeaders(keys),
              body: JSON.stringify({
                panelist: p, allPanelists: panelists,
                ideaText: ideaRef.current, history: historyRef.current,
                round: r, totalRounds: rounds,
              }),
            })
            const { deliberation } = await dr.json()
            if (deliberation) {
              historyRef.current.push({
                role: 'assistant',
                content: `[Internal deliberation by ${p.name}]: ${deliberation}`,
                speaker: p.name, round: r,
              })
            }
          } catch { /* silently skip */ }
        }

        // ── STEP 2: Public response — streamed + spoken ──────────────────────
        abortRef.current = new AbortController()
        let res: Response

        try {
          res = await fetch('/api/simulate', {
            method: 'POST',
            headers: apiHeaders(keys),
            signal: abortRef.current.signal,
            body: JSON.stringify({
              panelist: p, allPanelists: panelists,
              ideaText: ideaRef.current,
              ideaBase64:   ideaB64Ref.current  || undefined,
              ideaMimeType: ideaMimeRef.current || undefined,
              history: historyRef.current,
              round: r, totalRounds: rounds, isFirst,
            }),
          })
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            // Will handle after this block
          } else { throw e }
          res = null as unknown as Response
        }

        let fullText = ''

        if (res) {
          const reader  = res.body!.getReader()
          const decoder = new TextDecoder()
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

          if (!interruptRef.current && muteRef.current) {
            // Muted mode: show text, wait for user to click Next
            setPhase('waiting-muted')
            await waitForMutedAdvance()
          } else if (!interruptRef.current) {
            // Unmuted mode: hold text visible for 2s so user can read it
            // (also acts as buffer when TTS completes faster than expected)
            await new Promise(res => setTimeout(res, 2000))
          }
        }

        if (fullText) {
          historyRef.current.push({ role: 'assistant', content: fullText, speaker: p.name, round: r })
          setHistoryMsgs(prev => [...prev, {
            speaker: p.name, avatar: p.avatar, color: p.color,
            bg: p.bg, bd: p.bd, text: fullText, round: r,
          }])
          roundQs.push({ name: p.name, avatar: p.avatar, color: p.color, question: extractQuestion(fullText) })
        }

        // ── STEP 3: If interrupted, let user respond immediately ─────────────
        if (interruptRef.current) {
          setInterruptedBy(p)
          setInterruptReply('')
          setInterruptMode('type')
          setPhase('interrupted')

          const iReply = await waitForInterruptResponse()

          if (iReply.trim()) {
            historyRef.current.push({
              role: 'user',
              content: `[Interrupts ${p.name}]: ${iReply}`,
              speaker: 'You',
              round: r,
            })
            setHistoryMsgs(prev => [...prev, {
              speaker: 'You', avatar: '💬', color: '#888',
              bg: '#f5f5f5', bd: '#e0e0e0',
              text: iReply, round: r, isUser: true,
            }])
          }

          interruptRef.current = false
          setInterruptedBy(null)
          setPhase('thinking')
          if (onProgress) onProgress(historyRef.current, r)
        }

        await new Promise(res => setTimeout(res, 400))
      }

      // ── END OF ROUND: user turn ──────────────────────────────────────────
      setActivePanelist(null)
      setStreamingText('')
      setResponseMode('type')
      // Set questions first, yield to let React commit, then switch phase
      setRoundQuestions(roundQs.length > 0 ? roundQs : [])
      await new Promise(res => setTimeout(res, 0))
      setPhase('round-turn')

      const reply = await waitForUserTurn()
      if (reply) {
        historyRef.current.push({ role: 'user', content: reply, speaker: 'You', round: r })
        setHistoryMsgs(prev => [...prev, {
          speaker: 'You', avatar: '💬', color: '#888',
          bg: '#f5f5f5', bd: '#e0e0e0',
          text: reply, round: r, isUser: true,
        }])
      }
      // Keep questions visible until after rapid-fire completes
      // (cleared below after rapid-fire)

      // ── RAPID-FIRE follow-up questions ───────────────────────────────────
      try {
        setRfLoading(true)
        setRfIndex(0)
        setRfAnswer('')
        setRfAnswerMode('type')

        const rfRes = await fetch('/api/rapid-fire', {
          method: 'POST',
          headers: apiHeaders(keys),
          body: JSON.stringify({
            panelists,
            history: historyRef.current.slice(-16),
            round: r, totalRounds: rounds,
          }),
        })
        const { questions } = await rfRes.json()
        setRfLoading(false)

        if (questions?.length > 0) {
          setRapidFireQs(questions)
          setPhase('rapid-fire')
          await waitForRapidFireDone()
        }
      } catch {
        setRfLoading(false)
      }
      // Clear round questions only after rapid-fire is done
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

  const isSpeaking    = phase === 'speaking'
  const isThinking    = phase === 'thinking'
  const isWaitingMuted = phase === 'waiting-muted'
  const isRoundTurn   = phase === 'round-turn'
  const isInterrupted = phase === 'interrupted'
  const isRapidFire   = phase === 'rapid-fire'
  const isReport      = phase === 'report'

  const currentRfQ = rapidFireQs[rfIndex]

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
            className={`${styles.pauseBtn} ${muted ? styles.muteBtnOn : ''}`}
            onClick={() => setMuted_(m => !m)}
            title={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? 'UNMUTE' : 'MUTE'}
          </button>
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

        {isReport && (
          <div className={styles.reportCard}>
            <span className={styles.spinner} />
            <span>Generating performance report…</span>
          </div>
        )}

        {rfLoading && (
          <div className={styles.reportCard}>
            <span className={styles.spinner} />
            <span>Panel is formulating follow-up questions…</span>
          </div>
        )}

        {/* ── Interrupted — user speaks back ── */}
        {isInterrupted && interruptedBy && (
          <div className={styles.interruptedCard}>
            <div className={styles.interruptedHeader}>
              <div className={styles.interruptedLeft}>
                <span className={styles.interruptedIcon}>⚡</span>
                <div>
                  <div className={styles.interruptedTitle}>You cut in</div>
                  <div className={styles.interruptedSub}>
                    {interruptedBy.avatar} {interruptedBy.name} will hear you — respond or skip
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.responseModeToggle}>
              <button
                className={`${styles.responseModeBtn} ${interruptMode === 'type' ? styles.responseModeBtnOn : ''}`}
                onClick={() => setInterruptMode('type')}
              >TYPE</button>
              <button
                className={`${styles.responseModeBtn} ${interruptMode === 'voice' ? styles.responseModeBtnOn : ''}`}
                onClick={() => setInterruptMode('voice')}
              >VOICE</button>
            </div>

            {interruptMode === 'type' ? (
              <>
                <textarea
                  className={styles.userTextarea}
                  value={interruptReply}
                  onChange={e => setInterruptReply(e.target.value)}
                  placeholder="Say what's on your mind…"
                  rows={3}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.shiftKey)) {
                      e.preventDefault()
                      handleInterruptSubmit()
                    }
                  }}
                />
                <div className={styles.userTurnActions}>
                  <span className={styles.userTurnHint}>⌘↵ to submit</span>
                  <div className={styles.userTurnBtns}>
                    <button className={styles.skipBtn} onClick={() => { setInterruptReply(''); handleInterruptSubmit() }}>
                      Skip →
                    </button>
                    <button className={styles.sendBtn} onClick={handleInterruptSubmit}>
                      Speak up →
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.voiceResponseWrap}>
                <AudioPitchRecorder
                  groqKey={loadKeys().groq}
                  onTranscript={t => setInterruptReply(t)}
                />
                {interruptReply && (
                  <div className={styles.userTurnActions} style={{ marginTop: 12 }}>
                    <span className={styles.userTurnHint}>{interruptReply.split(/\s+/).length} words</span>
                    <div className={styles.userTurnBtns}>
                      <button className={styles.skipBtn} onClick={() => { setInterruptReply(''); handleInterruptSubmit() }}>Skip →</button>
                      <button className={styles.sendBtn} onClick={handleInterruptSubmit}>Speak up →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Round turn ── */}
        {isRoundTurn && (
          <div className={styles.roundTurnCard} ref={roundTurnCardRef}>
            <div className={styles.roundTurnTitle}>
              Round {currentRound + 1} — Address the panel
            </div>

            {roundQuestions.length > 0 && (
              <div className={styles.questionsList}>
                <div className={styles.questionsHeader}>Questions asked this round</div>
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

              <div className={styles.responseModeToggle}>
                <button
                  className={`${styles.responseModeBtn} ${responseMode === 'type' ? styles.responseModeBtnOn : ''}`}
                  onClick={() => setResponseMode('type')}
                >TYPE</button>
                <button
                  className={`${styles.responseModeBtn} ${responseMode === 'voice' ? styles.responseModeBtnOn : ''}`}
                  onClick={() => setResponseMode('voice')}
                >VOICE</button>
              </div>

              {responseMode === 'type' ? (
                <>
                  <textarea
                    className={styles.userTextarea}
                    value={userReply}
                    onChange={e => setUserReply(e.target.value)}
                    placeholder="Type your response here…"
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
                      <button className={styles.skipBtn} onClick={() => { setUserReply(''); handleUserSubmit() }}>
                        Skip round →
                      </button>
                      <button className={styles.sendBtn} onClick={handleUserSubmit}>Submit →</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.voiceResponseWrap}>
                  <AudioPitchRecorder groqKey={loadKeys().groq} onTranscript={t => setUserReply(t)} />
                  {userReply && (
                    <div className={styles.userTurnActions} style={{ marginTop: 12 }}>
                      <span className={styles.userTurnHint}>{userReply.split(/\s+/).length} words recorded</span>
                      <div className={styles.userTurnBtns}>
                        <button className={styles.skipBtn} onClick={() => { setUserReply(''); handleUserSubmit() }}>Skip →</button>
                        <button className={styles.sendBtn} onClick={handleUserSubmit}>Submit →</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Rapid-fire questions ── */}
        {isRapidFire && currentRfQ && (
          <div className={styles.rfCard}>
            <div className={styles.rfHeader}>
              <span className={styles.rfLabel}>RAPID-FIRE</span>
              <span className={styles.rfProgress}>{rfIndex + 1} / {rapidFireQs.length}</span>
            </div>

            <div className={styles.rfQuestionRow}>
              <span className={styles.rfAvatar}>{currentRfQ.avatar}</span>
              <div>
                <div className={styles.rfName} style={{ color: currentRfQ.color }}>{currentRfQ.panelist}</div>
                <div className={styles.rfQuestion}>{currentRfQ.question}</div>
              </div>
            </div>

            <div className={styles.rfDots}>
              {rapidFireQs.map((_, i) => (
                <span key={i} className={`${styles.rfDot} ${i === rfIndex ? styles.rfDotActive : i < rfIndex ? styles.rfDotDone : ''}`} />
              ))}
            </div>

            <div className={styles.responseModeToggle} style={{ marginBottom: 10 }}>
              <button
                className={`${styles.responseModeBtn} ${rfAnswerMode === 'type' ? styles.responseModeBtnOn : ''}`}
                onClick={() => setRfAnswerMode('type')}
              >TYPE</button>
              <button
                className={`${styles.responseModeBtn} ${rfAnswerMode === 'voice' ? styles.responseModeBtnOn : ''}`}
                onClick={() => setRfAnswerMode('voice')}
              >VOICE</button>
            </div>

            {rfAnswerMode === 'type' ? (
              <>
                <textarea
                  className={styles.userTextarea}
                  value={rfAnswer}
                  onChange={e => setRfAnswer(e.target.value)}
                  placeholder="Your answer…"
                  rows={2}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.shiftKey)) {
                      e.preventDefault()
                      handleRfSubmit()
                    }
                  }}
                />
                <div className={styles.userTurnActions} style={{ marginTop: 8 }}>
                  <span className={styles.userTurnHint}>⌘↵ to answer</span>
                  <div className={styles.userTurnBtns}>
                    <button className={styles.skipBtn} onClick={handleRfSubmit}>Skip →</button>
                    <button className={styles.sendBtn} onClick={handleRfSubmit}>
                      {rfIndex + 1 < rapidFireQs.length ? 'Next →' : 'Done ✓'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.voiceResponseWrap}>
                <AudioPitchRecorder groqKey={loadKeys().groq} onTranscript={t => setRfAnswer(t)} />
                {rfAnswer && (
                  <div className={styles.userTurnActions} style={{ marginTop: 12 }}>
                    <span className={styles.userTurnHint}>{rfAnswer.split(/\s+/).length} words</span>
                    <div className={styles.userTurnBtns}>
                      <button className={styles.skipBtn} onClick={() => { setRfAnswer(''); handleRfSubmit() }}>Skip →</button>
                      <button className={styles.sendBtn} onClick={handleRfSubmit}>
                        {rfIndex + 1 < rapidFireQs.length ? 'Next →' : 'Done ✓'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Active speaker spotlight ── */}
        {!isRoundTurn && !isInterrupted && !isRapidFire && !isReport && !rfLoading && activePanelist && (
          <div
            className={`${styles.speakerCard} ${isSpeaking ? styles.speakerCardActive : ''}`}
            style={{
              '--pc': activePanelist.color,
              '--pbg': activePanelist.bg,
              '--pbd': activePanelist.bd,
            } as React.CSSProperties}
          >
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
                {isWaitingMuted && <span className={styles.badgeMuted}>✕ muted</span>}
              </div>
            </div>

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

            {/* Bug A: muted mode — show Next button so user controls the pace */}
            {isWaitingMuted && (
              <button className={styles.mutedNextBtn} onClick={handleMutedAdvance}>
                NEXT →
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
