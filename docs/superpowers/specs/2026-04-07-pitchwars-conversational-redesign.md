# PitchWars — Conversational Redesign Spec
**Date:** 2026-04-07
**Status:** Approved

---

## Overview

Transform PitchWars from a click-driven panel simulator into a fully conversational, real-time experience. Users pitch verbally via microphone; AI panelists (each a separate LLM call with distinct personalities) discuss in sequence, their voices synthesized and streamed to the user. The session ends with a structured report.

---

## 1. Infrastructure

### 1.1 Project Setup
- **Next.js upgrade:** 15.1.0 → latest patched (CVE-2025-66478)
- **New dependencies:**
  - `groq-sdk` — Groq text inference + Whisper transcription
  - `elevenlabs` — ElevenLabs TTS SDK
- **Existing dependency:** `@anthropic-ai/sdk` retained (alternative provider)

### 1.2 RTK + Token Optimizer MCP
- RTK 0.35.0 installed globally via Homebrew; Claude Code PreToolUse hook active
- `token-optimizer-mcp` configured in `~/.claude/mcp.json`
- All dev commands use `rtk` prefix for 60–90% token savings

---

## 2. API Key Management (In-App)

### 2.1 Storage
Keys stored in browser `localStorage`, never persisted server-side. Sent as request headers on every API call:
- `x-anthropic-key` — Anthropic API key
- `x-groq-key` — Groq API key (required for Whisper + Groq text models)
- `x-elevenlabs-key` — ElevenLabs API key (required for high-quality TTS)

At least one of Anthropic or Groq key must be present to launch a simulation.

### 2.2 UI
- **KeySetup modal** — shown on first load if no keys detected in localStorage
- **Gear icon** in SetupScreen header — opens KeySetup modal anytime to update keys
- Modal has three fields: Anthropic Key, Groq Key, ElevenLabs Key
- Provider indicator badge shows which provider is active for text inference

### 2.3 Provider Selection Logic
| Keys Present | Text Inference | Whisper | TTS |
|---|---|---|---|
| Groq only | Groq (`llama-3.3-70b-versatile`) | Groq Whisper | ElevenLabs (if key) or Web Speech API |
| Anthropic only | Anthropic (`claude-sonnet-4-5`) | Not available | ElevenLabs (if key) or Web Speech API |
| Both | User toggle (default: Groq) | Groq Whisper | ElevenLabs (if key) or Web Speech API |
| ElevenLabs missing | Any | Any | Web Speech API fallback |

### 2.4 Shared AI Client (`lib/ai-client.ts`)
Factory function `createTextClient(headers)` that returns a provider-agnostic interface with:
- `streamMessage(system, messages, maxTokens)` → `AsyncIterable<string>`
- `createMessage(system, messages, maxTokens)` → `Promise<string>`

Internally selects Anthropic or Groq SDK based on which key is in headers.

---

## 3. Live Pitch Recording (Whisper Flow)

### 3.1 Recording UX
- Replaces the "Your idea" document upload with a primary **"Start Pitching"** button (mic icon)
- Document upload remains as secondary option ("Upload instead")
- Large animated waveform visualization while recording
- Live transcription text appears in real-time using browser **Web Speech API** (instant visual feedback)

### 3.2 Transcription Pipeline
1. User presses Start → `MediaRecorder` begins capturing audio (webm/ogg)
2. Browser `SpeechRecognition` (Web Speech API) shows words in real-time on screen
3. User presses Stop → audio blob sent to `/api/transcribe`
4. `/api/transcribe` sends to Groq `whisper-large-v3`, returns clean text
5. Whisper result replaces Web Speech API draft (Whisper is more accurate)
6. User sees final transcript, can re-record or proceed

### 3.3 `/api/transcribe` Route
- Accepts: `FormData` with `audio` file + `x-groq-key` header
- Returns: `{ transcript: string }`
- Falls back to Web Speech API text if Groq key missing (transcript sent from client)

---

## 4. Multi-Agent Panel Discussion

### 4.1 Panelist Identity
Each panelist extracted from the panel document by `/api/parse-panel` receives:
- `name`, `role` (full personality description from document)
- `avatar`, `color`, `bg`, `bd` (visual identity, existing)
- `voiceId` — assigned ElevenLabs voice ID (cycled from a curated list of 6 distinct voices)
- `webSpeechVoice` — browser voice name (fallback, assigned from available voices)

### 4.2 Sequential Multi-Agent Architecture
The discussion is orchestrated sequentially — not parallel — to enable genuine cross-referencing:

```
Round 1:
  Panelist A called with: [pitch transcript + "you go first"]
  → A's response appended to shared history

  Panelist B called with: [pitch transcript + A's response + "respond to A and the pitch"]
  → B's response appended to shared history

  Panelist C called with: [pitch + A's response + B's response + "respond"]
  → C's response appended

Round 2:
  Panelist A called with: [full history from Round 1]
  → A continues, may reference B or C by name
  ...
```

Each panelist LLM call has:
- **System prompt:** Their name + full personality description + awareness of other panelists' names/roles
- **No shared state on server** — history passed from client per call

### 4.3 Streaming + TTS Pipeline
For each panelist turn:
1. `/api/simulate` streams text chunks to client
2. Client buffers chunks into sentences (split on `.`, `!`, `?`)
3. Each complete sentence sent to `/api/tts` → ElevenLabs streams audio
4. Audio plays immediately while next sentence is being synthesized (pipeline)
5. Text displayed as subtitles in real-time beneath the active panelist card

### 4.4 `/api/tts` Route
- Accepts: `{ text, voiceId, elevenLabsKey }`
- Returns: audio stream (mp3)
- Falls back to Web Speech API utterance on client if ElevenLabs key missing or call fails

### 4.5 Orchestration on Client (`SimScreen`)
- `SimScreen` drives the full loop: for each round, for each panelist, call simulate → stream → TTS
- One panelist "active" at a time (highlighted card, animated border)
- Others shown dimmed
- Pause button halts after current panelist finishes speaking
- No server-side orchestration needed (simpler, avoids timeouts)

---

## 5. UI / Visual Design

### 5.1 SetupScreen Changes
- API key gear icon in header
- Mic button as primary pitch input (document upload as secondary)
- Live waveform + transcript during recording
- Transcript preview card before launching simulation

### 5.2 SimScreen Changes
- Panelist cards arranged in a row/grid (existing)
- Active panelist: glowing animated border, avatar pulses
- Subtitle bar at bottom showing current speaker's streamed text
- Waveform/audio indicator on active panelist card
- Auto-scroll conversation log (existing message list, enhanced)
- Pause/resume button
- Round indicator ("Round 2 of 3")

### 5.3 VerdictScreen → Report Screen
Renamed and expanded:
- **Overall score** (large, prominent)
- **Per-panelist breakdown:** score, 2–3 key quotes from their discussion, final stance
- **Strengths section:** bullet points extracted from positive panelist comments
- **Concerns section:** bullet points extracted from critical panelist comments
- **Recommendations:** specific next steps suggested by panel
- **Full transcript** (collapsible)
- Download as PDF button (future)

---

## 6. New & Modified Files

### New Files
| File | Purpose |
|---|---|
| `components/KeySetupModal.tsx` | API key entry UI |
| `components/KeySetupModal.module.css` | Styles |
| `components/AudioPitchRecorder.tsx` | Mic recording + live transcript |
| `components/AudioPitchRecorder.module.css` | Styles |
| `lib/ai-client.ts` | Provider-agnostic LLM factory |
| `lib/tts-client.ts` | TTS abstraction (ElevenLabs + Web Speech fallback) |
| `lib/keys.ts` | localStorage key helpers |
| `app/api/transcribe/route.ts` | Whisper transcription endpoint |
| `app/api/tts/route.ts` | ElevenLabs TTS proxy endpoint |

### Modified Files
| File | Change |
|---|---|
| `package.json` | Add groq-sdk, elevenlabs; upgrade next |
| `.env.local.example` | Update to reflect optional keys |
| `app/api/parse-panel/route.ts` | Use ai-client factory; assign voiceId to panelists |
| `app/api/simulate/route.ts` | Use ai-client factory; read keys from headers |
| `app/api/verdict/route.ts` | Use ai-client factory; expand verdict to full report |
| `lib/types.ts` | Add voiceId/webSpeechVoice to Panelist; expand Verdict |
| `components/SetupScreen.tsx` | Add gear icon, mic recorder, key detection |
| `components/SimScreen.tsx` | Auto-orchestration loop, TTS pipeline, pause/resume |
| `components/VerdictScreen.tsx` | Expanded report layout |

---

## 7. Error Handling

- **No Groq key + mic pitch:** inform user Whisper needs Groq key; offer text input fallback
- **No ElevenLabs key:** silently fall back to Web Speech API (no user-visible error)
- **TTS failure mid-sentence:** skip audio, continue subtitle display
- **LLM call failure:** retry once, then show error banner and allow resume
- **Mic permission denied:** show clear permission request UI

---

## 8. Security

- API keys only in localStorage and request headers — never logged, never stored server-side
- No server-side `.env` keys required (`.env.local` can be empty)
- All API calls proxied through Next.js routes (keys not exposed to browser network tab from within app logic, but visible in DevTools — acceptable for a local/demo app)
