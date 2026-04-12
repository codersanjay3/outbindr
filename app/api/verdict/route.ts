/**
 * /api/verdict — Universal Panel Evaluation Report
 *
 * Evaluates the PRESENTER's performance based on their answers across all rounds.
 * Uses the Universal Panel Evaluation rubric: 75% core + 25% case-specific.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createTextClient } from '@/lib/ai-client'
import type { Panelist, Message } from '@/lib/types'

export async function POST(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries())
  const client = createTextClient(headers)

  const {
    panelists,
    history,
  }: {
    panelists: Panelist[]
    history: Message[]
  } = await req.json()

  // Panel questions (public panelist messages only)
  const panelQuestions = history
    .filter(m => m.role === 'assistant' && !m.content.startsWith('[Internal'))
    .map(m => `${m.speaker ?? 'Panelist'} (Round ${(m.round ?? 0) + 1}): ${m.content.slice(0, 400)}`)
    .join('\n\n')

  // Presenter answers only
  const presenterAnswers = history
    .filter(m => m.role === 'user' && m.speaker === 'You')
    .map(m => `Round ${(m.round ?? 0) + 1}: ${m.content}`)
    .join('\n\n')

  const system = `You are a panel of expert evaluators completing a Universal Panel Evaluation Report.
Evaluate the PRESENTER's performance based on how they answered the panel questions.

PANEL QUESTIONS ASKED:
${panelQuestions || '(no questions recorded)'}

PRESENTER'S ANSWERS:
${presenterAnswers || '(presenter did not provide answers — score accordingly)'}

=== UNIVERSAL PANEL EVALUATION RUBRIC ===

SCORING SCALE — use the full range honestly based on what was actually said:
  1 = Absent or completely failed to address
  2 = Weak — attempted but unconvincing or incoherent
  3 = Mediocre — passable but forgettable
  4 = Good — clear, confident, and persuasive
  5 = Outstanding — exceptional, memorable, best-in-class
IMPORTANT: Do NOT default to 3 as a safe middle ground. A presenter who gave strong, well-reasoned answers deserves 4s and 5s. Only assign 3 if their response was genuinely mediocre. Score honestly across the full 1–5 range. Strong presenters should regularly receive scores of 4 and 5, resulting in total scores of 80–100.

CORE EVALUATION (75 points total):
Score each criterion 1–5 (decimals allowed, e.g. 3.5).
Criteria and weights (must sum to 100%):
- communicationSkills    15%
- criticalThinking       15%
- subjectMastery         15%
- confidencePresence     10%
- adaptability           10%
- composureUnderPressure 10%
- authenticity            5%
- engagementInteraction   5%
- problemSolvingAbility  10%
- overallImpact           5%

FORMULA — compute exactly using this:
  coreScore = sum of [ (score / 5) × weight_as_decimal × 75 ] across all 10 core criteria
  Example: communicationSkills score 4.0 → (4.0/5) × 0.15 × 75 = 9.0 points

CASE-SPECIFIC EVALUATION (25 points total):
Choose 2–4 criteria relevant to this specific pitch/context. Weights must sum to exactly 25.
  caseSpecificScore = sum of [ (score / 5) × weight ] across all case criteria
  Example: criterion weight 12, score 4.0 → (4.0/5) × 12 = 9.6 points

totalScore = coreScore + caseSpecificScore  (max 100)
Keep all computed scores as precise decimals — do NOT round to whole numbers.

RECOMMENDATION TIERS: exceptional ≥90 / strong 75–89 / competitive 60–74 / average 45–59 / below <45

Return ONLY a single valid JSON object — no markdown, no commentary.
The numbers below are FORMAT EXAMPLES ONLY — your actual scores must honestly reflect the presenter's true performance. Do not anchor to these values.
{
  "core": {
    "communicationSkills":    {"score": 4.5, "notes": "..."},
    "criticalThinking":       {"score": 3.8, "notes": "..."},
    "subjectMastery":         {"score": 4.2, "notes": "..."},
    "confidencePresence":     {"score": 4.0, "notes": "..."},
    "adaptability":           {"score": 3.5, "notes": "..."},
    "composureUnderPressure": {"score": 4.1, "notes": "..."},
    "authenticity":           {"score": 4.8, "notes": "..."},
    "engagementInteraction":  {"score": 3.9, "notes": "..."},
    "problemSolvingAbility":  {"score": 4.3, "notes": "..."},
    "overallImpact":          {"score": 4.0, "notes": "..."}
  },
  "caseSpecific": {
    "justification": "Why these criteria were chosen for this context.",
    "contextPerformance": "How the presenter performed relative to this context.",
    "criteria": [
      {"name": "...", "weight": 12, "score": 4.2, "notes": "..."},
      {"name": "...", "weight": 13, "score": 3.7, "notes": "..."}
    ]
  },
  "summary": {
    "topStrengths":        ["...", "...", "..."],
    "areasForImprovement": ["...", "...", "..."],
    "standoutMoment": "...",
    "biggestRisk": "..."
  },
  "coreScore": 73.5,
  "caseSpecificScore": 21.0,
  "totalScore": 94.5,
  "recommendation": "exceptional"
}`

  try {
    const raw = await client.createMessage(
      system,
      [{ role: 'user', content: 'Generate the evaluation report JSON now.' }],
      1400
    )
    // Strip markdown fences, then extract the outermost JSON object
    const stripped = raw.replace(/```json|```/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')
    const verdict = JSON.parse(jsonMatch[0])
    return NextResponse.json(verdict)
  } catch (err) {
    console.error('verdict error:', err)
    const fallbackCriterion = { score: 3, notes: 'Unable to evaluate — insufficient session data.' }
    return NextResponse.json({
      core: {
        communicationSkills:    fallbackCriterion,
        criticalThinking:       fallbackCriterion,
        subjectMastery:         fallbackCriterion,
        confidencePresence:     fallbackCriterion,
        adaptability:           fallbackCriterion,
        composureUnderPressure: fallbackCriterion,
        authenticity:           fallbackCriterion,
        engagementInteraction:  fallbackCriterion,
        problemSolvingAbility:  fallbackCriterion,
        overallImpact:          fallbackCriterion,
      },
      caseSpecific: {
        justification: 'Evaluation could not be completed.',
        contextPerformance: '',
        criteria: [{ name: 'General Performance', weight: 25, score: 3, notes: '' }],
      },
      summary: {
        topStrengths:        ['Engaged with the panel'],
        areasForImprovement: ['More detailed answers needed'],
        standoutMoment: 'N/A',
        biggestRisk: 'Insufficient response data',
      },
      coreScore: 45,
      caseSpecificScore: 15,
      totalScore: 60,
      recommendation: 'average',
    })
  }
}
