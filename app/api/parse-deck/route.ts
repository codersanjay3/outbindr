/**
 * /api/parse-deck — Extract raw text from a pitch deck (PDF, TXT, MD).
 *
 * Returns { text } — truncated to 4 000 chars, which is roughly 800–1 000
 * words: enough context for panelists without blowing token budgets.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('deck') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    let text: string

    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer()
      const pdfParse = (await import('pdf-parse')).default
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
