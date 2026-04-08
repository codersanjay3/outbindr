import { NextRequest, NextResponse } from 'next/server'
import { createTextClient } from '@/lib/ai-client'
import type { Panelist, Message } from '@/lib/types'

export async function POST(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries())
  const client = createTextClient(headers)

  const { panelists, history }: { panelists: Panelist[]; history: Message[] } = await req.json()

  const names = panelists.map(p => p.name).join(', ')
  const transcript = history.map(m => `${m.speaker ?? m.role}: ${m.content}`).join('\n\n')

  const raw = await client.createMessage(
    `You are a neutral session coordinator generating a structured verdict for a panel evaluation.
Respond ONLY with raw JSON — no markdown, no backticks.
Format exactly:
{
  "overall": <number 0-100>,
  "verdict": "<2-3 sentence collective verdict>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "concerns": ["<concern 1>", "<concern 2>", "<concern 3>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"],
  "members": [
    {
      "name": "<panelist name>",
      "score": <0-100>,
      "summary": "<one sentence from this panelist perspective>",
      "keyQuotes": ["<direct quote from transcript>", "<direct quote from transcript>"],
      "stance": "<approve|reject|conditional>"
    }
  ]
}
Base scores on strength of the idea, quality of arguments, and how well objections were addressed.`,
    [{
      role: 'user',
      content: `Panel members: ${names}\n\nFull transcript:\n${transcript}\n\nGenerate the final verdict JSON.`
    }],
    900
  )

  try {
    const verdict = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(verdict)
  } catch {
    return NextResponse.json({
      overall: 68,
      verdict: 'The panel engaged substantively with the submission.',
      strengths: ['Clear problem articulation', 'Credible team', 'Growing market'],
      concerns: ['Monetization unclear', 'Competitive moat thin', 'Timeline ambitious'],
      recommendations: ['Define revenue model', 'Identify key differentiators', 'Reduce scope for MVP'],
      members: panelists.map(p => ({
        name: p.name, score: 68,
        summary: 'Engaged critically with the submitted material.',
        keyQuotes: [],
        stance: 'conditional' as const,
      })),
    })
  }
}
