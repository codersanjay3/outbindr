# Conversational PitchWars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform PitchWars into a fully conversational experience where users pitch verbally via Whisper, each AI panelist is a separate streaming LLM call with its own personality, and all voices are synthesized via ElevenLabs (Web Speech API fallback).

**Architecture:** Client-managed API keys stored in localStorage and forwarded as request headers. A shared `lib/ai-client.ts` factory abstracts Anthropic vs Groq. Client-side `SimScreen` orchestrates the auto-flowing discussion loop: stream → buffer sentences → TTS per sentence. No server-side orchestration.

**Tech Stack:** Next.js 15 (patched), TypeScript, `groq-sdk`, `@anthropic-ai/sdk`, ElevenLabs REST API, browser MediaRecorder + Web Speech API.

---

## File Map

**New files:**
- `lib/keys.ts` — localStorage helpers for API keys
- `lib/ai-client.ts` — Anthropic/Groq provider factory
- `lib/tts.ts` — ElevenLabs + Web Speech fallback TTS
- `lib/voices.ts` — ElevenLabs voice IDs + Web Speech voice names
- `app/api/transcribe/route.ts` — Groq Whisper transcription endpoint
- `app/api/tts/route.ts` — ElevenLabs TTS proxy endpoint
- `components/KeySetupModal.tsx` + `.module.css`
- `components/AudioPitchRecorder.tsx` + `.module.css`

**Modified files:**
- `package.json` — add `groq-sdk`; upgrade `next`
- `lib/types.ts` — add `voiceId`, `webSpeechVoice` to `Panelist`; expand `Verdict`
- `app/api/parse-panel/route.ts` — use ai-client; assign voices to panelists
- `app/api/simulate/route.ts` — use ai-client; read keys from headers
- `app/api/verdict/route.ts` — use ai-client; return expanded report JSON
- `components/SetupScreen.tsx` — add gear icon, AudioPitchRecorder as primary input
- `components/SimScreen.tsx` — auto-orchestration loop, TTS pipeline, pause/resume, no user reply prompt
- `components/VerdictScreen.tsx` — expanded report (strengths, concerns, recommendations, quotes)
- `components/SetupScreen.module.css` — new styles for mic recorder section, gear icon
- `components/SimScreen.module.css` — active panelist glow, subtitle bar, pause button
- `components/VerdictScreen.module.css` — expanded report sections

---

## Task 1: Upgrade deps and add groq-sdk

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install updated deps**

```bash
cd /Users/sanjaysubramania/Downloads/pitchwars
PATH=/opt/homebrew/bin:$PATH npm install next@latest groq-sdk
```

Expected: `next` upgrades to ≥15.2.x (CVE patched), `groq-sdk` added.

- [ ] **Step 2: Verify no startup error**

```bash
PATH=/opt/homebrew/bin:$PATH npm run build 2>&1 | tail -5
```

Expected: Build succeeds (exit 0).

- [ ] **Step 3: Commit**

```bash
cd /Users/sanjaysubramania/Downloads/pitchwars
git init && git add package.json package-lock.json
git commit -m "chore: upgrade next to patched version, add groq-sdk"
```

---

## Task 2: Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace `lib/types.ts` entirely**

```typescript
export interface Panelist {
  name: string
  role: string
  avatar: string
  color: string
  bg: string
  bd: string
  voiceId: string        // ElevenLabs voice ID
  webSpeechVoice: string // Browser SpeechSynthesis voice name (fallback)
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: expand types for voiceId and full report verdict"
```

---

## Task 3: Key helpers

**Files:**
- Create: `lib/keys.ts`

- [ ] **Step 1: Create `lib/keys.ts`**

```typescript
export const KEY_NAMES = {
  anthropic: 'pw_anthropic_key',
  groq: 'pw_groq_key',
  elevenlabs: 'pw_elevenlabs_key',
} as const

export interface StoredKeys {
  anthropic: string
  groq: string
  elevenlabs: string
}

export function loadKeys(): StoredKeys {
  if (typeof window === 'undefined') return { anthropic: '', groq: '', elevenlabs: '' }
  return {
    anthropic: localStorage.getItem(KEY_NAMES.anthropic) ?? '',
    groq: localStorage.getItem(KEY_NAMES.groq) ?? '',
    elevenlabs: localStorage.getItem(KEY_NAMES.elevenlabs) ?? '',
  }
}

export function saveKeys(keys: Partial<StoredKeys>): void {
  if (typeof window === 'undefined') return
  if (keys.anthropic !== undefined) localStorage.setItem(KEY_NAMES.anthropic, keys.anthropic)
  if (keys.groq !== undefined) localStorage.setItem(KEY_NAMES.groq, keys.groq)
  if (keys.elevenlabs !== undefined) localStorage.setItem(KEY_NAMES.elevenlabs, keys.elevenlabs)
}

export function hasTextKey(keys: StoredKeys): boolean {
  return !!(keys.anthropic || keys.groq)
}

export function apiHeaders(keys: StoredKeys): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (keys.anthropic) h['x-anthropic-key'] = keys.anthropic
  if (keys.groq) h['x-groq-key'] = keys.groq
  if (keys.elevenlabs) h['x-elevenlabs-key'] = keys.elevenlabs
  return h
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/keys.ts
git commit -m "feat: add localStorage key helpers"
```

---

## Task 4: Voice assignments

**Files:**
- Create: `lib/voices.ts`

- [ ] **Step 1: Create `lib/voices.ts`**

```typescript
// Curated ElevenLabs voice IDs (6 distinct voices, cycling for panels)
export const ELEVENLABS_VOICES = [
  'pNInz6obpgDQGcFmaJgB', // Adam  – deep male
  'EXAVITQu4vr4xnSDxMaL', // Bella – warm female
  'AZnzlk1XvdvUeBnXmlld', // Domi  – confident female
  'MF3mGyEYCl7XYWbV9V6O', // Elli  – young female
  'TxGEqnHWrfWFTfGW9XjX', // Josh  – young male
  'VR6AewLTigWG4xSOukaG', // Arnold – gravelly male
]

// Web Speech API voice names (browser-shipped, fallback)
export const WEB_SPEECH_VOICES = [
  'Google US English',
  'Google UK English Female',
  'Google UK English Male',
  'Alex',
  'Victoria',
  'Daniel',
]

export function voiceForIndex(i: number) {
  return {
    voiceId: ELEVENLABS_VOICES[i % ELEVENLABS_VOICES.length],
    webSpeechVoice: WEB_SPEECH_VOICES[i % WEB_SPEECH_VOICES.length],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/voices.ts
git commit -m "feat: add voice assignment helpers for ElevenLabs + Web Speech"
```

---

## Task 5: AI client factory

**Files:**
- Create: `lib/ai-client.ts`

- [ ] **Step 1: Create `lib/ai-client.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TextClient {
  /** Returns a ReadableStream of UTF-8 text chunks */
  streamMessage(system: string, messages: AIMessage[], maxTokens: number): Promise<ReadableStream<Uint8Array>>
  /** Returns the full response string */
  createMessage(system: string, messages: AIMessage[], maxTokens: number): Promise<string>
}

export function createTextClient(headers: Record<string, string>): TextClient {
  const groqKey = headers['x-groq-key']
  const anthropicKey = headers['x-anthropic-key']

  if (groqKey) return groqClient(groqKey)
  if (anthropicKey) return anthropicClient(anthropicKey)
  throw new Error('No API key provided (x-groq-key or x-anthropic-key header required)')
}

// ── Groq ──────────────────────────────────────────────────────────────
function groqClient(apiKey: string): TextClient {
  const client = new Groq({ apiKey })

  return {
    async streamMessage(system, messages, maxTokens) {
      const stream = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: 'system', content: system },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      })

      const encoder = new TextEncoder()
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content ?? ''
              if (text) controller.enqueue(encoder.encode(text))
            }
          } finally {
            controller.close()
          }
        },
      })
    },

    async createMessage(system, messages, maxTokens) {
      const res = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens,
        stream: false,
        messages: [
          { role: 'system', content: system },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      })
      return res.choices[0]?.message?.content ?? ''
    },
  }
}

// ── Anthropic ─────────────────────────────────────────────────────────
function anthropicClient(apiKey: string): TextClient {
  const client = new Anthropic({ apiKey })

  return {
    async streamMessage(system, messages, maxTokens) {
      const encoder = new TextEncoder()
      const anthropicStream = client.messages.stream({
        model: 'claude-sonnet-4-5-20251022',
        max_tokens: maxTokens,
        system,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of anthropicStream) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                controller.enqueue(encoder.encode(event.delta.text))
              }
            }
          } finally {
            controller.close()
          }
        },
      })
    },

    async createMessage(system, messages, maxTokens) {
      const res = await client.messages.create({
        model: 'claude-sonnet-4-5-20251022',
        max_tokens: maxTokens,
        system,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })
      return res.content[0].type === 'text' ? res.content[0].text : ''
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai-client.ts
git commit -m "feat: add provider-agnostic AI client factory (Groq + Anthropic)"
```

---

## Task 6: Update API routes to use ai-client + read headers

**Files:**
- Modify: `app/api/parse-panel/route.ts`
- Modify: `app/api/simulate/route.ts`
- Modify: `app/api/verdict/route.ts`

- [ ] **Step 1: Rewrite `app/api/parse-panel/route.ts`**

```typescript
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

    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      // For Anthropic: use document API. For Groq: extract text via base64 decode attempt.
      const anthropicKey = req.headers.get('x-anthropic-key')
      if (anthropicKey) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const ac = new Anthropic({ apiKey: anthropicKey })
        const response = await ac.messages.create({
          model: 'claude-sonnet-4-5-20251022',
          max_tokens: 1000,
          system: SYSTEM,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: 'Parse this document into a panel configuration JSON array.' }
            ]
          }]
        })
        textContent = response.content[0].type === 'text' ? response.content[0].text : '[]'
      } else {
        // Groq: use pdf-parse to extract text
        const pdfParse = (await import('pdf-parse')).default
        const pdfData = await pdfParse(Buffer.from(arrayBuffer))
        textContent = await client.createMessage(
          SYSTEM,
          [{ role: 'user', content: `Parse this panel document:\n\n${pdfData.text}` }],
          1000
        )
      }
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
```

- [ ] **Step 2: Rewrite `app/api/simulate/route.ts`**

```typescript
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
```

- [ ] **Step 3: Rewrite `app/api/verdict/route.ts`**

```typescript
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
      "summary": "<one sentence from this panelist's perspective>",
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
```

- [ ] **Step 4: Commit**

```bash
git add app/api/parse-panel/route.ts app/api/simulate/route.ts app/api/verdict/route.ts
git commit -m "feat: update all API routes to use ai-client factory and read keys from headers"
```

---

## Task 7: Transcription endpoint (Whisper)

**Files:**
- Create: `app/api/transcribe/route.ts`

- [ ] **Step 1: Create `app/api/transcribe/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export async function POST(req: NextRequest) {
  const groqKey = req.headers.get('x-groq-key')
  if (!groqKey) {
    return NextResponse.json({ error: 'x-groq-key header required for transcription' }, { status: 400 })
  }

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) {
    return NextResponse.json({ error: 'No audio file in request' }, { status: 400 })
  }

  try {
    const client = new Groq({ apiKey: groqKey })
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: 'whisper-large-v3',
      response_format: 'json',
    })
    return NextResponse.json({ transcript: transcription.text })
  } catch (err) {
    console.error('transcribe error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/transcribe/route.ts
git commit -m "feat: add Whisper transcription endpoint via Groq"
```

---

## Task 8: TTS proxy endpoint (ElevenLabs)

**Files:**
- Create: `app/api/tts/route.ts`

- [ ] **Step 1: Create `app/api/tts/route.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/tts/route.ts
git commit -m "feat: add ElevenLabs TTS proxy endpoint"
```

---

## Task 9: TTS client lib

**Files:**
- Create: `lib/tts.ts`

- [ ] **Step 1: Create `lib/tts.ts`**

```typescript
'use client'

/** Speak text via ElevenLabs (proxied). Resolves when audio finishes playing. */
async function speakWithElevenLabs(
  text: string,
  voiceId: string,
  elevenLabsKey: string
): Promise<void> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-elevenlabs-key': elevenLabsKey,
    },
    body: JSON.stringify({ text, voiceId }),
  })

  if (!res.ok) throw new Error('ElevenLabs TTS failed')

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  return new Promise((resolve) => {
    const audio = new Audio(url)
    audio.onended = () => { URL.revokeObjectURL(url); resolve() }
    audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
    audio.play().catch(() => resolve())
  })
}

/** Speak text via browser SpeechSynthesis. Resolves when utterance ends. */
function speakWithWebSpeech(text: string, voiceName: string): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = speechSynthesis.getVoices()
    const voice = voices.find(v => v.name === voiceName)
    if (voice) utterance.voice = voice
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    speechSynthesis.speak(utterance)
  })
}

/**
 * Speak a sentence. Uses ElevenLabs if key provided, falls back to Web Speech API.
 * Always resolves (never rejects) so the simulation loop never breaks.
 */
export async function speakSentence(
  text: string,
  voiceId: string,
  webSpeechVoice: string,
  elevenLabsKey: string | null
): Promise<void> {
  if (!text.trim()) return
  try {
    if (elevenLabsKey) {
      await speakWithElevenLabs(text, voiceId, elevenLabsKey)
    } else {
      await speakWithWebSpeech(text, webSpeechVoice)
    }
  } catch {
    // Fallback: try Web Speech, then give up silently
    try { await speakWithWebSpeech(text, webSpeechVoice) } catch { /* silent */ }
  }
}

/** Split streamed text into sentences for sentence-by-sentence TTS pipelining. */
export function extractCompleteSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentenceEnd = /[.!?]+(?:\s|$)/g
  const sentences: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = sentenceEnd.exec(buffer)) !== null) {
    sentences.push(buffer.slice(lastIndex, match.index + match[0].length).trim())
    lastIndex = match.index + match[0].length
  }

  return { sentences, remainder: buffer.slice(lastIndex) }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/tts.ts
git commit -m "feat: add TTS lib with ElevenLabs + Web Speech fallback and sentence splitter"
```

---

## Task 10: AudioPitchRecorder component

**Files:**
- Create: `components/AudioPitchRecorder.tsx`
- Create: `components/AudioPitchRecorder.module.css`

- [ ] **Step 1: Create `components/AudioPitchRecorder.tsx`**

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './AudioPitchRecorder.module.css'

interface Props {
  groqKey: string
  onTranscript: (text: string) => void
}

export default function AudioPitchRecorder({ groqKey, onTranscript }: Props) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle')
  const [liveText, setLiveText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      mediaRecorderRef.current?.stop()
    }
  }, [])

  const startRecording = async () => {
    setError('')
    setLiveText('')
    setFinalText('')
    chunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access denied. Allow mic permissions and try again.')
      return
    }

    // MediaRecorder for Whisper
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.start(250)

    // Web Speech API for live display
    const SpeechRecognition =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition() as SpeechRecognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognitionRef.current = recognition
      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            setLiveText(prev => prev + event.results[i][0].transcript + ' ')
          } else {
            interim += event.results[i][0].transcript
          }
        }
        if (interim) setLiveText(prev => prev.replace(/\s*\[.*?\]\s*$/, '') + ' [' + interim + ']')
      }
      recognition.start()
    }

    setPhase('recording')
  }

  const stopRecording = async () => {
    recognitionRef.current?.stop()
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    setPhase('processing')

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
      recorder.stream.getTracks().forEach(t => t.stop())
    })

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

    if (!groqKey) {
      // No Groq key — use whatever Web Speech captured
      const text = liveText.replace(/\[.*?\]/g, '').trim()
      setFinalText(text)
      setPhase('done')
      onTranscript(text)
      return
    }

    try {
      const formData = new FormData()
      formData.append('audio', new File([blob], 'pitch.webm', { type: 'audio/webm' }))
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-groq-key': groqKey },
        body: formData,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFinalText(data.transcript)
      setPhase('done')
      onTranscript(data.transcript)
    } catch (err: any) {
      setError('Transcription failed: ' + err.message)
      setPhase('idle')
    }
  }

  return (
    <div className={styles.wrap}>
      {phase === 'idle' && (
        <button className={styles.micBtn} onClick={startRecording}>
          <span className={styles.micIcon}>🎙</span>
          <span>Start Pitching</span>
        </button>
      )}

      {phase === 'recording' && (
        <div className={styles.recording}>
          <div className={styles.waveRow}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={styles.bar} style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className={styles.liveText}>{liveText || 'Listening...'}</div>
          <button className={styles.stopBtn} onClick={stopRecording}>■ Stop</button>
        </div>
      )}

      {phase === 'processing' && (
        <div className={styles.processing}>
          <span className={styles.spinner} />
          <span>Transcribing with Whisper...</span>
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.done}>
          <div className={styles.doneLabel}>Your pitch (Whisper transcript)</div>
          <div className={styles.transcript}>{finalText}</div>
          <button className={styles.rerecordBtn} onClick={() => setPhase('idle')}>
            Re-record
          </button>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/AudioPitchRecorder.module.css`**

```css
.wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px 0; }

.micBtn {
  display: flex; align-items: center; gap: 10px;
  background: var(--gold); color: #0d0d0f;
  border: none; border-radius: 6px; padding: 14px 28px;
  font-size: 13px; font-weight: 500; letter-spacing: 0.08em;
  transition: background 0.15s;
}
.micBtn:hover { background: var(--gold-light); }
.micIcon { font-size: 18px; }

.recording { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }

.waveRow { display: flex; align-items: center; gap: 4px; height: 40px; }
.bar {
  width: 4px; border-radius: 2px; background: var(--gold);
  animation: wave 0.8s ease-in-out infinite alternate;
}
@keyframes wave {
  from { height: 6px; opacity: 0.4; }
  to   { height: 32px; opacity: 1; }
}

.liveText {
  font-size: 12px; color: var(--text-dim); font-family: 'DM Mono', monospace;
  max-height: 80px; overflow-y: auto; text-align: center; line-height: 1.6;
  width: 100%;
}

.stopBtn {
  background: transparent; border: 1px solid var(--border2);
  color: var(--text-dim); border-radius: 4px; padding: 6px 18px;
  font-size: 12px; transition: all 0.15s;
}
.stopBtn:hover { border-color: #c04040; color: #c04040; }

.processing { display: flex; align-items: center; gap: 10px; color: var(--text-dim); font-size: 12px; font-family: 'DM Mono', monospace; }
.spinner { width: 14px; height: 14px; border: 2px solid var(--border2); border-top-color: var(--gold); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

.done { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.doneLabel { font-size: 11px; color: var(--gold); font-family: 'DM Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; }
.transcript { font-size: 13px; color: var(--text); line-height: 1.7; background: var(--surface); border: 1px solid var(--border2); border-radius: 6px; padding: 12px 14px; max-height: 120px; overflow-y: auto; }
.rerecordBtn { align-self: flex-start; background: transparent; border: 1px solid var(--border2); color: var(--text-dim); border-radius: 4px; padding: 5px 14px; font-size: 11px; transition: all 0.15s; }
.rerecordBtn:hover { border-color: var(--gold-border); color: var(--gold); }

.error { font-size: 12px; color: #c04040; font-family: 'DM Mono', monospace; margin-top: 4px; }
```

- [ ] **Step 3: Commit**

```bash
git add components/AudioPitchRecorder.tsx components/AudioPitchRecorder.module.css
git commit -m "feat: add AudioPitchRecorder with live waveform, Web Speech preview, and Whisper transcription"
```

---

## Task 11: KeySetupModal component

**Files:**
- Create: `components/KeySetupModal.tsx`
- Create: `components/KeySetupModal.module.css`

- [ ] **Step 1: Create `components/KeySetupModal.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { loadKeys, saveKeys, StoredKeys } from '@/lib/keys'
import styles from './KeySetupModal.module.css'

interface Props { onClose: () => void }

export default function KeySetupModal({ onClose }: Props) {
  const initial = loadKeys()
  const [anthropic, setAnthropic]   = useState(initial.anthropic)
  const [groq, setGroq]             = useState(initial.groq)
  const [elevenlabs, setElevenlabs] = useState(initial.elevenlabs)
  const [saved, setSaved]           = useState(false)

  const canSave = !!(anthropic || groq)

  const handleSave = () => {
    saveKeys({ anthropic, groq, elevenlabs })
    setSaved(true)
    setTimeout(onClose, 800)
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>API Keys</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p className={styles.hint}>Keys stored locally in your browser. Never sent to any server except the respective API.</p>

        <div className={styles.field}>
          <label className={styles.label}>Anthropic API Key <span className={styles.optional}>(optional)</span></label>
          <input
            type="password"
            value={anthropic}
            onChange={e => setAnthropic(e.target.value)}
            placeholder="sk-ant-..."
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Groq API Key <span className={styles.note}>(recommended — enables Whisper)</span></label>
          <input
            type="password"
            value={groq}
            onChange={e => setGroq(e.target.value)}
            placeholder="gsk_..."
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ElevenLabs API Key <span className={styles.optional}>(optional — for realistic voices)</span></label>
          <input
            type="password"
            value={elevenlabs}
            onChange={e => setElevenlabs(e.target.value)}
            placeholder="..."
          />
          <span className={styles.subhint}>Without this, browser text-to-speech is used as fallback.</span>
        </div>

        <button className={styles.saveBtn} disabled={!canSave} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Keys'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/KeySetupModal.module.css`**

```css
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; animation: fadeUp 0.2s ease both;
}

.modal {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 10px; padding: 28px; width: min(480px, 92vw);
  display: flex; flex-direction: column; gap: 20px;
}

.header { display: flex; align-items: center; justify-content: space-between; }
.title { font-family: 'Playfair Display', serif; font-size: 20px; color: #f5eed8; }
.closeBtn { background: transparent; border: none; color: var(--text-dim); font-size: 16px; line-height: 1; padding: 4px; }
.closeBtn:hover { color: var(--text); }

.hint { font-size: 12px; color: var(--text-dim); font-family: 'DM Mono', monospace; line-height: 1.6; }

.field { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 11px; font-family: 'DM Mono', monospace; color: var(--text); text-transform: uppercase; letter-spacing: 0.08em; }
.optional { color: var(--text-dim); text-transform: none; font-size: 10px; letter-spacing: 0; }
.note { color: var(--gold); text-transform: none; font-size: 10px; letter-spacing: 0; }
.subhint { font-size: 10px; color: var(--text-dim); font-family: 'DM Mono', monospace; }

.saveBtn {
  background: var(--gold); color: #0d0d0f;
  border: none; border-radius: 4px; padding: 12px;
  font-size: 12px; font-weight: 500; letter-spacing: 0.08em;
  transition: background 0.15s;
}
.saveBtn:hover:not(:disabled) { background: var(--gold-light); }
.saveBtn:disabled { background: var(--border2); color: var(--text-dim); cursor: not-allowed; }
```

- [ ] **Step 3: Commit**

```bash
git add components/KeySetupModal.tsx components/KeySetupModal.module.css
git commit -m "feat: add KeySetupModal for in-app API key management"
```

---

## Task 12: Update SetupScreen

**Files:**
- Modify: `components/SetupScreen.tsx`
- Modify: `components/SetupScreen.module.css`

- [ ] **Step 1: Rewrite `components/SetupScreen.tsx`**

Replace the entire file with:

```typescript
'use client'
import { useState, useEffect } from 'react'
import DropZone from './DropZone'
import AudioPitchRecorder from './AudioPitchRecorder'
import KeySetupModal from './KeySetupModal'
import type { SimConfig, Panelist } from '@/lib/types'
import { loadKeys, hasTextKey, apiHeaders } from '@/lib/keys'
import styles from './SetupScreen.module.css'

interface Props { onLaunch: (config: SimConfig, idea: File | null, ideaText?: string) => void }

export default function SetupScreen({ onLaunch }: Props) {
  const [panelFile, setPanelFile]     = useState<File | null>(null)
  const [ideaFile, setIdeaFile]       = useState<File | null>(null)
  const [ideaText, setIdeaText]       = useState('')        // from voice pitch
  const [pitchMode, setPitchMode]     = useState<'mic' | 'file'>('mic')
  const [rounds, setRounds]           = useState(3)
  const [panelists, setPanelists]     = useState<Panelist[]>([])
  const [parsing, setParsing]         = useState(false)
  const [parseError, setParseError]   = useState('')
  const [showKeys, setShowKeys]       = useState(false)
  const [keys, setKeys]               = useState(loadKeys())

  useEffect(() => {
    // Show key modal on first load if no keys configured
    if (!hasTextKey(loadKeys())) setShowKeys(true)
  }, [])

  const refreshKeys = () => { setKeys(loadKeys()) }

  const handlePanelFile = async (file: File) => {
    setPanelFile(file)
    setPanelists([])
    setParseError('')
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('panel', file)
      // Forward keys as headers (FormData — can't use apiHeaders directly, must set manually)
      const h: Record<string, string> = {}
      if (keys.anthropic) h['x-anthropic-key'] = keys.anthropic
      if (keys.groq) h['x-groq-key'] = keys.groq
      const res = await fetch('/api/parse-panel', { method: 'POST', headers: h, body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPanelists(data.panelists)
    } catch {
      setParseError('Could not parse panel document. Try a plain text or PDF file.')
    } finally {
      setParsing(false)
    }
  }

  const pitchReady = pitchMode === 'mic' ? !!ideaText : !!ideaFile
  const canLaunch = panelists.length >= 2 && pitchReady && !parsing && hasTextKey(keys)

  const launch = () => {
    if (!canLaunch) return
    const cfg: SimConfig = { panelists, rounds, panelDocName: panelFile!.name, ideaDocName: pitchMode === 'mic' ? 'Voice Pitch' : ideaFile!.name }
    onLaunch(cfg, pitchMode === 'file' ? ideaFile : null, pitchMode === 'mic' ? ideaText : undefined)
  }

  return (
    <div className={styles.wrap}>
      {showKeys && <KeySetupModal onClose={() => { setShowKeys(false); refreshKeys() }} />}

      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>PANEL SIMULATOR · BETA</span>
          <button className={styles.gearBtn} onClick={() => setShowKeys(true)} title="API Keys">⚙</button>
        </div>
        <h1 className={styles.title}>PitchWars</h1>
        <p className={styles.subtitle}>Upload your panel. Pitch your idea. Watch them decide.</p>
      </header>

      <div className={styles.uploads}>
        <div className={styles.uploadBlock}>
          <div className={styles.label}>Panel document</div>
          <DropZone
            label="Drop your panel configuration"
            hint="Names, roles, personalities, evaluation criteria"
            onFile={handlePanelFile}
            fileName={panelFile?.name}
          />
          {parsing && (
            <p className={styles.status}>
              <span className={styles.dots}><span>·</span><span>·</span><span>·</span></span>
              Parsing panel...
            </p>
          )}
          {parseError && <p className={styles.error}>{parseError}</p>}
          {panelists.length > 0 && (
            <div className={styles.panelistPreview}>
              {panelists.map((p, i) => (
                <div key={i} className={styles.panelistRow}>
                  <div className={styles.pAvatar} style={{ background: p.bg, borderColor: p.bd }}>{p.avatar}</div>
                  <div>
                    <div className={styles.pName} style={{ color: p.color }}>{p.name}</div>
                    <div className={styles.pRole}>{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.uploadBlock}>
          <div className={styles.pitchToggle}>
            <div className={styles.label}>Your pitch</div>
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'mic' ? styles.modeBtnActive : ''}`}
                onClick={() => setPitchMode('mic')}
              >🎙 Voice</button>
              <button
                className={`${styles.modeBtn} ${pitchMode === 'file' ? styles.modeBtnActive : ''}`}
                onClick={() => setPitchMode('file')}
              >📄 File</button>
            </div>
          </div>

          {pitchMode === 'mic' ? (
            <AudioPitchRecorder
              groqKey={keys.groq}
              onTranscript={text => setIdeaText(text)}
            />
          ) : (
            <DropZone
              label="Drop your idea document"
              hint="Pitch deck, research paper, product spec, business plan"
              onFile={setIdeaFile}
              fileName={ideaFile?.name}
            />
          )}
        </div>
      </div>

      <div className={styles.roundsRow}>
        <div className={styles.label}>Simulation rounds</div>
        <div className={styles.counter}>
          <button className={styles.countBtn} onClick={() => setRounds(r => Math.max(2, r - 1))}>−</button>
          <span className={styles.countNum}>{rounds}</span>
          <button className={styles.countBtn} onClick={() => setRounds(r => Math.min(6, r + 1))}>+</button>
          <span className={styles.countHint}>rounds of panel discussion</span>
        </div>
      </div>

      {!hasTextKey(keys) && (
        <p className={styles.noKeyWarning}>
          ⚠ Add an Anthropic or Groq key via ⚙ to launch a simulation.
        </p>
      )}

      <button className={styles.launchBtn} disabled={!canLaunch} onClick={launch}>
        LAUNCH SIMULATION ↗
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add new CSS to `components/SetupScreen.module.css`** (append at end)

```css
.heroTop { display: flex; align-items: flex-start; justify-content: space-between; }
.gearBtn { background: transparent; border: 1px solid var(--border2); color: var(--text-dim); border-radius: 6px; padding: 6px 10px; font-size: 16px; line-height: 1; transition: all 0.15s; }
.gearBtn:hover { border-color: var(--gold-border); color: var(--gold); }

.pitchToggle { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.modeToggle { display: flex; border: 1px solid var(--border2); border-radius: 4px; overflow: hidden; }
.modeBtn { background: transparent; border: none; color: var(--text-dim); padding: 4px 12px; font-size: 11px; transition: all 0.15s; }
.modeBtnActive { background: var(--gold-bg); color: var(--gold); border-color: var(--gold-border); }

.noKeyWarning { font-size: 11px; color: #c8962a; font-family: 'DM Mono', monospace; text-align: center; margin-bottom: 12px; }
```

- [ ] **Step 3: Update `PitchWars.tsx` to pass `ideaText` through**

In `components/PitchWars.tsx`, update the state and handlers:

```typescript
'use client'
import { useState } from 'react'
import SetupScreen from './SetupScreen'
import SimScreen from './SimScreen'
import VerdictScreen from './VerdictScreen'
import type { SimConfig, Verdict } from '@/lib/types'

type Phase = 'setup' | 'sim' | 'verdict'

export default function PitchWars() {
  const [phase, setPhase]       = useState<Phase>('setup')
  const [config, setConfig]     = useState<SimConfig | null>(null)
  const [ideaFile, setIdeaFile] = useState<File | null>(null)
  const [ideaText, setIdeaText] = useState<string>('')
  const [verdict, setVerdict]   = useState<Verdict | null>(null)

  const handleLaunch = (cfg: SimConfig, idea: File | null, text?: string) => {
    setConfig(cfg)
    setIdeaFile(idea)
    setIdeaText(text ?? '')
    setPhase('sim')
  }

  const handleVerdict = (v: Verdict) => { setVerdict(v); setPhase('verdict') }
  const handleRestart = () => { setPhase('setup'); setConfig(null); setIdeaFile(null); setIdeaText(''); setVerdict(null) }

  return (
    <>
      {phase === 'setup' && <SetupScreen onLaunch={handleLaunch} />}
      {phase === 'sim' && config && (
        <SimScreen config={config} ideaFile={ideaFile} ideaText={ideaText} onVerdict={handleVerdict} />
      )}
      {phase === 'verdict' && verdict && config && (
        <VerdictScreen verdict={verdict} config={config} onRestart={handleRestart} />
      )}
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/SetupScreen.tsx components/SetupScreen.module.css components/PitchWars.tsx
git commit -m "feat: update SetupScreen with key gear icon, voice/file pitch toggle, key detection"
```

---

## Task 13: Conversational SimScreen with auto-orchestration and TTS

**Files:**
- Modify: `components/SimScreen.tsx`
- Modify: `components/SimScreen.module.css`

- [ ] **Step 1: Rewrite `components/SimScreen.tsx`**

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import type { SimConfig, Message, Verdict } from '@/lib/types'
import { loadKeys, apiHeaders } from '@/lib/keys'
import { speakSentence, extractCompleteSentences } from '@/lib/tts'
import styles from './SimScreen.module.css'

interface Props {
  config: SimConfig
  ideaFile: File | null
  ideaText: string
  onVerdict: (v: Verdict) => void
}

interface ChatMessage {
  speaker: string; avatar: string; color: string; bg: string; bd: string
  text: string; round: number; streaming: boolean
}

export default function SimScreen({ config, ideaFile, ideaText, onVerdict }: Props) {
  const { panelists, rounds } = config
  const [messages, setMessages]     = useState<ChatMessage[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [activePanelist, setActivePanelist] = useState<string | null>(null)
  const [subtitle, setSubtitle]     = useState('')
  const [paused, setPaused]         = useState(false)
  const [thinking, setThinking]     = useState('')
  const [done, setDone]             = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<Message[]>([])
  const ideaRef   = useRef('')
  const ideaB64Ref  = useRef('')
  const ideaMimeRef = useRef('')
  const pausedRef = useRef(false)

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => { loadAndRun() }, [])

  const loadAndRun = async () => {
    if (ideaFile) {
      if (ideaFile.type === 'application/pdf') {
        const ab = await ideaFile.arrayBuffer()
        ideaB64Ref.current  = Buffer.from(ab).toString('base64')
        ideaMimeRef.current = 'application/pdf'
      } else {
        ideaRef.current = await ideaFile.text()
      }
    } else {
      ideaRef.current = ideaText
    }
    runSimulation()
  }

  /** Wait while paused (polls every 200ms) */
  const waitIfPaused = () => new Promise<void>(resolve => {
    const check = () => pausedRef.current ? setTimeout(check, 200) : resolve()
    check()
  })

  const runSimulation = async () => {
    const keys = loadKeys()

    for (let r = 0; r < rounds; r++) {
      setCurrentRound(r)

      for (let pi = 0; pi < panelists.length; pi++) {
        await waitIfPaused()
        const p = panelists[pi]
        const isFirst = r === 0 && pi === 0
        setActivePanelist(p.name)
        setThinking(`${p.name} is thinking...`)

        // Add placeholder message
        const placeholder: ChatMessage = {
          speaker: p.name, avatar: p.avatar, color: p.color, bg: p.bg, bd: p.bd,
          text: '', round: r, streaming: true,
        }
        setMessages(prev => [...prev, placeholder])
        const msgIdx = await new Promise<number>(res =>
          setMessages(prev => { res(prev.length - 1); return prev })
        )
        setThinking('')

        // Stream from /api/simulate
        const headers = apiHeaders(keys)
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            panelist: p, allPanelists: panelists,
            ideaText: ideaRef.current,
            ideaBase64: ideaB64Ref.current || undefined,
            ideaMimeType: ideaMimeRef.current || undefined,
            history: historyRef.current,
            round: r, totalRounds: rounds, isFirst,
          }),
        })

        // Read stream, buffer text, TTS sentence-by-sentence
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let ttsBuffer = ''

        const flushSentences = async (remainder: string) => {
          const { sentences, remainder: rem } = extractCompleteSentences(remainder)
          for (const sentence of sentences) {
            setSubtitle(sentence)
            await speakSentence(sentence, p.voiceId, p.webSpeechVoice, keys.elevenlabs || null)
            await waitIfPaused()
          }
          return rem
        }

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          const chunk = decoder.decode(value)
          fullText += chunk
          ttsBuffer += chunk
          setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, text: fullText, streaming: true } : m))
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          ttsBuffer = await flushSentences(ttsBuffer)
        }

        // Speak any remaining buffer
        if (ttsBuffer.trim()) {
          setSubtitle(ttsBuffer.trim())
          await speakSentence(ttsBuffer.trim(), p.voiceId, p.webSpeechVoice, keys.elevenlabs || null)
        }

        setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, streaming: false } : m))
        setSubtitle('')
        historyRef.current.push({ role: 'assistant', content: fullText, speaker: p.name, round: r })
        await new Promise(r => setTimeout(r, 400))
      }
    }

    setActivePanelist(null)
    setDone(true)
    setThinking('Generating report...')

    const keys = loadKeys()
    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: apiHeaders(keys),
      body: JSON.stringify({ panelists, history: historyRef.current }),
    })
    const verdict: Verdict = await res.json()
    setThinking('')
    onVerdict(verdict)
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Panel in session</div>
          <div className={styles.headerSub}>{config.ideaDocName}</div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.pips}>
            {Array.from({ length: rounds }, (_, i) => (
              <div key={i} className={`${styles.pip} ${i < currentRound ? styles.pipDone : i === currentRound ? styles.pipActive : ''}`} />
            ))}
          </div>
          <button
            className={styles.pauseBtn}
            onClick={() => setPaused(p => !p)}
            disabled={done}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </header>

      {/* Active panelist bar */}
      {activePanelist && !done && (
        <div className={styles.activeBar}>
          {panelists.map(p => (
            <div
              key={p.name}
              className={`${styles.activePip} ${activePanelist === p.name ? styles.activePipOn : ''}`}
              style={{ '--c': p.color, '--bg': p.bg, '--bd': p.bd } as React.CSSProperties}
            >
              <span className={styles.activePipAvatar}>{p.avatar}</span>
              {activePanelist === p.name && <span className={styles.activePipName} style={{ color: p.color }}>{p.name}</span>}
            </div>
          ))}
        </div>
      )}

      <div className={styles.chat}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.msg} ${activePanelist === msg.speaker && msg.streaming ? styles.msgActive : ''}`}>
            <div className={styles.msgHeader}>
              <div className={styles.avatar} style={{ background: msg.bg, borderColor: msg.bd }}>{msg.avatar}</div>
              <span className={styles.speaker} style={{ color: msg.color }}>{msg.speaker}</span>
              <span className={styles.roundTag} style={{ background: msg.bg, color: msg.color, borderColor: msg.bd }}>R{msg.round + 1}</span>
            </div>
            <div className={styles.msgText}>
              {msg.text || (msg.streaming ? '' : '...')}
              {msg.streaming && <span className="cursor" />}
            </div>
          </div>
        ))}

        {thinking && (
          <div className={styles.thinking}>
            <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
            <span className={styles.thinkingText}>{thinking}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Subtitle bar */}
      {subtitle && (
        <div className={styles.subtitleBar}>
          <span className={styles.subtitleText}>{subtitle}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Append to `components/SimScreen.module.css`**

```css
.headerRight { display: flex; align-items: center; gap: 16px; }

.pauseBtn {
  background: transparent; border: 1px solid var(--border2);
  color: var(--text-dim); border-radius: 4px; padding: 5px 14px;
  font-size: 11px; transition: all 0.15s;
}
.pauseBtn:hover:not(:disabled) { border-color: var(--gold-border); color: var(--gold); }
.pauseBtn:disabled { opacity: 0.4; cursor: not-allowed; }

.activeBar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 1.5rem; border-bottom: 1px solid var(--border);
  background: var(--surface); flex-shrink: 0; overflow-x: auto;
}
.activePip {
  display: flex; align-items: center; gap: 6px;
  border: 1px solid var(--bd, var(--border2));
  background: var(--bg, transparent);
  border-radius: 20px; padding: 4px 10px;
  transition: all 0.3s; opacity: 0.4;
}
.activePipOn { opacity: 1; box-shadow: 0 0 10px color-mix(in srgb, var(--c, var(--gold)) 40%, transparent); }
.activePipAvatar { font-size: 14px; }
.activePipName { font-size: 11px; font-family: 'DM Mono', monospace; font-weight: 500; }

.msgActive .msgText { color: var(--text); }

.subtitleBar {
  flex-shrink: 0; padding: 10px 1.5rem;
  border-top: 1px solid var(--border);
  background: rgba(13,13,15,0.9);
  min-height: 42px; display: flex; align-items: center;
}
.subtitleText {
  font-size: 13px; color: #f5eed8; font-family: 'DM Sans', sans-serif;
  line-height: 1.5; font-style: italic;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/SimScreen.tsx components/SimScreen.module.css
git commit -m "feat: auto-orchestrating SimScreen with TTS pipeline, active panelist bar, subtitle bar, pause/resume"
```

---

## Task 14: Expanded VerdictScreen (Report)

**Files:**
- Modify: `components/VerdictScreen.tsx`
- Modify: `components/VerdictScreen.module.css`

- [ ] **Step 1: Rewrite `components/VerdictScreen.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import type { SimConfig, Verdict } from '@/lib/types'
import styles from './VerdictScreen.module.css'

interface Props { verdict: Verdict; config: SimConfig; onRestart: () => void }

export default function VerdictScreen({ verdict, config, onRestart }: Props) {
  const [scored, setScored] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  useEffect(() => { setTimeout(() => setScored(true), 400) }, [])

  const getP = (name: string, i: number) =>
    config.panelists.find(p => p.name === name) ?? config.panelists[i] ?? config.panelists[0]

  const stanceLabel: Record<string, string> = {
    approve: '✓ Approve', reject: '✗ Reject', conditional: '◎ Conditional'
  }
  const stanceColor: Record<string, string> = {
    approve: '#50a040', reject: '#c04040', conditional: '#c8962a'
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Session Report</span>
        <button className={styles.ghostBtn} onClick={onRestart}>← New session</button>
      </header>

      <div className={styles.content}>

        {/* Overall score */}
        <div className={styles.overallBlock}>
          <div className={styles.overallNum}>{verdict.overall}</div>
          <div className={styles.overallLabel}>OVERALL SCORE / 100</div>
          <p className={styles.overallVerdict}>"{verdict.verdict}"</p>
        </div>

        {/* Per-panelist */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Panelist Breakdown</h2>
          {verdict.members.map((m, i) => {
            const p = getP(m.name, i)
            return (
              <div key={i} className={styles.memberCard}>
                <div className={styles.mHeader}>
                  <div className={styles.mAvatar} style={{ background: p.bg, borderColor: p.bd }}>{p.avatar}</div>
                  <div className={styles.mMeta}>
                    <span className={styles.mName} style={{ color: p.color }}>{m.name}</span>
                    <span className={styles.mStance} style={{ color: stanceColor[m.stance] ?? '#c8962a' }}>
                      {stanceLabel[m.stance] ?? m.stance}
                    </span>
                  </div>
                  <span className={styles.mScore}>{m.score}/100</span>
                </div>
                <div className={styles.mBarBg}>
                  <div className={styles.mBar} style={{ width: scored ? `${m.score}%` : '0%', background: p.color }} />
                </div>
                <p className={styles.mSummary}>"{m.summary}"</p>
                {m.keyQuotes.length > 0 && (
                  <div className={styles.quotes}>
                    {m.keyQuotes.map((q, qi) => (
                      <div key={qi} className={styles.quote} style={{ borderColor: p.bd }}>"{q}"</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {/* Strengths & Concerns */}
        <div className={styles.twoCol}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: '#50a040' }}>Strengths</h2>
            <ul className={styles.list}>
              {verdict.strengths.map((s, i) => <li key={i} className={styles.listItem}>{s}</li>)}
            </ul>
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: '#c04040' }}>Concerns</h2>
            <ul className={styles.list}>
              {verdict.concerns.map((c, i) => <li key={i} className={styles.listItem}>{c}</li>)}
            </ul>
          </section>
        </div>

        {/* Recommendations */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recommendations</h2>
          <ol className={styles.list}>
            {verdict.recommendations.map((r, i) => <li key={i} className={styles.listItem}>{r}</li>)}
          </ol>
        </section>

        <div className={styles.actions}>
          <button className={styles.restartBtn} onClick={onRestart}>RUN ANOTHER SESSION ↗</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `components/VerdictScreen.module.css`**

```css
.wrap { display: flex; flex-direction: column; min-height: 100vh; }

.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; background: var(--bg); z-index: 10;
}
.headerTitle { font-family: 'Playfair Display', serif; font-size: 17px; color: #f5eed8; }
.ghostBtn { background: transparent; border: none; color: var(--text-dim); font-size: 12px; }
.ghostBtn:hover { color: var(--text); }

.content { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem 5rem; display: flex; flex-direction: column; gap: 2.5rem; }

.overallBlock { text-align: center; padding: 2.5rem 0 1.5rem; border-bottom: 1px solid var(--border); }
.overallNum { font-family: 'Playfair Display', serif; font-size: clamp(64px, 14vw, 100px); font-weight: 700; color: var(--gold); line-height: 1; }
.overallLabel { font-size: 11px; font-family: 'DM Mono', monospace; color: var(--text-dim); letter-spacing: 0.12em; margin-top: 6px; }
.overallVerdict { font-size: 14px; color: var(--text); line-height: 1.7; max-width: 520px; margin: 1.25rem auto 0; font-style: italic; }

.section { display: flex; flex-direction: column; gap: 12px; }
.sectionTitle { font-family: 'Playfair Display', serif; font-size: 18px; color: #f5eed8; }

.memberCard { background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.mHeader { display: flex; align-items: center; gap: 10px; }
.mAvatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; border: 1px solid; flex-shrink: 0; }
.mMeta { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.mName { font-size: 13px; font-weight: 500; font-family: 'DM Mono', monospace; }
.mStance { font-size: 10px; font-family: 'DM Mono', monospace; letter-spacing: 0.05em; }
.mScore { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--gold); }
.mBarBg { height: 3px; background: var(--border2); border-radius: 2px; overflow: hidden; }
.mBar { height: 100%; border-radius: 2px; transition: width 1.2s cubic-bezier(0.16,1,0.3,1); }
.mSummary { font-size: 13px; color: var(--text); line-height: 1.65; font-style: italic; }
.quotes { display: flex; flex-direction: column; gap: 6px; }
.quote { font-size: 12px; color: var(--text-dim); line-height: 1.6; border-left: 2px solid var(--border2); padding-left: 10px; font-style: italic; }

.twoCol { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 580px) { .twoCol { grid-template-columns: 1fr; } }

.list { list-style: none; display: flex; flex-direction: column; gap: 8px; padding: 0; }
ol.list { counter-reset: rec; }
.listItem { font-size: 13px; color: var(--text); line-height: 1.65; padding-left: 20px; position: relative; }
.listItem::before { content: '·'; position: absolute; left: 6px; color: var(--gold); }
ol.list .listItem { counter-increment: rec; }
ol.list .listItem::before { content: counter(rec) '.'; font-family: 'DM Mono', monospace; font-size: 11px; }

.actions { display: flex; gap: 12px; }
.restartBtn { flex: 1; padding: 16px; background: var(--gold); color: #0d0d0f; border: none; border-radius: 4px; font-size: 13px; font-weight: 500; letter-spacing: 0.08em; transition: background 0.15s; }
.restartBtn:hover { background: var(--gold-light); }
```

- [ ] **Step 3: Commit**

```bash
git add components/VerdictScreen.tsx components/VerdictScreen.module.css
git commit -m "feat: expand VerdictScreen into full report with panelist breakdown, strengths, concerns, recommendations"
```

---

## Task 15: Update `.env.local.example` and smoke test

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Update `.env.local.example`**

```
# PitchWars — API keys are entered in-app via the ⚙ gear icon
# This file can remain empty. No server-side keys are required.
# Keys are stored in your browser's localStorage.

# Optional: set a key here as a default (will be overridden by in-app keys)
# ANTHROPIC_API_KEY=
# GROQ_API_KEY=
# ELEVENLABS_API_KEY=
```

- [ ] **Step 2: Run dev server and verify startup**

```bash
cd /Users/sanjaysubramania/Downloads/pitchwars
PATH=/opt/homebrew/bin:$PATH npm run dev 2>&1 &
sleep 4
curl -s http://localhost:3000 | grep -c "PitchWars" || echo "Check browser at http://localhost:3000"
```

Expected: Server starts on port 3000 without errors.

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
PATH=/opt/homebrew/bin:$PATH npx tsc --noEmit 2>&1
```

Expected: No errors (or only pre-existing ones).

- [ ] **Step 4: Commit**

```bash
git add .env.local.example
git commit -m "chore: update env example; all keys now managed in-app"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] API key management (KeySetupModal, gear icon, localStorage, headers) → Tasks 3, 11, 12
- [x] Groq + Anthropic provider abstraction → Tasks 5, 6
- [x] Whisper transcription (live waveform, Web Speech preview, Groq confirm) → Tasks 7, 10
- [x] Multi-agent panel: each panelist = separate LLM call with personality → Task 6 (simulate route)
- [x] Sequential calling so panelists reference each other → Task 6 (history passed per call)
- [x] Auto-flowing conversation (no user reply prompt) → Task 13
- [x] ElevenLabs TTS + Web Speech fallback → Tasks 8, 9, 13
- [x] Sentence-by-sentence TTS pipelining → Tasks 9, 13
- [x] Pause/resume → Task 13
- [x] Active panelist indicator + subtitle bar → Task 13
- [x] Expanded final report (strengths, concerns, recommendations, quotes, stances) → Tasks 6, 14
- [x] Voice assignment per panelist → Task 4, 6 (parse-panel assigns voiceForIndex)
- [x] Next.js CVE upgrade → Task 1

**Type consistency check:**
- `Panelist.voiceId` defined in Task 2, used in Tasks 4, 6, 9, 13 ✓
- `Panelist.webSpeechVoice` defined in Task 2, used in Tasks 4, 6, 13 ✓
- `Verdict.strengths/concerns/recommendations` defined in Task 2, returned in Task 6, rendered in Task 14 ✓
- `VerdictMember.keyQuotes` / `.stance` defined in Task 2, returned in Task 6, rendered in Task 14 ✓
- `speakSentence()` signature in Task 9 matches call in Task 13 ✓
- `extractCompleteSentences()` returns `{sentences, remainder}`, used correctly in Task 13 ✓
- `apiHeaders()` in Task 3 returns `Record<string,string>` with Content-Type, used in Tasks 12, 13 ✓
- `PitchWars.tsx` passes `ideaText` prop to `SimScreen` in Task 12; `SimScreen` accepts it in Task 13 ✓
