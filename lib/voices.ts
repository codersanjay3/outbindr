// ElevenLabs voice IDs — each panelist gets a distinctly different voice
export const ELEVENLABS_VOICES = [
  'pNInz6obpgDQGcFmaJgB', // Adam   – deep, authoritative male
  'EXAVITQu4vr4xnSDxMaL', // Bella  – warm, measured female
  'AZnzlk1XvdvUeBnXmlld', // Domi   – strong, assertive female
  'MF3mGyEYCl7XYWbV9V6O', // Elli   – bright, energetic female
  'TxGEqnHWrfWFTfGW9XjX', // Josh   – casual, upbeat male
  'VR6AewLTigWG4xSOukaG', // Arnold – gravelly, seasoned male
]

// Browser Web Speech API fallback voice names
export const WEB_SPEECH_VOICES = [
  'Google US English',
  'Google UK English Female',
  'Google UK English Male',
  'Alex',
  'Victoria',
  'Daniel',
]

// Pitch + rate per slot so every panelist sounds distinct in web speech fallback
export const WEB_SPEECH_PARAMS: { pitch: number; rate: number }[] = [
  { pitch: 0.85, rate: 0.92 }, // Slow, deep
  { pitch: 1.25, rate: 1.05 }, // High, slightly faster
  { pitch: 1.0,  rate: 0.88 }, // Normal pitch, deliberate pace
  { pitch: 1.35, rate: 1.12 }, // Brightest, quickest
  { pitch: 0.78, rate: 1.0  }, // Deepest, even
  { pitch: 1.1,  rate: 0.95 }, // Slightly high, measured
]

export function voiceForIndex(i: number) {
  const idx = i % ELEVENLABS_VOICES.length
  return {
    voiceId: ELEVENLABS_VOICES[idx],
    webSpeechVoice: WEB_SPEECH_VOICES[idx],
    webSpeechPitch: WEB_SPEECH_PARAMS[idx].pitch,
    webSpeechRate:  WEB_SPEECH_PARAMS[idx].rate,
  }
}
