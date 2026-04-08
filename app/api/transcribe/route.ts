import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export async function POST(req: NextRequest) {
  const groqKey = req.headers.get('x-groq-key')
  if (!groqKey) {
    return NextResponse.json({ error: 'x-groq-key header required for transcription' }, { status: 400 })
  }

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) {
    return NextResponse.json({ error: 'No audio file in request' }, { status: 400 })
  }

  try {
    const client = new Groq({ apiKey: groqKey })
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: 'whisper-large-v3',
      response_format: 'json',
    })
    return NextResponse.json({ transcript: transcription.text })
  } catch (err) {
    console.error('transcribe error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
