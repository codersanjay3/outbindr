'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './AudioPitchRecorder.module.css'

interface Props {
  groqKey: string
  onTranscript: (text: string) => void
}

export default function AudioPitchRecorder({ groqKey, onTranscript }: Props) {
  const [phase, setPhase]       = useState<'idle' | 'recording' | 'processing' | 'done'>('idle')
  const [liveText, setLiveText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError]       = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef   = useRef<any>(null)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      mediaRecorderRef.current?.stop()
    }
  }, [])

  const startRecording = async () => {
    setError('')
    setLiveText('')
    setFinalText('')
    chunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access denied. Allow mic permissions and try again.')
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.start(250)

    // Live interim transcription via Web Speech (for display only — Whisper does final)
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognitionRef.current = recognition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = ''
        let finals  = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finals += event.results[i][0].transcript + ' '
          else interim += event.results[i][0].transcript
        }
        setLiveText(prev => {
          const base = prev.replace(/\s*\[.*?\]\s*$/, '') + finals
          return interim ? base + '[' + interim + ']' : base
        })
      }
      recognition.start()
    }

    setPhase('recording')
  }

  const stopRecording = async () => {
    recognitionRef.current?.stop()
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    setPhase('processing')

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
      recorder.stream.getTracks().forEach(t => t.stop())
    })

    const mimeType = chunksRef.current[0]?.type ?? 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    const ext  = mimeType.includes('ogg') ? 'ogg' : 'webm'

    if (!groqKey) {
      // No Groq key — use whatever Web Speech captured
      const text = liveText.replace(/\[.*?\]/g, '').trim()
      setFinalText(text)
      setPhase('done')
      onTranscript(text)
      return
    }

    try {
      const formData = new FormData()
      formData.append('audio', new File([blob], `pitch.${ext}`, { type: mimeType }))
      const res  = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-groq-key': groqKey },
        body: formData,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFinalText(data.transcript)
      setPhase('done')
      onTranscript(data.transcript)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError('Transcription failed: ' + msg)
      setPhase('idle')
    }
  }

  const reset = () => {
    setPhase('idle')
    setLiveText('')
    setFinalText('')
    setError('')
  }

  return (
    <div className={styles.wrap}>
      {phase === 'idle' && (
        <div className={styles.idleState}>
          <button className={styles.recordBtn} onClick={startRecording} aria-label="Start recording">
            <span className={styles.recordDot} />
          </button>
          <span className={styles.recordLabel}>TAP TO RECORD</span>
        </div>
      )}

      {phase === 'recording' && (
        <div className={styles.recordingState}>
          <div className={styles.waveRow}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={styles.bar}
                style={{ animationDelay: `${i * 60}ms`, animationDuration: `${0.6 + (i % 4) * 0.12}s` }}
              />
            ))}
          </div>

          <div className={styles.liveText}>
            {liveText || <span className={styles.listening}>LISTENING…</span>}
          </div>

          <button className={styles.stopBtn} onClick={stopRecording} aria-label="Stop recording">
            <span className={styles.stopSquare} />
            <span>STOP</span>
          </button>
        </div>
      )}

      {phase === 'processing' && (
        <div className={styles.processingState}>
          <div className={styles.spinner} />
          <span>TRANSCRIBING WITH WHISPER…</span>
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.doneState}>
          <div className={styles.doneHeader}>
            <span className={styles.doneTag}>TRANSCRIPT</span>
            <button className={styles.resetBtn} onClick={reset}>RE-RECORD</button>
          </div>
          <div className={styles.transcript}>{finalText}</div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
