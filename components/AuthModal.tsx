'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './AuthModal.module.css'

interface Props {
  onSuccess: () => void
  onClose: () => void
}

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [mode, setMode]         = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('')
  const [age, setAge]           = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onSuccess()
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              age: parseInt(age),
            },
          },
        })
        if (error) throw error
        setInfo('Account created! Check your email to confirm, then sign in.')
        setMode('login')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>
            {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>FULL NAME</label>
                <input
                  type="text" value={fullName} required
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>AGE</label>
                <input
                  type="number" value={age} required min={13} max={120}
                  onChange={e => setAge(e.target.value)}
                  placeholder="25"
                />
              </div>
            </>
          )}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>EMAIL</label>
            <input
              type="email" value={email} required autoFocus
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>PASSWORD</label>
            <input
              type="password" value={password} required
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <label className={styles.agreeRow}>
              <input
                type="checkbox"
                className={styles.agreeCheck}
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                required
              />
              <span className={styles.agreeText}>
                I have read and agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className={styles.agreeLink}>
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.agreeLink}>
                  Privacy Policy
                </a>
              </span>
            </label>
          )}

          {error && <div className={styles.error}>{error}</div>}
          {info  && <div className={styles.info}>{info}</div>}

          <button
            className={styles.submitBtn}
            type="submit"
            disabled={loading || (mode === 'signup' && (!fullName.trim() || !age || !agreed))}
          >
            {loading ? '…' : mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
          </button>
        </form>

        <div className={styles.switchRow}>
          {mode === 'login' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); setInfo('') }}>
                Create one
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); setInfo('') }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
