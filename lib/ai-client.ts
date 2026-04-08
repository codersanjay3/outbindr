import Groq from 'groq-sdk'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TextClient {
  streamMessage(system: string, messages: AIMessage[], maxTokens: number): Promise<ReadableStream<Uint8Array>>
  createMessage(system: string, messages: AIMessage[], maxTokens: number): Promise<string>
}

export function createTextClient(headers: Record<string, string>): TextClient {
  const groqKey = headers['x-groq-key']
  if (groqKey) return groqClient(groqKey)
  throw new Error('No API key provided (x-groq-key header required)')
}

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
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
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
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
      })
      return res.choices[0]?.message?.content ?? ''
    },
  }
}
