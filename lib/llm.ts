import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  model: string
  systemPrompt: string
  messages: Message[]
  mirrorSamples?: boolean
  referenceContent?: string
}

export interface GenerateResult {
  text: string
  latencyMs: number
  estimatedCostUsd: number
  inputTokens: number
  outputTokens: number
}

function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = MODELS.find((m) => m.id === modelId)
  if (!model) return 0
  return (inputTokens / 1000) * model.inputPricePer1K + (outputTokens / 1000) * model.outputPricePer1K
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { model: modelId, systemPrompt, messages, mirrorSamples, referenceContent } = options
  const modelConfig = MODELS.find((m) => m.id === modelId)
  if (!modelConfig) throw new Error(`Unknown model: ${modelId}`)

  let finalSystemPrompt = systemPrompt
  if (mirrorSamples && referenceContent) {
    finalSystemPrompt += `\n\n---\nREFERENCE CONTENT (mirror this style and structure):\n${referenceContent}\n---`
  }

  const start = Date.now()

  if (modelConfig.provider === 'openai') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
      max_tokens: 4096,
    })
    const latencyMs = Date.now() - start
    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0
    return {
      text: response.choices[0].message.content ?? '',
      latencyMs,
      estimatedCostUsd: estimateCost(modelId, inputTokens, outputTokens),
      inputTokens,
      outputTokens,
    }
  }

  if (modelConfig.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 4096,
      system: finalSystemPrompt,
      messages: messages as Anthropic.MessageParam[],
    })
    const latencyMs = Date.now() - start
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    return {
      text: response.content[0].type === 'text' ? response.content[0].text : '',
      latencyMs,
      estimatedCostUsd: estimateCost(modelId, inputTokens, outputTokens),
      inputTokens,
      outputTokens,
    }
  }

  if (modelConfig.provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const geminiModel = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: finalSystemPrompt,
    })
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]
    const chat = geminiModel.startChat({ history })
    const result = await chat.sendMessage(lastMessage.content)
    const latencyMs = Date.now() - start
    const text = result.response.text()
    // Gemini doesn't always return token counts in the same way; estimate from chars
    const inputTokens = Math.ceil(messages.map((m) => m.content).join('').length / 4)
    const outputTokens = Math.ceil(text.length / 4)
    return {
      text,
      latencyMs,
      estimatedCostUsd: estimateCost(modelId, inputTokens, outputTokens),
      inputTokens,
      outputTokens,
    }
  }

  if (modelConfig.provider === 'openrouter') {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://proposal-builder.vercel.app',
        'X-Title': 'Proposal Builder',
      },
    })
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: 'system', content: finalSystemPrompt }, ...messages],
      max_tokens: 4096,
    })
    const latencyMs = Date.now() - start
    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0
    return {
      text: response.choices[0].message.content ?? '',
      latencyMs,
      estimatedCostUsd: estimateCost(modelId, inputTokens, outputTokens),
      inputTokens,
      outputTokens,
    }
  }

  throw new Error(`Unsupported provider: ${modelConfig.provider}`)
}
