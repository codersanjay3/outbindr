export const KEY_NAMES = {
  anthropic: 'pw_anthropic_key',
  groq: 'pw_groq_key',
  elevenlabs: 'pw_elevenlabs_key',
} as const

export interface StoredKeys {
  anthropic: string
  groq: string
  elevenlabs: string
}

export function loadKeys(): StoredKeys {
  if (typeof window === 'undefined') return { anthropic: '', groq: '', elevenlabs: '' }
  return {
    anthropic: localStorage.getItem(KEY_NAMES.anthropic) ?? '',
    groq: localStorage.getItem(KEY_NAMES.groq) ?? '',
    elevenlabs: localStorage.getItem(KEY_NAMES.elevenlabs) ?? '',
  }
}

export function saveKeys(keys: Partial<StoredKeys>): void {
  if (typeof window === 'undefined') return
  if (keys.anthropic !== undefined) localStorage.setItem(KEY_NAMES.anthropic, keys.anthropic)
  if (keys.groq !== undefined) localStorage.setItem(KEY_NAMES.groq, keys.groq)
  if (keys.elevenlabs !== undefined) localStorage.setItem(KEY_NAMES.elevenlabs, keys.elevenlabs)
}

export function hasTextKey(keys: StoredKeys): boolean {
  return !!(keys.anthropic || keys.groq)
}

export function apiHeaders(keys: StoredKeys): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (keys.anthropic) h['x-anthropic-key'] = keys.anthropic
  if (keys.groq) h['x-groq-key'] = keys.groq
  if (keys.elevenlabs) h['x-elevenlabs-key'] = keys.elevenlabs
  return h
}
