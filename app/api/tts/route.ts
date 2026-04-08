import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const elevenLabsKey = req.headers.get('x-elevenlabs-key')
  if (!elevenLabsKey) {
    return NextResponse.json({ error: 'x-elevenlabs-key header required' }, { status: 400 })
  }

  const { text, voiceId } = await req.json() as { text: string; voiceId: string }
  if (!text || !voiceId) {
    return NextResponse.json({ error: 'text and voiceId required' }, { status: 400 })
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    }
  )

  if (!response.ok) {
    const msg = await response.text()
    console.error('ElevenLabs error:', msg)
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }

  return new Response(response.body, {
    headers: { 'Content-Type': 'audio/mpeg' },
  })
}
