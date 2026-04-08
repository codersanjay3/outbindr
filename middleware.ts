import { NextRequest, NextResponse } from 'next/server'

// ── In-memory rate limiter (per IP, per minute) ───────────────────────────
// Uses a Map that resets counts each minute window. Fine for a single Vercel
// serverless instance in dev/low traffic; swap for Upstash Redis for prod scale.
const RATE_LIMIT_WINDOW_MS = 60_000   // 1 minute
const RATE_LIMIT_MAX       = 30       // max API calls per IP per minute

interface BucketEntry { count: number; resetAt: number }
const buckets = new Map<string, BucketEntry>()

function getRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const bucket = buckets.get(ip)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }

  bucket.count++
  const remaining = Math.max(0, RATE_LIMIT_MAX - bucket.count)
  return { allowed: bucket.count <= RATE_LIMIT_MAX, remaining }
}

// Clean up old buckets every 5 minutes to prevent memory leak
let lastCleanup = Date.now()
function maybeCleanup() {
  const now = Date.now()
  if (now - lastCleanup < 5 * 60_000) return
  lastCleanup = now
  for (const [ip, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(ip)
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Get real IP (Vercel sets x-forwarded-for)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'

  maybeCleanup()
  const { allowed, remaining } = getRateLimit(ip)

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please wait a moment before trying again.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  return response
}

export const config = {
  matcher: '/api/:path*',
}
