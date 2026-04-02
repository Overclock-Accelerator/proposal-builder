import OpenAI from 'openai'
import { MODELS } from './models'
import { TOOL_DEFINITIONS, ToolResult, executeTool } from './tools'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  model: string
  systemPrompt: string
  messages: Message[]
  enabledTools?: string[]
  onToolCall?: (log: ToolResult) => void
}

export interface GenerateResult {
  text: string
  latencyMs: number
  estimatedCostUsd: number
  inputTokens: number
  outputTokens: number
  toolCallLog: ToolResult[]
}

function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = MODELS.find((m) => m.id === modelId)
  if (!model) return 0
  return ((inputTokens + outputTokens) / 1_000_000) * model.approxPricePer1M
}

function getActiveToolDefs(enabledTools: string[]) {
  return TOOL_DEFINITIONS.filter((t) => enabledTools.includes(t.function.name))
}

function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://proposal-builder.vercel.app',
      'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME ?? 'Proposal Builder',
    },
  })
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { model: modelId, systemPrompt, messages, enabledTools = [], onToolCall } = options
  const modelConfig = MODELS.find((m) => m.id === modelId)
  if (!modelConfig) throw new Error(`Unknown model: ${modelId}`)
  if (modelConfig.provider !== 'openrouter') {
    throw new Error(`Unsupported provider: ${modelConfig.provider}`)
  }

  const toolCallLog: ToolResult[] = []
  const start = Date.now()
  const activeTools = getActiveToolDefs(enabledTools)
  const client = getOpenRouterClient()
  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  let totalInputTokens = 0
  let totalOutputTokens = 0
  const MAX_TOOL_ROUNDS = 5

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reqParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: modelId,
      messages: chatMessages,
      max_tokens: 4096,
    }

    if (activeTools.length > 0) {
      reqParams.tools = activeTools
      reqParams.tool_choice = 'auto'
    }

    const response = await client.chat.completions.create(reqParams)
    totalInputTokens += response.usage?.prompt_tokens ?? 0
    totalOutputTokens += response.usage?.completion_tokens ?? 0

    const choice = response.choices[0]

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      chatMessages.push(choice.message)
      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = []

      for (const tc of choice.message.tool_calls) {
        let parsedArgs: Record<string, unknown> = {}
        const fnName = tc.type === 'function' ? tc.function.name : tc.custom.name
        const fnArgs = tc.type === 'function' ? tc.function.arguments : tc.custom.input
        try {
          parsedArgs = JSON.parse(fnArgs)
        } catch {
          // Leave empty so the tool can surface a validation error cleanly.
        }

        const toolResult = await executeTool(fnName, parsedArgs)
        toolCallLog.push(toolResult)
        onToolCall?.(toolResult)
        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult.result,
        })
      }

      chatMessages.push(...toolResults)
      continue
    }

    const latencyMs = Date.now() - start
    return {
      text: choice.message.content ?? '',
      latencyMs,
      estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      toolCallLog,
    }
  }

  const latencyMs = Date.now() - start
  return {
    text: '',
    latencyMs,
    estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolCallLog,
  }
}
