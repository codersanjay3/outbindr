'use client'
import { useState } from 'react'
import { loadKeys, saveKeys } from '@/lib/keys'
import styles from './KeySetupModal.module.css'

interface Props { onClose: () => void }

export default function KeySetupModal({ onClose }: Props) {
  const initial = loadKeys()
  const [anthropic, setAnthropic]   = useState(initial.anthropic)
  const [groq, setGroq]             = useState(initial.groq)
  const [elevenlabs, setElevenlabs] = useState(initial.elevenlabs)
  const [saved, setSaved]           = useState(false)

  const canSave = !!(anthropic || groq)

  const handleSave = () => {
    saveKeys({ anthropic, groq, elevenlabs })
    setSaved(true)
    setTimeout(onClose, 700)
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>API Keys</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p className={styles.hint}>Keys are stored only in your browser. They are never sent to any server other than the respective API provider.</p>

        <div className={styles.field}>
          <label className={styles.label}>Anthropic API Key <span className={styles.optional}>(optional)</span></label>
          <input type="password" value={anthropic} onChange={e => setAnthropic(e.target.value)} placeholder="sk-ant-..." />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Groq API Key <span className={styles.note}>(recommended — enables Whisper audio)</span></label>
          <input type="password" value={groq} onChange={e => setGroq(e.target.value)} placeholder="gsk_..." />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ElevenLabs API Key <span className={styles.optional}>(optional — realistic panelist voices)</span></label>
          <input type="password" value={elevenlabs} onChange={e => setElevenlabs(e.target.value)} placeholder="..." />
          <span className={styles.subhint}>Without this, browser text-to-speech is used as fallback.</span>
        </div>

        <button className={styles.saveBtn} disabled={!canSave} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Keys'}
        </button>
      </div>
    </div>
  )
}
