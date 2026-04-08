'use client'
import { useState, useEffect } from 'react'
import DropZone from './DropZone'
import AudioPitchRecorder from './AudioPitchRecorder'
import KeySetupModal from './KeySetupModal'
import type { SimConfig, Panelist } from '@/lib/types'
import type { StoredKeys } from '@/lib/keys'
import { loadKeys, hasTextKey } from '@/lib/keys'
import styles from './SetupScreen.module.css'

interface Props {
  onLaunch: (config: SimConfig, idea: File | null, ideaText?: string) => void
  onBack?: () => void
}

export default function SetupScreen({ onLaunch, onBack }: Props) {
  const [panelFile, setPanelFile]   = useState<File | null>(null)
  const [ideaFile, setIdeaFile]     = useState<File | null>(null)
  const [ideaText, setIdeaText]     = useState('')
  const [pitchMode, setPitchMode]   = useState<'mic' | 'file'>('mic')
  const [rounds, setRounds]         = useState(3)
  const [panelists, setPanelists]   = useState<Panelist[]>([])
  const [parsing, setParsing]       = useState(false)
  const [parseError, setParseError] = useState('')
  const [showKeys, setShowKeys]     = useState(false)

  // ── Hydration-safe key loading ──────────────────────────────────────────
  // Never call loadKeys() during SSR initial render — localStorage doesn't exist there.
  // State starts with empty defaults (same on server + client), then loads after mount.
  const [mounted, setMounted] = useState(false)
  const [keys, setKeys]       = useState<StoredKeys>({ anthropic: '', groq: '', elevenlabs: '' })

  useEffect(() => {
    const k = loadKeys()
    setKeys(k)
    setMounted(true)
    if (!hasTextKey(k)) setShowKeys(true)
  }, [])

  const refreshKeys = () => {
    const k = loadKeys()
    setKeys(k)
  }

  const handlePanelFile = async (file: File) => {
    setPanelFile(file)
    setPanelists([])
    setParseError('')
    setParsing(true)
    try {
      const cur = loadKeys()
      const h: Record<string, string> = {}
      if (cur.anthropic) h['x-anthropic-key'] = cur.anthropic
      if (cur.groq)      h['x-groq-key']      = cur.groq
      const fd = new FormData()
      fd.append('panel', file)
      const res  = await fetch('/api/parse-panel', { method: 'POST', headers: h, body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPanelists(data.panelists)
    } catch {
      setParseError('Could not parse panel document. Try a plain text or PDF.')
    } finally {
      setParsing(false)
    }
  }

  const pitchReady = pitchMode === 'mic' ? !!ideaText : !!ideaFile
  // canLaunch is false on server (mounted=false), same on client initial render → no hydration mismatch
  const canLaunch  = mounted && panelists.length >= 2 && pitchReady && !parsing && hasTextKey(keys)

  const launch = () => {
    if (!canLaunch) return
    const cfg: SimConfig = {
      panelists,
      rounds,
      panelDocName: panelFile?.name ?? 'Panel',
      ideaDocName:  pitchMode === 'mic' ? 'Voice Pitch' : (ideaFile?.name ?? 'Idea'),
    }
    onLaunch(cfg, pitchMode === 'file' ? ideaFile : null, pitchMode === 'mic' ? ideaText : undefined)
  }

  return (
    <div className={styles.wrap}>
      {/* dot-grid background */}
      <div className={styles.grid} aria-hidden="true" />

      {showKeys && (
        <KeySetupModal onClose={() => { setShowKeys(false); refreshKeys() }} />
      )}

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.wordmark}>
          {onBack && (
            <button
              className={styles.backBtn}
              onClick={onBack}
              style={{ marginRight: 16 }}
            >
              ← Dashboard
            </button>
          )}
          <span className={styles.wordmarkMain}>PITCHWARS</span>
          <span className={styles.wordmarkSub}>/ PANEL SIMULATOR / BETA</span>
        </div>
        <button className={styles.keysBtn} onClick={() => setShowKeys(true)}>
          KEYS
        </button>
      </div>

      <div className={styles.inner}>

        {/* ── [01] Panel document ── */}
        <section className={styles.section}>
          <div className={styles.sectionNum}>01</div>
          <div className={styles.sectionBody}>
            <div className={styles.sectionTitle}>Configure Your Panel</div>
            <div className={styles.sectionHint}>
              Upload a document describing your evaluators — names, roles, personalities, criteria
            </div>

            <DropZone
              label="DROP PANEL DOCUMENT"
              hint="PDF · TXT · MD"
              onFile={handlePanelFile}
              fileName={panelFile?.name}
            />

            {parsing && (
              <div className={styles.statusRow}>
                <span className={styles.statusDots}>
                  <span /><span /><span />
                </span>
                <span>Parsing panel document…</span>
              </div>
            )}
            {parseError && <div className={styles.errorRow}>{parseError}</div>}

            {panelists.length > 0 && (
              <div className={styles.panelists}>
                {panelists.map((p, i) => (
                  <div
                    key={i}
                    className={styles.panelistRow}
                    style={{ borderLeftColor: p.color }}
                  >
                    <span className={styles.pNum}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={styles.pAvatar}
                      style={{ background: p.bg, borderColor: p.bd }}
                    >
                      {p.avatar}
                    </span>
                    <div className={styles.pInfo}>
                      <div className={styles.pName} style={{ color: p.color }}>{p.name}</div>
                      <div className={styles.pRole}>{p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── [02] Pitch ── */}
        <section className={styles.section}>
          <div className={styles.sectionNum}>02</div>
          <div className={styles.sectionBody}>
            <div className={styles.sectionTitle}>Your Pitch</div>
            <div className={styles.sectionHint}>
              Record your verbal pitch or upload a document
            </div>

            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'mic' ? styles.modeBtnOn : ''}`}
                onClick={() => setPitchMode('mic')}
              >
                VOICE
              </button>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'file' ? styles.modeBtnOn : ''}`}
                onClick={() => setPitchMode('file')}
              >
                FILE
              </button>
            </div>

            {pitchMode === 'mic' ? (
              <AudioPitchRecorder groqKey={keys.groq} onTranscript={setIdeaText} />
            ) : (
              <DropZone
                label="DROP PITCH DOCUMENT"
                hint="Pitch deck · Business plan · Research paper · Product spec"
                onFile={setIdeaFile}
                fileName={ideaFile?.name}
              />
            )}
          </div>
        </section>

        {/* ── [03] Rounds ── */}
        <section className={styles.section}>
          <div className={styles.sectionNum}>03</div>
          <div className={styles.sectionBody}>
            <div className={styles.sectionTitle}>Simulation Rounds</div>
            <div className={styles.sectionHint}>
              Each round: every panelist speaks, then you respond
            </div>

            <div className={styles.counter}>
              <button
                className={styles.countBtn}
                onClick={() => setRounds(r => Math.max(2, r - 1))}
              >−</button>
              <span className={styles.countNum}>{String(rounds).padStart(2, '0')}</span>
              <button
                className={styles.countBtn}
                onClick={() => setRounds(r => Math.min(6, r + 1))}
              >+</button>
              <span className={styles.countHint}>rounds</span>
            </div>
          </div>
        </section>

        {/* ── Status & launch ── */}
        {mounted && !hasTextKey(keys) && (
          <div className={styles.keyWarning}>
            NO API KEY — click KEYS to add an Anthropic or Groq key before launching
          </div>
        )}

        <button
          className={styles.launchBtn}
          disabled={!canLaunch}
          onClick={launch}
        >
          {parsing ? 'PARSING PANEL…' : 'LAUNCH SIMULATION ↗'}
        </button>

        <div className={styles.footer}>
          {panelists.length > 0
            ? `${panelists.length} panelists · ${rounds} rounds · ${pitchMode === 'mic' ? 'voice pitch' : 'document pitch'}`
            : 'Upload a panel document to begin'
          }
        </div>
      </div>
    </div>
  )
}
