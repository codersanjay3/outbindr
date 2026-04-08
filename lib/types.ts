export interface Panelist {
  name: string
  role: string
  avatar: string
  color: string
  bg: string
  bd: string
  voiceId: string
  webSpeechVoice: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  speaker?: string
  round?: number
}

export interface VerdictMember {
  name: string
  score: number
  summary: string
  keyQuotes: string[]
  stance: 'approve' | 'reject' | 'conditional'
}

export interface Verdict {
  overall: number
  verdict: string
  members: VerdictMember[]
  strengths: string[]
  concerns: string[]
  recommendations: string[]
}

export interface SimConfig {
  panelists: Panelist[]
  rounds: number
  panelDocName: string
  ideaDocName: string
}
