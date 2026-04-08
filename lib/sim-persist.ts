/**
 * sim-persist.ts
 * Synchronous localStorage snapshots for mid-simulation persistence.
 *
 * localStorage is synchronous — it writes before the page unloads, unlike
 * fetch/Supabase which are killed mid-flight by the browser on tab close.
 * We use this as a reliable backup alongside the Supabase 10-second saves.
 */
import type { SimConfig, Message } from './types'

export interface SimSnapshot {
  sessionId: string
  history:   Message[]
  round:     number
  config:    SimConfig
  ideaText:  string
  savedAt:   number   // Date.now() timestamp
}

function key(sessionId: string) { return `ob_sim_${sessionId}` }

/** Save a snapshot synchronously — safe to call in beforeunload. */
export function saveSimSnapshot(snap: SimSnapshot): void {
  try {
    localStorage.setItem(key(snap.sessionId), JSON.stringify(snap))
  } catch { /* quota exceeded — silent fail */ }
}

/** Load the most recent snapshot for a session, or null if none. */
export function loadSimSnapshot(sessionId: string): SimSnapshot | null {
  try {
    const raw = localStorage.getItem(key(sessionId))
    if (!raw) return null
    return JSON.parse(raw) as SimSnapshot
  } catch { return null }
}

/** Remove the snapshot (call after successfully resuming). */
export function clearSimSnapshot(sessionId: string): void {
  try { localStorage.removeItem(key(sessionId)) } catch { /* noop */ }
}
