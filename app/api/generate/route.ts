import { NextRequest, NextResponse } from 'next/server'
import { generate, Message } from '@/lib/llm'
import { saveRun, initDb } from '@/lib/db'
import { DEFAULT_MODEL_ID, SYSTEM_PROMPT_PRESETS } from '@/lib/models'

const UNWANTED_OUTPUT_PREAMBLES = [
  `Perfect. I now have solid context on Stripe's operations, scale, and current automation capabilities. I'll draft a comprehensive, professionally-tailored consulting proposal that integrates the findings and follows the strategic guidance from the context files.`,
]

function augmentSystemPrompt(
  basePrompt: string,
  tools: { searchWeb: boolean; enrichCrm: boolean }
): string {
  const additions: string[] = []

  if (tools.searchWeb) {
    additions.push(
      [
        'If web search is available, you should use it whenever the company or organization can be identified.',
        'Do background research to capture the company website, headquarters or business address if available, what the company does, and a few concrete context details that make the document feel tailored.',
        'Use those findings in the document itself so it is obvious the research was performed.',
        'Include a short company background or context section that references the discovered website and key facts, and weave relevant research into the scope, rationale, or recommendations.',
        'Do not invent facts. If a detail cannot be verified from search results, omit it or clearly qualify it.',
      ].join(' ')
    )
  }

  return additions.length > 0 ? `${basePrompt}\n\n${additions.join('\n\n')}` : basePrompt
}

function stripOutputPreamble(text: string): string {
  const trimmedStart = text.trimStart()

  for (const preamble of UNWANTED_OUTPUT_PREAMBLES) {
    if (trimmedStart.startsWith(preamble)) {
      return trimmedStart.slice(preamble.length).replace(/^\s+/, '')
    }
  }

  return text
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      model,
      systemPromptStyle,
      customSystemPrompt,
      messages,
      tools,
    }: {
      model: string
      systemPromptStyle: string
      customSystemPrompt?: string
      messages: Message[]
      tools: {
        searchWeb: boolean
        enrichCrm: boolean
      }
    } = body

    const resolvedModel = model || DEFAULT_MODEL_ID

    let systemPrompt = customSystemPrompt || ''
    if (systemPromptStyle !== 'custom') {
      const preset = SYSTEM_PROMPT_PRESETS.find((p) => p.id === systemPromptStyle)
      systemPrompt = preset?.prompt ?? SYSTEM_PROMPT_PRESETS[0].prompt
    }

    systemPrompt = augmentSystemPrompt(systemPrompt, tools)

    const enabledFunctionTools: string[] = []
    if (tools.searchWeb) enabledFunctionTools.push('search_web')
    if (tools.enrichCrm) enabledFunctionTools.push('enrich_crm')

    const result = await generate({
      model: resolvedModel,
      systemPrompt,
      messages,
      enabledTools: enabledFunctionTools,
    })
    const cleanedText = stripOutputPreamble(result.text)

    const { MODELS } = await import('@/lib/models')
    const modelConfig = MODELS.find((m) => m.id === resolvedModel)

    let runId: string | null = null
    try {
      await initDb()
      const allEnabledTools = Object.entries(tools)
        .filter(([, v]) => v)
        .map(([k]) => k)

      const run = await saveRun({
        model: resolvedModel,
        provider: modelConfig?.vendor ?? modelConfig?.provider ?? 'unknown',
        system_prompt_style: systemPromptStyle,
        prompt: messages[messages.length - 1]?.content ?? '',
        output: cleanedText,
        latency_ms: result.latencyMs,
        estimated_cost_usd: result.estimatedCostUsd,
        tools_enabled: allEnabledTools,
      })
      runId = run.id
    } catch (dbErr) {
      console.warn('DB unavailable, skipping run persistence:', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    return NextResponse.json({
      text: cleanedText,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      runId,
      toolCallLog: result.toolCallLog,
    })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
