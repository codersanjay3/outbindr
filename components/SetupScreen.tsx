'use client'
import { useState, useEffect } from 'react'
import DropZone from './DropZone'
import AudioPitchRecorder from './AudioPitchRecorder'
import KeySetupModal from './KeySetupModal'
import type { SimConfig, Panelist } from '@/lib/types'
import { loadKeys, hasTextKey } from '@/lib/keys'
import styles from './SetupScreen.module.css'

interface Props {
  onLaunch: (config: SimConfig, idea: File | null, ideaText?: string) => void
}

export default function SetupScreen({ onLaunch }: Props) {
  const [panelFile, setPanelFile]   = useState<File | null>(null)
  const [ideaFile, setIdeaFile]     = useState<File | null>(null)
  const [ideaText, setIdeaText]     = useState('')
  const [pitchMode, setPitchMode]   = useState<'mic' | 'file'>('mic')
  const [rounds, setRounds]         = useState(3)
  const [panelists, setPanelists]   = useState<Panelist[]>([])
  const [parsing, setParsing]       = useState(false)
  const [parseError, setParseError] = useState('')
  const [showKeys, setShowKeys]     = useState(false)
  const [keys, setKeys]             = useState(loadKeys)

  useEffect(() => {
    if (!hasTextKey(loadKeys())) setShowKeys(true)
  }, [])

  const refreshKeys = () => setKeys(loadKeys())

  const handlePanelFile = async (file: File) => {
    setPanelFile(file)
    setPanelists([])
    setParseError('')
    setParsing(true)
    try {
      const current = loadKeys()
      const h: Record<string, string> = {}
      if (current.anthropic) h['x-anthropic-key'] = current.anthropic
      if (current.groq) h['x-groq-key'] = current.groq
      const fd = new FormData()
      fd.append('panel', file)
      const res = await fetch('/api/parse-panel', { method: 'POST', headers: h, body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPanelists(data.panelists)
    } catch {
      setParseError('Could not parse panel document. Try a plain text or PDF file.')
    } finally {
      setParsing(false)
    }
  }

  const pitchReady = pitchMode === 'mic' ? !!ideaText : !!ideaFile
  const canLaunch  = panelists.length >= 2 && pitchReady && !parsing && hasTextKey(keys)

  const launch = () => {
    if (!canLaunch) return
    const cfg: SimConfig = {
      panelists,
      rounds,
      panelDocName: panelFile?.name ?? 'Panel',
      ideaDocName: pitchMode === 'mic' ? 'Voice Pitch' : (ideaFile?.name ?? 'Idea'),
    }
    onLaunch(cfg, pitchMode === 'file' ? ideaFile : null, pitchMode === 'mic' ? ideaText : undefined)
  }

  return (
    <div className={styles.wrap}>
      {showKeys && <KeySetupModal onClose={() => { setShowKeys(false); refreshKeys() }} />}

      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>PANEL SIMULATOR · BETA</span>
          <button className={styles.gearBtn} onClick={() => setShowKeys(true)} title="API Keys">⚙</button>
        </div>
        <h1 className={styles.title}>PitchWars</h1>
        <p className={styles.subtitle}>Upload your panel. Pitch your idea. Watch them decide.</p>
      </header>

      <div className={styles.uploads}>
        <div className={styles.uploadBlock}>
          <div className={styles.label}>Panel document</div>
          <DropZone
            label="Drop your panel configuration"
            hint="Names, roles, personalities, evaluation criteria"
            onFile={handlePanelFile}
            fileName={panelFile?.name}
          />
          {parsing && (
            <p className={styles.status}>
              <span className={styles.dots}><span>·</span><span>·</span><span>·</span></span>
              Parsing panel...
            </p>
          )}
          {parseError && <p className={styles.error}>{parseError}</p>}
          {panelists.length > 0 && (
            <div className={styles.panelistPreview}>
              {panelists.map((p, i) => (
                <div key={i} className={styles.panelistRow}>
                  <div className={styles.pAvatar} style={{ background: p.bg, borderColor: p.bd }}>{p.avatar}</div>
                  <div>
                    <div className={styles.pName} style={{ color: p.color }}>{p.name}</div>
                    <div className={styles.pRole}>{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.uploadBlock}>
          <div className={styles.pitchHeader}>
            <div className={styles.label}>Your pitch</div>
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'mic' ? styles.modeBtnActive : ''}`}
                onClick={() => setPitchMode('mic')}
              >🎙 Voice</button>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'file' ? styles.modeBtnActive : ''}`}
                onClick={() => setPitchMode('file')}
              >📄 File</button>
            </div>
          </div>

          {pitchMode === 'mic' ? (
            <AudioPitchRecorder groqKey={keys.groq} onTranscript={setIdeaText} />
          ) : (
            <DropZone
              label="Drop your idea document"
              hint="Pitch deck, research paper, product spec, business plan"
              onFile={setIdeaFile}
              fileName={ideaFile?.name}
            />
          )}
        </div>
      </div>

      <div className={styles.roundsRow}>
        <div className={styles.label}>Simulation rounds</div>
        <div className={styles.counter}>
          <button className={styles.countBtn} onClick={() => setRounds(r => Math.max(2, r - 1))}>−</button>
          <span className={styles.countNum}>{rounds}</span>
          <button className={styles.countBtn} onClick={() => setRounds(r => Math.min(6, r + 1))}>+</button>
          <span className={styles.countHint}>rounds of panel discussion</span>
        </div>
      </div>

      {!hasTextKey(keys) && (
        <p className={styles.noKeyWarning}>⚠ Add an Anthropic or Groq key via ⚙ to launch a simulation.</p>
      )}

      <button className={styles.launchBtn} disabled={!canLaunch} onClick={launch}>
        LAUNCH SIMULATION ↗
      </button>
    </div>
  )
}
