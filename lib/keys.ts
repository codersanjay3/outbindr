import { supabase } from './supabase'

export const KEY_NAMES = {
  groq:       'ob_groq_key',
  elevenlabs: 'ob_elevenlabs_key',
} as const

export interface StoredKeys {
  groq:       string
  elevenlabs: string
}

export function loadKeys(): StoredKeys {
  if (typeof window === 'undefined') return { groq: '', elevenlabs: '' }
  return {
    groq:       localStorage.getItem(KEY_NAMES.groq)       ?? '',
    elevenlabs: localStorage.getItem(KEY_NAMES.elevenlabs) ?? '',
  }
}

export function saveKeys(keys: Partial<StoredKeys>): void {
  if (typeof window === 'undefined') return
  if (keys.groq       !== undefined) localStorage.setItem(KEY_NAMES.groq,       keys.groq)
  if (keys.elevenlabs !== undefined) localStorage.setItem(KEY_NAMES.elevenlabs, keys.elevenlabs)
}

/** Persist keys to Supabase user_metadata so they survive across devices */
export async function saveKeysToAccount(keys: StoredKeys): Promise<void> {
  await supabase.auth.updateUser({
    data: { ob_groq_key: keys.groq, ob_elevenlabs_key: keys.elevenlabs },
  })
}

/** Load keys from Supabase user_metadata. Returns null if not logged in or no keys stored. */
export async function loadKeysFromAccount(): Promise<StoredKeys | null> {
  const { data } = await supabase.auth.getUser()
  const meta = data?.user?.user_metadata
  if (!meta) return null
  const groq       = (meta.ob_groq_key as string)       ?? ''
  const elevenlabs = (meta.ob_elevenlabs_key as string) ?? ''
  if (!groq && !elevenlabs) return null
  return { groq, elevenlabs }
}

/** Pull account keys into localStorage (called after login). */
export async function syncKeysFromAccount(): Promise<void> {
  try {
    const accountKeys = await loadKeysFromAccount()
    if (!accountKeys) return
    // Only write if local is empty — don't overwrite newer local keys
    const local = loadKeys()
    const merged: StoredKeys = {
      groq:       local.groq       || accountKeys.groq,
      elevenlabs: local.elevenlabs || accountKeys.elevenlabs,
    }
    saveKeys(merged)
  } catch {
    // Non-fatal — ignore
  }
}

export function hasTextKey(keys: StoredKeys): boolean {
  return !!keys.groq
}

export function apiHeaders(keys: StoredKeys): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (keys.groq)       h['x-groq-key']       = keys.groq
  if (keys.elevenlabs) h['x-elevenlabs-key']  = keys.elevenlabs
  return h
}
