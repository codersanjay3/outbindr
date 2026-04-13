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
    pitchDeckText,
  }: {
    panelist: Panelist
    allPanelists: Panelist[]
    ideaText: string
    history: Message[]
    round: number
    totalRounds: number
    isFirst: boolean
    pitchDeckText?: string
  } = await req.json()

  const othersDesc = allPanelists
    .filter(p => p.name !== panelist.name)
    .map(p => `- ${p.name}: ${p.role}`)
    .join('\n')

  const isLastRound = round === totalRounds - 1

  // Tight prompt: 2-3 sentences + 1 question, nothing more
  const deckContext = pitchDeckText
    ? `\n\nSUPPORTING PITCH DECK:\n${pitchDeckText.slice(0, 2000)}`
    : ''

  const system = `You are ${panelist.name}. ${panelist.role}${deckContext}

Panel peers:
${othersDesc}

RULES — follow exactly:
1. Make 1-2 sharp observations about the pitch. Be direct and specific.
2. Reference another panelist by name if you're agreeing or pushing back.
3. End with exactly ONE question for the presenter. Make it pointed.
4. Total response: 2-3 short sentences + the question. NO MORE.
5. Stay in character. No meta-commentary.
${isLastRound
  ? '6. FINAL ROUND: After your question, give a one-sentence verdict: approve / reject / conditional.'
  : ''}`

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (!isFirst) {
    messages.push({
      role: 'user',
      content: ideaText
        ? `Pitch summary:\n${ideaText.slice(0, 800)}\n\n[Panel continues]`
        : '[Panel continues]',
    })
    messages.push({ role: 'assistant', content: 'Understood.' })
  }

  for (const msg of history) {
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
  }

  const userMsg = isFirst && ideaText
    ? `Submitted pitch:\n\n---\n${ideaText.slice(0, 1200)}\n---\n\nBegin.`
    : 'Your turn.'

  messages.push({ role: 'user', content: userMsg })

  // 130 tokens max — keeps responses tight and snappy
  const stream = await client.streamMessage(system, messages, 130)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
