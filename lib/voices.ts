export const ELEVENLABS_VOICES = [
  'pNInz6obpgDQGcFmaJgB',
  'EXAVITQu4vr4xnSDxMaL',
  'AZnzlk1XvdvUeBnXmlld',
  'MF3mGyEYCl7XYWbV9V6O',
  'TxGEqnHWrfWFTfGW9XjX',
  'VR6AewLTigWG4xSOukaG',
]

export const WEB_SPEECH_VOICES = [
  'Google US English',
  'Google UK English Female',
  'Google UK English Male',
  'Alex',
  'Victoria',
  'Daniel',
]

export function voiceForIndex(i: number) {
  return {
    voiceId: ELEVENLABS_VOICES[i % ELEVENLABS_VOICES.length],
    webSpeechVoice: WEB_SPEECH_VOICES[i % WEB_SPEECH_VOICES.length],
  }
}
