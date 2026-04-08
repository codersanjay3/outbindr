/** Speak text via ElevenLabs (proxied through /api/tts). Resolves when audio finishes. */
async function speakWithElevenLabs(
  text: string,
  voiceId: string,
  elevenLabsKey: string
): Promise<void> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-elevenlabs-key': elevenLabsKey,
    },
    body: JSON.stringify({ text, voiceId }),
  })
  if (!res.ok) throw new Error('ElevenLabs TTS failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  return new Promise((resolve) => {
    const audio = new Audio(url)
    audio.onended = () => { URL.revokeObjectURL(url); resolve() }
    audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
    audio.play().catch(() => resolve())
  })
}

/** Speak text via browser SpeechSynthesis. Resolves when utterance ends. */
function speakWithWebSpeech(text: string, voiceName: string): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = speechSynthesis.getVoices()
    const voice = voices.find(v => v.name === voiceName)
    if (voice) utterance.voice = voice
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    speechSynthesis.speak(utterance)
  })
}

/**
 * Speak a sentence. Uses ElevenLabs if key provided, falls back to Web Speech API.
 * Always resolves (never rejects) — the simulation loop must not break on TTS failure.
 */
export async function speakSentence(
  text: string,
  voiceId: string,
  webSpeechVoice: string,
  elevenLabsKey: string | null
): Promise<void> {
  if (!text.trim()) return
  try {
    if (elevenLabsKey) {
      await speakWithElevenLabs(text, voiceId, elevenLabsKey)
    } else {
      await speakWithWebSpeech(text, webSpeechVoice)
    }
  } catch {
    try { await speakWithWebSpeech(text, webSpeechVoice) } catch { /* silent fallback */ }
  }
}

/**
 * Extract complete sentences from a streaming text buffer.
 * Returns sentences found and the remaining incomplete fragment.
 */
export function extractCompleteSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentenceEnd = /[.!?]+(?:\s|$)/g
  const sentences: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = sentenceEnd.exec(buffer)) !== null) {
    sentences.push(buffer.slice(lastIndex, match.index + match[0].length).trim())
    lastIndex = match.index + match[0].length
  }

  return { sentences, remainder: buffer.slice(lastIndex) }
}
