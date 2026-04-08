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
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
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
        const { error } = await supabase.auth.signUp({ email, password })
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

          {error && <div className={styles.error}>{error}</div>}
          {info  && <div className={styles.info}>{info}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
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
