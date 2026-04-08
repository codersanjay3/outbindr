// Module-level handles so we can cancel mid-sentence
let _audioEl: HTMLAudioElement | null = null
let _synthActive = false

/** Stop whatever TTS is currently playing. Safe to call at any time. */
export function cancelCurrentTTS(): void {
  if (_audioEl) {
    _audioEl.pause()
    _audioEl.src = ''
    _audioEl = null
  }
  if (_synthActive) {
    try { speechSynthesis.cancel() } catch { /* noop in SSR */ }
    _synthActive = false
  }
}

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
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  return new Promise(resolve => {
    const audio = new Audio(url)
    _audioEl = audio
    const cleanup = () => { URL.revokeObjectURL(url); _audioEl = null; resolve() }
    audio.onended = cleanup
    audio.onerror = cleanup
    audio.play().catch(cleanup)
  })
}

function speakWithWebSpeech(
  text: string,
  voiceName: string,
  pitch = 1.0,
  rate  = 1.0
): Promise<void> {
  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = speechSynthesis.getVoices()
    const match = voices.find(v => v.name === voiceName)
    if (match) utterance.voice = match
    utterance.pitch = pitch
    utterance.rate  = rate
    utterance.onend   = () => { _synthActive = false; resolve() }
    utterance.onerror = () => { _synthActive = false; resolve() }
    _synthActive = true
    speechSynthesis.speak(utterance)
  })
}

/**
 * Speak one sentence. Uses ElevenLabs if key is present, falls back to Web Speech.
 * Never rejects — a TTS error is silently recovered from.
 */
export async function speakSentence(
  text: string,
  voiceId: string,
  webSpeechVoice: string,
  elevenLabsKey: string | null,
  webSpeechPitch = 1.0,
  webSpeechRate  = 1.0
): Promise<void> {
  if (!text.trim()) return
  try {
    if (elevenLabsKey) {
      await speakWithElevenLabs(text, voiceId, elevenLabsKey)
    } else {
      await speakWithWebSpeech(text, webSpeechVoice, webSpeechPitch, webSpeechRate)
    }
  } catch {
    try {
      await speakWithWebSpeech(text, webSpeechVoice, webSpeechPitch, webSpeechRate)
    } catch { /* silent */ }
  }
}

/**
 * Split a streaming text buffer into complete sentences and a trailing remainder.
 */
export function extractCompleteSentences(buffer: string): {
  sentences: string[]
  remainder: string
} {
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
