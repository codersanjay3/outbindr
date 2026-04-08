'use client'
import { useEffect, useRef, useState } from 'react'
import type { SimConfig, Message, Verdict } from '@/lib/types'
import { loadKeys, apiHeaders } from '@/lib/keys'
import { speakSentence, extractCompleteSentences } from '@/lib/tts'
import styles from './SimScreen.module.css'

interface Props {
  config: SimConfig
  ideaFile: File | null
  ideaText: string
  onVerdict: (v: Verdict) => void
}

interface ChatMessage {
  speaker: string; avatar: string; color: string; bg: string; bd: string
  text: string; round: number; streaming: boolean
}

export default function SimScreen({ config, ideaFile, ideaText, onVerdict }: Props) {
  const { panelists, rounds } = config
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [activePanelist, setActivePanelist] = useState<string | null>(null)
  const [subtitle, setSubtitle]         = useState('')
  const [paused, setPaused]             = useState(false)
  const [thinking, setThinking]         = useState('')
  const [done, setDone]                 = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const historyRef  = useRef<Message[]>([])
  const ideaRef     = useRef('')
  const ideaB64Ref  = useRef('')
  const ideaMimeRef = useRef('')
  const pausedRef   = useRef(false)

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])
  useEffect(() => { loadAndRun() }, [])

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

  const waitIfPaused = () => new Promise<void>(resolve => {
    const check = () => pausedRef.current ? setTimeout(check, 200) : resolve()
    check()
  })

  const runSimulation = async () => {
    const keys = loadKeys()

    for (let r = 0; r < rounds; r++) {
      setCurrentRound(r)

      for (let pi = 0; pi < panelists.length; pi++) {
        await waitIfPaused()
        const p = panelists[pi]
        const isFirst = r === 0 && pi === 0
        setActivePanelist(p.name)
        setThinking(`${p.name} is thinking...`)

        // Add streaming placeholder
        const placeholder: ChatMessage = {
          speaker: p.name, avatar: p.avatar, color: p.color, bg: p.bg, bd: p.bd,
          text: '', round: r, streaming: true,
        }
        setMessages(prev => [...prev, placeholder])
        const msgIdx = await new Promise<number>(res =>
          setMessages(prev => { res(prev.length - 1); return prev })
        )
        setThinking('')

        // Call /api/simulate — stream response
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: apiHeaders(keys),
          body: JSON.stringify({
            panelist: p,
            allPanelists: panelists,
            ideaText: ideaRef.current,
            ideaBase64:  ideaB64Ref.current  || undefined,
            ideaMimeType: ideaMimeRef.current || undefined,
            history: historyRef.current,
            round: r, totalRounds: rounds, isFirst,
          }),
        })

        // Stream + TTS sentence-by-sentence in parallel
        const reader  = res.body!.getReader()
        const decoder = new TextDecoder()
        let fullText  = ''
        let ttsBuf    = ''

        const flushSentences = async (buf: string): Promise<string> => {
          const { sentences, remainder } = extractCompleteSentences(buf)
          for (const s of sentences) {
            setSubtitle(s)
            await speakSentence(s, p.voiceId, p.webSpeechVoice, keys.elevenlabs || null)
            await waitIfPaused()
          }
          return remainder
        }

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          const chunk = decoder.decode(value)
          fullText += chunk
          ttsBuf   += chunk
          setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, text: fullText, streaming: true } : m))
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          ttsBuf = await flushSentences(ttsBuf)
        }

        // Speak any remaining fragment
        if (ttsBuf.trim()) {
          setSubtitle(ttsBuf.trim())
          await speakSentence(ttsBuf.trim(), p.voiceId, p.webSpeechVoice, keys.elevenlabs || null)
        }

        setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, streaming: false } : m))
        setSubtitle('')
        historyRef.current.push({ role: 'assistant', content: fullText, speaker: p.name, round: r })
        await new Promise(r => setTimeout(r, 350))
      }
    }

    // Generate final report
    setActivePanelist(null)
    setDone(true)
    setThinking('Generating report...')
    const keys2 = loadKeys()
    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: apiHeaders(keys2),
      body: JSON.stringify({ panelists, history: historyRef.current }),
    })
    const verdict: Verdict = await res.json()
    setThinking('')
    onVerdict(verdict)
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Panel in session</div>
          <div className={styles.headerSub}>{config.ideaDocName}</div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.pips}>
            {Array.from({ length: rounds }, (_, i) => (
              <div key={i} className={`${styles.pip} ${i < currentRound ? styles.pipDone : i === currentRound ? styles.pipActive : ''}`} />
            ))}
          </div>
          <button className={styles.pauseBtn} onClick={() => setPaused(p => !p)} disabled={done}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </header>

      {/* Active panelist strip */}
      {!done && (
        <div className={styles.activeBar}>
          {panelists.map(p => (
            <div
              key={p.name}
              className={`${styles.activePip} ${activePanelist === p.name ? styles.activePipOn : ''}`}
              style={{ '--c': p.color, '--bg-color': p.bg, '--bd': p.bd } as React.CSSProperties}
            >
              <span>{p.avatar}</span>
              {activePanelist === p.name && (
                <span className={styles.activePipName} style={{ color: p.color }}>{p.name}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.chat}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.msg} ${activePanelist === msg.speaker && msg.streaming ? styles.msgActive : ''}`}>
            <div className={styles.msgHeader}>
              <div className={styles.avatar} style={{ background: msg.bg, borderColor: msg.bd }}>{msg.avatar}</div>
              <span className={styles.speaker} style={{ color: msg.color }}>{msg.speaker}</span>
              <span className={styles.roundTag} style={{ background: msg.bg, color: msg.color, borderColor: msg.bd }}>R{msg.round + 1}</span>
            </div>
            <div className={styles.msgText}>
              {msg.text || (msg.streaming ? '' : '...')}
              {msg.streaming && <span className="cursor" />}
            </div>
          </div>
        ))}

        {thinking && (
          <div className={styles.thinking}>
            <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
            <span className={styles.thinkingText}>{thinking}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {subtitle && (
        <div className={styles.subtitleBar}>
          <span className={styles.subtitleText}>{subtitle}</span>
        </div>
      )}
    </div>
  )
}
