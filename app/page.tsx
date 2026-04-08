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

  // On mount, check if user is already signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setView('dashboard')
        syncKeysFromAccount().catch(() => {})
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setView('dashboard')
        syncKeysFromAccount().catch(() => {})
      } else {
        setView('landing')
      }
    })
    return () => subscription.unsubscribe()
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
