import { NextRequest, NextResponse } from 'next/server'
import { createTextClient } from '@/lib/ai-client'
import { voiceForIndex } from '@/lib/voices'

export async function POST(req: NextRequest) {
  try {
    const headers = Object.fromEntries(req.headers.entries())
    const client = createTextClient(headers)

    const formData = await req.formData()
    const file = formData.get('panel') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const SYSTEM = `You parse panel configuration documents into structured JSON.
Respond ONLY with a raw JSON array — no markdown, no backticks, no explanation.
Format: [{"name":"Name","role":"Role and behavioral description"}]
Extract every panelist/judge/reviewer you find. If the document describes a panel abstractly (e.g. "a 3-person VC panel"), invent appropriate names and roles that match the description.
Minimum 2, maximum 6 panelists.`

    let textContent: string

    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (isPdf) {
      const arrayBuffer = await file.arrayBuffer()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      const pdfData = await pdfParse(Buffer.from(arrayBuffer))
      textContent = await client.createMessage(
        SYSTEM,
        [{ role: 'user', content: `Parse this panel document:\n\n${pdfData.text}` }],
        1000
      )
    } else {
      const rawText = await file.text()
      textContent = await client.createMessage(
        SYSTEM,
        [{ role: 'user', content: `Parse this panel document:\n\n${rawText}` }],
        1000
      )
    }

    const clean = textContent.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    const AVATARS = ['🐺', '🦅', '🦊', '🐉', '🦁', '🦋']
    const COLORS  = ['#c04040', '#4060c0', '#50a040', '#c8962a', '#9040c0', '#40a0c0']
    const BG      = ['#1a0e0e', '#0e0e1a', '#0a1205', '#1a1007', '#120a1a', '#091215']
    const BD      = ['#3d1515', '#15153d', '#152515', '#3d2e10', '#2a1040', '#102a35']

    const panelists = parsed.slice(0, 6).map((p: { name: string; role: string }, i: number) => ({
      name: p.name,
      role: p.role,
      avatar: AVATARS[i],
      color: COLORS[i],
      bg: BG[i],
      bd: BD[i],
      ...voiceForIndex(i),
    }))

    return NextResponse.json({ panelists })
  } catch (err) {
    console.error('parse-panel error:', err)
    return NextResponse.json({ error: 'Failed to parse panel document' }, { status: 500 })
  }
}
