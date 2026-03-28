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
      mirrorSamples,
      referenceContent,
      tools,
    }: {
      model: string
      systemPromptStyle: string
      customSystemPrompt?: string
      messages: Message[]
      mirrorSamples: boolean
      referenceContent: string
      tools: { mirrorSamples: boolean; extractLogo: boolean; signableLink: boolean; downloadPdf: boolean }
    } = body

    let systemPrompt = customSystemPrompt || ''
    if (systemPromptStyle !== 'custom') {
      const preset = SYSTEM_PROMPT_PRESETS.find((p) => p.id === systemPromptStyle)
      systemPrompt = preset?.prompt ?? SYSTEM_PROMPT_PRESETS[0].prompt
    }

    const result = await generate({
      model,
      systemPrompt,
      messages,
      mirrorSamples: tools.mirrorSamples,
      referenceContent,
    })

    // Determine which model's provider
    const { MODELS } = await import('@/lib/models')
    const modelConfig = MODELS.find((m) => m.id === model)

    // Signable link via SignWell if enabled
    let signableUrl: string | null = null
    if (tools.signableLink && process.env.SIGNWELL_API_KEY) {
      try {
        const signwellRes = await fetch('https://www.signwell.com/api/v1/document-templates/', {
          method: 'POST',
          headers: {
            'X-Api-Key': process.env.SIGNWELL_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Generated Consulting Agreement',
            files: [
              {
                name: 'agreement.txt',
                file_base64: Buffer.from(result.text).toString('base64'),
              },
            ],
            recipients: [{ id: '1', name: 'Client', email: 'client@example.com', role: 'signer' }],
            fields: {},
          }),
        })
        if (signwellRes.ok) {
          const signwellData = await signwellRes.json()
          signableUrl = signwellData.signing_url || signwellData.document_url || null
        }
      } catch (e) {
        console.error('SignWell error:', e)
        // Non-fatal: continue without signing link
      }
    }

    // Extract logo from reference content if enabled
    let logoUrl: string | null = null
    if (tools.extractLogo && referenceContent) {
      const urlMatch = referenceContent.match(/https?:\/\/[^\s"'<>]+(?:\.png|\.jpg|\.jpeg|\.svg|\.gif|\.webp)/i)
      if (urlMatch) logoUrl = urlMatch[0]
      // Also check for base64 images
      const b64Match = referenceContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
      if (b64Match && !logoUrl) logoUrl = b64Match[0]
    }

    // Save run to DB
    await initDb()
    const enabledTools = Object.entries(tools)
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
      tools_enabled: enabledTools,
    })

    return NextResponse.json({
      text: result.text,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      signableUrl,
      logoUrl,
      runId: run.id,
    })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
