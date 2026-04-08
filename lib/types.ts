export interface Panelist {
  name: string
  role: string
  avatar: string
  color: string
  bg: string
  bd: string
  voiceId: string
  webSpeechVoice: string
  webSpeechPitch: number
  webSpeechRate: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  speaker?: string
  round?: number
}

/* ── Universal Panel Evaluation Report ── */

export interface CoreCriterion {
  score: number   // 1–5
  notes: string
}

export interface CaseSpecificCriterion {
  name: string
  weight: number  // percentage, criteria weights sum to 25
  score: number   // 1–5
  notes: string
}

export interface Verdict {
  /** CORE EVALUATION — 75 pts total */
  core: {
    communicationSkills:    CoreCriterion   // 15%
    criticalThinking:       CoreCriterion   // 15%
    subjectMastery:         CoreCriterion   // 15%
    confidencePresence:     CoreCriterion   // 10%
    adaptability:           CoreCriterion   // 10%
    composureUnderPressure: CoreCriterion   // 10%
    authenticity:           CoreCriterion   //  5%
    engagementInteraction:  CoreCriterion   //  5%
    problemSolvingAbility:  CoreCriterion   // 10%
    overallImpact:          CoreCriterion   //  5%
  }

  /** CASE-SPECIFIC EVALUATION — 25 pts total */
  caseSpecific: {
    justification:      string
    contextPerformance: string
    criteria:           CaseSpecificCriterion[]
  }

  /** FINAL SUMMARY */
  summary: {
    topStrengths:        string[]
    areasForImprovement: string[]
    standoutMoment:      string
    biggestRisk:         string
  }

  /** SCORES */
  coreScore:         number   // out of 75
  caseSpecificScore: number   // out of 25
  totalScore:        number   // out of 100

  /** RECOMMENDATION TIER */
  recommendation: 'exceptional' | 'strong' | 'competitive' | 'average' | 'below'
}

export interface SimConfig {
  panelists:          Panelist[]
  rounds:             number
  panelDocName:       string
  ideaDocName:        string
  sessionName?:       string   // user-provided session title
  sessionDescription?: string  // user-provided description
}
