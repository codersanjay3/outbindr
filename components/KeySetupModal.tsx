'use client'
import { useState, useEffect } from 'react'
import { loadKeys, saveKeys, saveKeysToAccount, loadKeysFromAccount } from '@/lib/keys'
import styles from './KeySetupModal.module.css'

interface Props { onClose: () => void }

export default function KeySetupModal({ onClose }: Props) {
  const [groq, setGroq]             = useState('')
  const [elevenlabs, setElevenlabs] = useState('')
  const [saveToAccount, setSaveToAccount] = useState(true)
  const [saved, setSaved]           = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [mounted, setMounted]       = useState(false)

  useEffect(() => {
    const init = async () => {
      // Try account keys first, fall back to localStorage
      setSyncing(true)
      try {
        const accountKeys = await loadKeysFromAccount()
        if (accountKeys?.groq || accountKeys?.elevenlabs) {
          setGroq(accountKeys.groq)
          setElevenlabs(accountKeys.elevenlabs)
        } else {
          const local = loadKeys()
          setGroq(local.groq)
          setElevenlabs(local.elevenlabs)
        }
      } catch {
        const local = loadKeys()
        setGroq(local.groq)
        setElevenlabs(local.elevenlabs)
      } finally {
        setSyncing(false)
      }
      setMounted(true)
    }
    init()
  }, [])

  const canSave = !!groq

  const handleSave = async () => {
    if (!canSave) return
    const keys = { groq, elevenlabs }
    saveKeys(keys)
    if (saveToAccount) {
      try {
        await saveKeysToAccount(keys)
      } catch {
        // Non-fatal if account save fails
      }
    }
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

        {syncing ? (
          <div className={styles.syncingRow}>
            <div className={styles.syncSpinner} />
            <span>Loading saved keys…</span>
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.label}>Groq API Key <span className={styles.note}>(required — powers AI + Whisper audio)</span></label>
              <input
                type="password"
                value={groq}
                onChange={e => setGroq(e.target.value)}
                placeholder="gsk_..."
                disabled={!mounted}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>ElevenLabs API Key <span className={styles.optional}>(optional — realistic panel voices)</span></label>
              <input
                type="password"
                value={elevenlabs}
                onChange={e => setElevenlabs(e.target.value)}
                placeholder="..."
                disabled={!mounted}
              />
              <span className={styles.subhint}>Without this, browser text-to-speech is used.</span>
            </div>

            <label className={styles.accountToggle}>
              <input
                type="checkbox"
                checked={saveToAccount}
                onChange={e => setSaveToAccount(e.target.checked)}
              />
              <span>Save to my Outbindr account (sync across devices)</span>
            </label>

            <p className={styles.hint}>
              Keys are sent only to their respective API providers. Account sync uses encrypted Supabase user metadata.
            </p>

            <button className={styles.saveBtn} disabled={!canSave || !mounted} onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save Keys'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
