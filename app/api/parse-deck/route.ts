/**
 * /api/parse-deck — Extract raw text from a pitch deck (PDF, TXT, MD).
 *
 * Returns { text } — truncated to 4 000 chars, which is roughly 800–1 000
 * words: enough context for panelists without blowing token budgets.
 */
import { NextRequest, NextResponse } from 'next/server'

function isPdf(file: File): boolean {
  // Check MIME type AND filename — browsers don't always set type consistently
  if (file.type === 'application/pdf') return true
  if (file.name?.toLowerCase().endsWith('.pdf')) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('deck') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    let text: string

    if (isPdf(file)) {
      const arrayBuffer = await file.arrayBuffer()
      // Import from the internal path to avoid pdf-parse's test-file loading
      // issue that causes failures in Next.js App Router serverless environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      const pdfData  = await pdfParse(Buffer.from(arrayBuffer))
      text = pdfData.text
    } else {
      text = await file.text()
    }

    // Collapse excessive whitespace, then cap at 4 000 chars
    const cleaned   = text.replace(/\s{3,}/g, '\n\n').trim()
    const truncated = cleaned.slice(0, 4000)

    return NextResponse.json({ text: truncated, fileName: file.name })
  } catch (err) {
    console.error('parse-deck error:', err)
    return NextResponse.json({ error: 'Failed to parse deck document' }, { status: 500 })
  }
}
