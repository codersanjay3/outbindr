# PitchWars — Panel Simulator

Upload a panel document. Upload your idea. Watch the agents evaluate it together.

## How it works

1. **Panel document** — describe your judges in any format (plain text, PDF, markdown). Can be as simple as:
   ```
   Judge 1: Dr. Priya Shah, skeptical academic, focuses on methodology and evidence quality
   Judge 2: Rex Donovan, ex-founder VC, grills unit economics and go-to-market
   Judge 3: Marcus Wei, ex-CTO, tears apart technical claims
   ```
   Or upload a full rubric, evaluation criteria doc, or panel briefing PDF.

2. **Idea document** — your pitch deck, research paper, business plan, product spec — any PDF or text file.

3. **Simulation** — the panel reads your document and discusses it among themselves across multiple rounds, referencing each other by name, asking each other follow-up questions, and building on prior arguments. You can reply between rounds.

4. **Verdict** — each panelist scores your submission with a summary, plus an overall score and collective verdict.

## Setup

```bash
# 1. Clone / open this folder in Claude Code

# 2. Install dependencies
npm install

# 3. Add your Anthropic API key
cp .env.local.example .env.local
# Edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 4. Run the dev server
npm run dev

# 5. Open http://localhost:3000
```

## Deploy to Vercel

```bash
npm install -g vercel
vercel
# Set ANTHROPIC_API_KEY in Vercel dashboard → Settings → Environment Variables
```

## Project structure

```
pitchwars/
├── app/
│   ├── page.tsx                  # Entry point
│   ├── layout.tsx                # Root layout + fonts
│   ├── globals.css               # Global dark theme styles
│   └── api/
│       ├── parse-panel/route.ts  # Parses panel doc → structured panelists
│       ├── simulate/route.ts     # Streaming per-panelist response
│       └── verdict/route.ts      # Final scores + collective verdict
├── components/
│   ├── PitchWars.tsx             # Top-level state machine (setup → sim → verdict)
│   ├── SetupScreen.tsx           # Upload panel + idea, set rounds
│   ├── SimScreen.tsx             # Live simulation with streaming
│   ├── VerdictScreen.tsx         # Scores + summaries
│   └── DropZone.tsx              # Reusable file drop component
├── lib/
│   └── types.ts                  # Shared TypeScript types
└── .env.local.example            # API key template
```

## Panel document examples

**Startup / VC panel:**
```
3-person VC panel: one ex-founder skeptic focused on unit economics,
one growth investor obsessed with TAM and viral distribution,
one technical partner who grills architecture and scalability.
```

**Academic review panel:**
```
Reviewer 1: Senior professor, methodology expert, demands statistical rigor
Reviewer 2: Industry practitioner, skeptical of real-world applicability
Reviewer 3: Early-career researcher, focused on novelty and literature gaps
```

**Product critique panel:**
```
Alice Chen - Head of Design, cares about user experience and visual coherence
Bob Nazari - Engineering Lead, questions technical feasibility and complexity
Dana Park - Product Manager, stress-tests the roadmap and prioritization logic
```

**DECA / pitch competition judges:**
```
Judge panel for DECA Business Innovation:
- Business viability judge: evaluates market size, revenue model, and competitive moat
- Innovation judge: scores originality, creative use of technology, and differentiation
- Presentation judge: grades clarity, confidence, and ability to handle questions
```
