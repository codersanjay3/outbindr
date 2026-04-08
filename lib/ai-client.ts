import Anthropic from '@anthropic-ai/sdk'
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
  const anthropicKey = headers['x-anthropic-key']
  if (groqKey) return groqClient(groqKey)
  if (anthropicKey) return anthropicClient(anthropicKey)
  throw new Error('No API key provided (x-groq-key or x-anthropic-key header required)')
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
