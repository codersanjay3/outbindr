import { NextRequest, NextResponse } from 'next/server'
import { guardRequest } from '@/lib/api-guard'
import { createTextClient } from '@/lib/ai-client'
import type { Message, Panelist } from '@/lib/types'

export async function POST(req: NextRequest) {
  const guard = guardRequest(req)
  if (guard) return guard

  try {
    const headers = Object.fromEntries(req.headers.entries())
    const client = createTextClient(headers)

    const { panelists, history, round, totalRounds } = await req.json() as {
      panelists: Panelist[]
      history: Message[]
      round: number
      totalRounds: number
    }

    const panelNames = panelists.map(p => p.name).join(', ')
    const recentHistory = history.slice(-12)

    const SYSTEM = `You are the collective voice of a judging panel (${panelNames}).
After each round of deliberation, the panel collaborates to ask 2-4 rapid-fire follow-up questions to dig deeper into the presenter's answers.
These questions should:
- Be brief and punchy (max 15 words each)
- Reference something specific the presenter just said
- Come from different panelists, alternating voices
- Push for specifics: numbers, timelines, competitors, risks, evidence
- NOT repeat questions already asked
This is round ${round + 1} of ${totalRounds}. Keep it conversational and sharp.`

    const userMsg = `Based on the conversation so far, generate 2-4 rapid-fire follow-up questions from the panel.
Respond with ONLY a JSON array of objects: [{"panelist":"Name","question":"Question text"}]
No markdown, no explanation, just raw JSON.`

    const text = await client.createMessage(
      SYSTEM,
      [
        ...recentHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: userMsg },
      ],
      250,
    )

    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean) as { panelist: string; question: string }[]

    // Enrich with panelist metadata for display
    const questions = parsed.slice(0, 4).map(q => {
      const p = panelists.find(x => x.name === q.panelist) ?? panelists[0]
      return {
        panelist: p.name,
        avatar:   p.avatar,
        color:    p.color,
        question: q.question,
      }
    })

    return NextResponse.json({ questions })
  } catch (err) {
    console.error('rapid-fire error:', err)
    return NextResponse.json({ error: 'Failed to generate rapid-fire questions' }, { status: 500 })
  }
}
