'use client'
import { useState, useEffect, useRef } from 'react'
import DropZone from './DropZone'
import AudioPitchRecorder from './AudioPitchRecorder'
import KeySetupModal from './KeySetupModal'
import PanelGuideModal from './PanelGuideModal'
import type { SimConfig, Panelist } from '@/lib/types'
import type { StoredKeys } from '@/lib/keys'
import type { SetupState } from '@/lib/supabase-sessions'
import { loadKeys, hasTextKey } from '@/lib/keys'
import { PANEL_TEMPLATES } from '@/lib/panel-templates'
import styles from './SetupScreen.module.css'

interface Props {
  onLaunch: (config: SimConfig, idea: File | null, ideaText?: string) => void
  onBack?: () => void
  onAutoSave?: (state: SetupState) => void
}

export default function SetupScreen({ onLaunch, onBack, onAutoSave }: Props) {
  const [sessionName, setSessionName]         = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [panelFile, setPanelFile]   = useState<File | null>(null)
  const [ideaText, setIdeaText]     = useState('')
  const [pitchMode, setPitchMode]   = useState<'mic' | 'type'>('mic')
  const [rounds, setRounds]         = useState(3)
  const [panelists, setPanelists]   = useState<Panelist[]>([])
  const [parsing, setParsing]       = useState(false)
  const [parseError, setParseError] = useState('')
  const [showKeys, setShowKeys]     = useState(false)
  const [showGuide, setShowGuide]   = useState(false)

  // ── Panel source toggle ────────────────────────────────────────────────
  const [panelSource, setPanelSource]   = useState<'upload' | 'template'>('upload')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [templateOpen, setTemplateOpen] = useState(false)

  // ── Hydration-safe key loading ──────────────────────────────────────────
  const [mounted, setMounted] = useState(false)
  const [keys, setKeys]       = useState<StoredKeys>({ groq: '', elevenlabs: '' })

  useEffect(() => {
    const k = loadKeys()
    setKeys(k)
    setMounted(true)
    if (!hasTextKey(k)) setShowKeys(true)
  }, [])

  // ── Auto-save every 10 seconds ─────────────────────────────────────────
  const autoSaveRef = useRef({ panelists, ideaText, rounds, pitchMode })
  useEffect(() => {
    autoSaveRef.current = { panelists, ideaText, rounds, pitchMode }
  }, [panelists, ideaText, rounds, pitchMode])

  // keep sessionName/description in ref so auto-save always has latest
  const sessionNameRef = useRef(sessionName)
  const sessionDescRef = useRef(sessionDescription)
  useEffect(() => { sessionNameRef.current = sessionName }, [sessionName])
  useEffect(() => { sessionDescRef.current = sessionDescription }, [sessionDescription])

  useEffect(() => {
    if (!onAutoSave) return
    const id = setInterval(() => {
      const { panelists: p, ideaText: it, rounds: r, pitchMode: pm } = autoSaveRef.current
      onAutoSave({
        panelists: p,
        ideaText:  it,
        rounds:    r,
        title:     sessionNameRef.current || (p.length > 0 ? `Draft — ${p.map(x => x.name).join(', ')}` : 'Draft'),
        pitchMode: pm,
      })
    }, 10_000)
    return () => clearInterval(id)
  }, [onAutoSave])

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
      if (cur.groq) h['x-groq-key'] = cur.groq
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

  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplate(templateId)
    setTemplateOpen(false)
    const tmpl = PANEL_TEMPLATES.find(t => t.id === templateId)
    if (!tmpl) return
    setPanelists([])
    setParseError('')
    setParsing(true)
    try {
      const cur = loadKeys()
      const h: Record<string, string> = {}
      if (cur.groq) h['x-groq-key'] = cur.groq
      const blob = new Blob([tmpl.text], { type: 'text/plain' })
      const file = new File([blob], `${tmpl.id}.txt`, { type: 'text/plain' })
      const fd = new FormData()
      fd.append('panel', file)
      const res  = await fetch('/api/parse-panel', { method: 'POST', headers: h, body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPanelists(data.panelists)
      // Set panel file so the config picks up a name
      setPanelFile(file)
    } catch {
      setParseError('Could not load template. Make sure your Groq key is set.')
    } finally {
      setParsing(false)
    }
  }

  const pitchReady = ideaText.trim().length > 10
  const canLaunch  = mounted && panelists.length >= 2 && pitchReady && !parsing && hasTextKey(keys)

  const launch = () => {
    if (!canLaunch) return
    const cfg: SimConfig = {
      panelists,
      rounds,
      panelDocName:       panelFile?.name ?? 'Panel',
      ideaDocName:        pitchMode === 'mic' ? 'Voice Pitch' : 'Written Pitch',
      sessionName:        sessionName.trim() || undefined,
      sessionDescription: sessionDescription.trim() || undefined,
    }
    onLaunch(cfg, null, ideaText)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} aria-hidden="true" />

      {showKeys && (
        <KeySetupModal onClose={() => { setShowKeys(false); refreshKeys() }} />
      )}

      {showGuide && (
        <PanelGuideModal onClose={() => setShowGuide(false)} />
      )}

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.wordmark}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack} style={{ marginRight: 16 }}>
              ← Dashboard
            </button>
          )}
          <span className={styles.wordmarkMain}>OUTBINDR</span>
          <span className={styles.wordmarkSub}>/ PANEL SIMULATOR / BETA</span>
        </div>
        <button className={styles.keysBtn} onClick={() => setShowKeys(true)}>
          KEYS
        </button>
      </div>

      <div className={styles.inner}>

        {/* ── [00] Session name ── */}
        <section className={styles.section}>
          <div className={styles.sectionNum}>00</div>
          <div className={styles.sectionBody}>
            <div className={styles.sectionTitle}>Session Name</div>
            <div className={styles.sectionHint}>
              Give this session a name and optional description so you can find it later
            </div>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="e.g. Startup pitch — Series A panel"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              maxLength={80}
            />
            <textarea
              className={styles.descInput}
              placeholder="Optional description — what is this session about? (shown in your history)"
              value={sessionDescription}
              onChange={e => setSessionDescription(e.target.value)}
              rows={2}
              maxLength={200}
            />
          </div>
        </section>

        {/* ── [01] Panel document ── */}
        <section className={styles.section}>
          <div className={styles.sectionNum}>01</div>
          <div className={styles.sectionBody}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.sectionTitle}>Configure Your Panel</div>
              <button
                className={styles.infoBtn}
                onClick={() => setShowGuide(true)}
                title="Panel document guide"
                aria-label="Open panel document guide"
              >ⓘ</button>
            </div>
            <div className={styles.sectionHint}>
              Choose a preset panel template or upload your own document
            </div>

            {/* ── Source toggle ── */}
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${panelSource === 'upload' ? styles.modeBtnOn : ''}`}
                onClick={() => {
                  setPanelSource('upload')
                  setPanelists([])
                  setPanelFile(null)
                  setSelectedTemplate('')
                  setParseError('')
                }}
              >
                UPLOAD
              </button>
              <button
                className={`${styles.modeBtn} ${panelSource === 'template' ? styles.modeBtnOn : ''}`}
                onClick={() => {
                  setPanelSource('template')
                  setPanelists([])
                  setPanelFile(null)
                  setSelectedTemplate('')
                  setParseError('')
                }}
              >
                TEMPLATES
              </button>
            </div>

            {/* ── Upload mode ── */}
            {panelSource === 'upload' && (
              <DropZone
                label="DROP PANEL DOCUMENT"
                hint="PDF · TXT · MD"
                onFile={handlePanelFile}
                fileName={panelFile?.name}
              />
            )}

            {/* ── Template mode ── */}
            {panelSource === 'template' && (
              <div className={styles.templateWrap}>
                <button
                  className={styles.templateDropdownBtn}
                  onClick={() => setTemplateOpen(o => !o)}
                  type="button"
                >
                  <span>
                    {selectedTemplate
                      ? PANEL_TEMPLATES.find(t => t.id === selectedTemplate)?.label ?? 'Select a template'
                      : 'Select a template'}
                  </span>
                  <span className={styles.templateChevron}>{templateOpen ? '▲' : '▼'}</span>
                </button>

                {templateOpen && (
                  <div className={styles.templateMenu}>
                    {PANEL_TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        className={`${styles.templateOption} ${selectedTemplate === t.id ? styles.templateOptionActive : ''}`}
                        onClick={() => handleTemplateSelect(t.id)}
                        type="button"
                      >
                        <span className={styles.templateOptionLabel}>{t.label}</span>
                        <span className={styles.templateOptionDesc}>{t.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {parsing && (
              <div className={styles.statusRow}>
                <span className={styles.statusDots}><span /><span /><span /></span>
                <span>{panelSource === 'template' ? 'Loading template…' : 'Parsing panel document…'}</span>
              </div>
            )}
            {parseError && <div className={styles.errorRow}>{parseError}</div>}

            {panelists.length > 0 && (
              <div className={styles.panelists}>
                {panelists.map((p, i) => (
                  <div key={i} className={styles.panelistRow} style={{ borderLeftColor: p.color }}>
                    <span className={styles.pNum}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={styles.pAvatar} style={{ background: p.bg, borderColor: p.bd }}>
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
              Record your pitch verbally or type it out
            </div>

            {/* Toggle */}
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'mic' ? styles.modeBtnOn : ''}`}
                onClick={() => { setPitchMode('mic'); setIdeaText('') }}
              >
                VOICE
              </button>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'type' ? styles.modeBtnOn : ''}`}
                onClick={() => { setPitchMode('type'); setIdeaText('') }}
              >
                TYPE
              </button>
            </div>

            {pitchMode === 'mic' ? (
              <AudioPitchRecorder groqKey={keys.groq} onTranscript={setIdeaText} />
            ) : (
              <div className={styles.typeWrap}>
                <textarea
                  className={styles.typeArea}
                  placeholder="Describe your idea, project, or argument. The panel will base their evaluation on what you write here…"
                  value={ideaText}
                  onChange={e => setIdeaText(e.target.value)}
                  rows={7}
                />
                <div className={styles.typeHint}>
                  {ideaText.trim().length > 0
                    ? `${ideaText.trim().split(/\s+/).length} words`
                    : 'Min ~10 words to continue'}
                </div>
              </div>
            )}

            {/* Show transcript summary when voice mode has captured text */}
            {pitchMode === 'mic' && ideaText && (
              <div className={styles.transcriptPreview}>
                <span className={styles.transcriptTag}>TRANSCRIPT READY</span>
                <span className={styles.transcriptCount}>{ideaText.trim().split(/\s+/).length} words</span>
              </div>
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
              <button className={styles.countBtn} onClick={() => setRounds(r => Math.max(2, r - 1))}>−</button>
              <span className={styles.countNum}>{String(rounds).padStart(2, '0')}</span>
              <button className={styles.countBtn} onClick={() => setRounds(r => Math.min(6, r + 1))}>+</button>
              <span className={styles.countHint}>rounds</span>
            </div>
          </div>
        </section>

        {/* ── Status & launch ── */}
        {mounted && !hasTextKey(keys) && (
          <div className={styles.keyWarning}>
            NO API KEY — click KEYS to add a Groq key before launching
          </div>
        )}

        <button className={styles.launchBtn} disabled={!canLaunch} onClick={launch}>
          {parsing ? 'PARSING PANEL…' : 'LAUNCH SIMULATION ↗'}
        </button>

        <div className={styles.footer}>
          {panelists.length > 0
            ? `${panelists.length} panelists · ${rounds} rounds · ${pitchMode === 'mic' ? 'voice pitch' : 'written pitch'}`
            : 'Upload a panel document to begin'
          }
        </div>
      </div>
    </div>
  )
}
