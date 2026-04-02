import { NextRequest, NextResponse } from 'next/server'
import { generate, Message } from '@/lib/llm'
import { saveRun, initDb } from '@/lib/db'
import { SYSTEM_PROMPT_PRESETS } from '@/lib/models'

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
        enrichCompany: boolean
        enrichCrm: boolean
      }
    } = body

    let systemPrompt = customSystemPrompt || ''
    if (systemPromptStyle !== 'custom') {
      const preset = SYSTEM_PROMPT_PRESETS.find((p) => p.id === systemPromptStyle)
      systemPrompt = preset?.prompt ?? SYSTEM_PROMPT_PRESETS[0].prompt
    }

    const enabledFunctionTools: string[] = []
    if (tools.searchWeb) enabledFunctionTools.push('search_web')
    if (tools.enrichCompany) enabledFunctionTools.push('enrich_company')
    if (tools.enrichCrm) enabledFunctionTools.push('enrich_crm')

    const result = await generate({
      model,
      systemPrompt,
      messages,
      enabledTools: enabledFunctionTools,
    })

    const { MODELS } = await import('@/lib/models')
    const modelConfig = MODELS.find((m) => m.id === model)

    let runId: string | null = null
    try {
      await initDb()
      const allEnabledTools = Object.entries(tools)
        .filter(([, v]) => v)
        .map(([k]) => k)

      const run = await saveRun({
        model,
        provider: modelConfig?.provider ?? 'unknown',
        system_prompt_style: systemPromptStyle,
        prompt: messages[messages.length - 1]?.content ?? '',
        output: result.text,
        latency_ms: result.latencyMs,
        estimated_cost_usd: result.estimatedCostUsd,
        tools_enabled: allEnabledTools,
      })
      runId = run.id
    } catch (dbErr) {
      console.warn('DB unavailable, skipping run persistence:', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    return NextResponse.json({
      text: result.text,
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
