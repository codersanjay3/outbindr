'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { syncKeysFromAccount } from '@/lib/keys'
import LandingPage from '@/components/LandingPage'
import Dashboard from '@/components/Dashboard'
import PitchWars from '@/components/PitchWars'

type View = 'landing' | 'dashboard' | 'new-session'

export default function Home() {
  const [view, setView] = useState<View>('landing')
  const [checking, setChecking] = useState(true)

  // On mount: read the locally-stored session.
  // getSession() only reads localStorage — no network call, no auth events.
  // Navigation is NEVER driven by onAuthStateChange to avoid race conditions
  // where Supabase fires SIGNED_OUT immediately after SIGNED_IN.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setView('dashboard')
        syncKeysFromAccount().catch(() => {})
      }
      setChecking(false)
    })
  }, [])

  if (checking) return null

  if (view === 'landing') {
    return (
      <LandingPage
        onEnterApp={() => {
          setView('dashboard')
        }}
      />
    )
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        onStartNew={() => setView('new-session')}
      />
    )
  }

  if (view === 'new-session') {
    return (
      <PitchWars
        onBackToDashboard={() => setView('dashboard')}
      />
    )
  }

  return null
}
