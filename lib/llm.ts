import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
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
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://proposal-builder.vercel.app',
      'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME ?? 'Proposal Builder',
    },
  })
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey })
}

function getOpenAIDirectClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return new OpenAI({ apiKey })
}

async function generateWithOpenRouter(options: GenerateOptions): Promise<GenerateResult> {
  const { model: modelId, systemPrompt, messages, enabledTools = [], onToolCall } = options

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
        const fnName = tc.type === 'function' ? tc.function.name : (tc as { custom: { name: string } }).custom.name
        const fnArgs = tc.type === 'function' ? tc.function.arguments : (tc as { custom: { input: string } }).custom.input
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

    return {
      text: choice.message.content ?? '',
      latencyMs: Date.now() - start,
      estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      toolCallLog,
    }
  }

  return {
    text: '',
    latencyMs: Date.now() - start,
    estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolCallLog,
  }
}

async function generateWithAnthropic(options: GenerateOptions): Promise<GenerateResult> {
  const { model: modelId, systemPrompt, messages, enabledTools = [], onToolCall } = options
  const modelConfig = MODELS.find((m) => m.id === modelId)!
  const nativeModelId = modelConfig.nativeModelId ?? modelId.replace(/^anthropic\//, '')

  const client = getAnthropicClient()
  const toolCallLog: ToolResult[] = []
  const start = Date.now()

  const activeTools = getActiveToolDefs(enabledTools)
  const anthropicTools: Anthropic.Tool[] = activeTools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? '',
    input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
  }))

  let anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  let totalInputTokens = 0
  let totalOutputTokens = 0
  const MAX_TOOL_ROUNDS = 5

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reqParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: nativeModelId,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
    }

    if (anthropicTools.length > 0) {
      reqParams.tools = anthropicTools
    }

    const response = await client.messages.create(reqParams)
    totalInputTokens += response.usage.input_tokens
    totalOutputTokens += response.usage.output_tokens

    if (response.stop_reason === 'tool_use') {
      anthropicMessages.push({ role: 'assistant', content: response.content })

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const toolResult = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
        toolCallLog.push(toolResult)
        onToolCall?.(toolResult)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult.result,
        })
      }

      anthropicMessages.push({ role: 'user', content: toolResults })
      continue
    }

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    return {
      text: textContent,
      latencyMs: Date.now() - start,
      estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      toolCallLog,
    }
  }

  return {
    text: '',
    latencyMs: Date.now() - start,
    estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolCallLog,
  }
}

async function generateWithOpenAIDirect(options: GenerateOptions): Promise<GenerateResult> {
  const { model: modelId, systemPrompt, messages, enabledTools = [], onToolCall } = options
  const modelConfig = MODELS.find((m) => m.id === modelId)!
  const nativeModelId = modelConfig.nativeModelId ?? modelId.replace(/^openai\//, '')

  const toolCallLog: ToolResult[] = []
  const start = Date.now()
  const activeTools = getActiveToolDefs(enabledTools)
  const client = getOpenAIDirectClient()
  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  let totalInputTokens = 0
  let totalOutputTokens = 0
  const MAX_TOOL_ROUNDS = 5

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reqParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: nativeModelId,
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
        if (tc.type !== 'function') continue
        let parsedArgs: Record<string, unknown> = {}
        try {
          parsedArgs = JSON.parse(tc.function.arguments)
        } catch {
          // Leave empty so the tool can surface a validation error cleanly.
        }

        const toolResult = await executeTool(tc.function.name, parsedArgs)
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

    return {
      text: choice.message.content ?? '',
      latencyMs: Date.now() - start,
      estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      toolCallLog,
    }
  }

  return {
    text: '',
    latencyMs: Date.now() - start,
    estimatedCostUsd: estimateCost(modelId, totalInputTokens, totalOutputTokens),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolCallLog,
  }
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { model: modelId } = options
  const modelConfig = MODELS.find((m) => m.id === modelId)
  if (!modelConfig) throw new Error(`Unknown model: ${modelId}`)

  if (modelConfig.nativeVendor === 'anthropic') {
    return generateWithAnthropic(options)
  }
  if (modelConfig.nativeVendor === 'openai') {
    return generateWithOpenAIDirect(options)
  }
  return generateWithOpenRouter(options)
}
