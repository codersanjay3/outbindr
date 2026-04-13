/**
 * /api/deliberate — Internal panelist reasoning.
 *
 * Each panelist privately "thinks through" what they've heard before speaking
 * publicly. This response is added to the shared history so all panelists can
 * build on each other's reasoning, but it is NEVER shown to or spoken to the user.
 * Higher token budget than the public /api/simulate endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createTextClient } from '@/lib/ai-client'
import type { Panelist, Message } from '@/lib/types'

export async function POST(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries())
  const client = createTextClient(headers)

  const {
    panelist,
    allPanelists,
    ideaText,
    history,
    round,
    totalRounds,
    pitchDeckText,
  }: {
    panelist: Panelist
    allPanelists: Panelist[]
    ideaText: string
    history: Message[]
    round: number
    totalRounds: number
    pitchDeckText?: string
  } = await req.json()

  const others = allPanelists
    .filter(p => p.name !== panelist.name)
    .map(p => `${p.name} (${p.role})`)
    .join(', ')

  const isLastRound = round === totalRounds - 1

  const system = `You are ${panelist.name}. ${panelist.role}

Fellow panelists: ${others}

This is your PRIVATE deliberation — not shown to the presenter. Be frank and strategic.

In 3-5 sentences address:
1. Your honest gut reaction to the pitch and the presenter's answers so far.
2. What one of your fellow panelists said that you agree with or want to push back on.
3. The exact angle you plan to probe in your upcoming public statement.
${isLastRound ? '4. Your tentative verdict (invest / pass / conditional) and why.' : ''}`

  const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = []

  for (const m of history) {
    msgs.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }

  const deckSnippet = pitchDeckText
    ? `\n\nPitch deck context:\n${pitchDeckText.slice(0, 1500)}`
    : ''

  const context = ideaText
    ? `Pitch summary:\n${ideaText.slice(0, 800)}${deckSnippet}`
    : `Review the transcript above.${deckSnippet}`

  msgs.push({ role: 'user', content: `${context}\n\nShare your internal deliberation now.` })

  try {
    // 300 tokens — richer internal reasoning, never shown to user
    const deliberation = await client.createMessage(system, msgs, 300)
    return NextResponse.json({ deliberation })
  } catch (err) {
    console.error('deliberate error:', err)
    return NextResponse.json({ deliberation: '' })
  }
}
