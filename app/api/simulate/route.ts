import { NextRequest } from 'next/server'
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
    isFirst,
  }: {
    panelist: Panelist
    allPanelists: Panelist[]
    ideaText: string
    history: Message[]
    round: number
    totalRounds: number
    isFirst: boolean
  } = await req.json()

  const othersDesc = allPanelists
    .filter(p => p.name !== panelist.name)
    .map(p => `- ${p.name}: ${p.role}`)
    .join('\n')

  const isLastRound = round === totalRounds - 1

  const system = `You are ${panelist.name}. Your profile: ${panelist.role}

You are in a live panel evaluation. Other panelists:
${othersDesc}

RULES:
- Speak naturally as ${panelist.name}. 3–5 sentences max.
- Address other panelists by name when building on or pushing back on their points.
- Ask ONE sharp question directed at the presenter or a fellow panelist.
- Ground every comment in the actual pitch content — cite specifics.
- Stay fully in character. No meta-commentary.
- ${isLastRound
    ? 'FINAL ROUND. Give a clear decisive conclusion: approve, reject, or conditional approval with specific conditions.'
    : `Round ${round + 1} of ${totalRounds}. Surface new angles not yet explored.`
  }`

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (!isFirst) {
    messages.push({
      role: 'user',
      content: ideaText
        ? `Pitch summary:\n${ideaText.slice(0, 1500)}\n\n[Continuing panel discussion]`
        : '[Continuing panel discussion]',
    })
    messages.push({ role: 'assistant', content: 'Understood, continuing.' })
  }

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content })
  }

  const userMsg = isFirst && ideaText
    ? `Submitted pitch:\n\n---\n${ideaText}\n---\n\nBegin the panel evaluation.`
    : 'Continue the panel discussion.'

  messages.push({ role: 'user', content: userMsg })

  const stream = await client.streamMessage(system, messages, 350)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
