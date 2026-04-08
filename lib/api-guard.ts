import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_BYTES = 512 * 1024 // 512 KB — prevents oversized payload attacks

/** Validate an API request and extract safe headers. Returns an error response or null. */
export function guardRequest(req: NextRequest): NextResponse | null {
  // Block oversized Content-Length before we read the body
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  // Reject requests with suspicious header injection characters
  const anthropicKey = req.headers.get('x-anthropic-key') ?? ''
  const groqKey      = req.headers.get('x-groq-key') ?? ''
  const elevenKey    = req.headers.get('x-elevenlabs-key') ?? ''

  for (const val of [anthropicKey, groqKey, elevenKey]) {
    if (/[\r\n]/.test(val)) {
      return NextResponse.json({ error: 'Invalid header value.' }, { status: 400 })
    }
  }

  return null
}

/** Strip any HTML/script tags from a string to prevent stored XSS if text is ever rendered as HTML. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** Clamp a number to a safe range. */
export function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : parseInt(String(val), 10)
  if (isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
