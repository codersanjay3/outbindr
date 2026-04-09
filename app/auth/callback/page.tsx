'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Supabase email-confirmation callback.
 *
 * After the user clicks the link in their confirmation email, Supabase
 * redirects them here with either:
 *   ?code=<pkce_code>          (newer PKCE flow — exchanged for a session)
 *   #access_token=<token>&…   (older implicit flow — Supabase client handles automatically)
 *
 * Configure this URL in your Supabase project:
 *   Authentication → URL Configuration → Redirect URLs
 *   Add: https://www.outbindr.com/auth/callback
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')

    if (code) {
      // PKCE flow — exchange the one-time code for a real session
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) console.error('Auth callback error:', error.message)
          router.replace('/')
        })
    } else {
      // Implicit / hash flow — the Supabase client auto-processes the fragment
      // Just wait for onAuthStateChange then redirect home
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          subscription.unsubscribe()
          router.replace('/')
        }
      })
      // Redirect home anyway after a short delay — covers the case where the
      // token was already processed by a previous page load
      const t = setTimeout(() => router.replace('/'), 2000)
      return () => { clearTimeout(t); subscription.unsubscribe() }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      fontFamily: "'IBM Plex Mono', monospace", background: '#fff',
    }}>
      <div style={{ fontSize: 13, color: '#000', letterSpacing: '0.08em' }}>
        Verifying your account…
      </div>
      <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.06em' }}>
        You will be redirected automatically
      </div>
    </div>
  )
}
