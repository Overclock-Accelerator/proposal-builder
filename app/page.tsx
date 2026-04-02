"use client"

import { useState, useRef, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MODELS, SYSTEM_PROMPT_PRESETS } from "@/lib/models"
import type { Message } from "@/lib/llm"
import type { ToolResult } from "@/lib/tools"
import type { Run } from "@/lib/db"
import {
  Loader2,
  FileText,
  Settings,
  BarChart3,
  Send,
  Download,
  RefreshCw,
  Zap,
  DollarSign,
  Clock,
  ChevronDown,
  Sparkles,
  Code2,
} from "lucide-react"

interface RunResult {
  text: string
  latencyMs: number
  estimatedCostUsd: number
  inputTokens: number
  outputTokens: number
  runId: string
  toolCallLog: ToolResult[]
}

interface Config {
  model: string
  systemPromptStyle: string
  customSystemPrompt: string
  tools: {
    searchWeb: boolean
    enrichCompany: boolean
    enrichCrm: boolean
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: "OpenRouter",
}

const CATEGORY_LABELS: Record<string, string> = {
  fast: "Fast",
  performant: "Performant",
  both: "Fast & Performant",
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  searchWeb: "Search Web",
  enrichCompany: "Enrich Company",
  enrichCrm: "Enrich CRM",
}

const SAMPLE_ENGAGEMENT_PROMPTS = [
  "Draft a consulting proposal for a 6-week AI workflow audit for Northstar CRM, a B2B SaaS company. Budget is $18,000. Deliverables include stakeholder interviews, process mapping, automation opportunities, and a final recommendations workshop.",
  "Create a proposal for a 3-month growth strategy engagement for LedgerLoop, an early-stage fintech startup. Budget is $35,000. Scope includes market positioning, KPI design, pricing experiments, and biweekly advisory sessions.",
  "Generate a consulting agreement for a cybersecurity readiness assessment for Harbor Health Network, a regional healthcare organization. Timeline is 8 weeks with a $42,000 budget. Deliverables include risk review, compliance gap analysis, remediation roadmap, and executive briefing.",
  "Write a proposal for a product analytics implementation for Alder & Ash, an ecommerce brand preparing for a holiday launch. Budget is $22,500 over 5 weeks. Deliverables include event taxonomy, dashboard setup, QA, and team training.",
  "Prepare a consulting proposal for a fractional CTO engagement with FleetForge Logistics. This is a 2-month engagement at $28,000 covering architecture review, vendor evaluation, engineering planning, and weekly leadership calls.",
  "Create a proposal for a brand messaging and website conversion audit for Verdant Grid, a climate tech company. Timeline is 4 weeks and budget is $12,000. Deliverables include homepage copy recommendations, messaging framework, and conversion experiments.",
] as const

function formatCost(usd: number): string {
  if (usd === 0) return "Free"
  if (usd < 0.0001) return "<$0.0001"
  return `$${usd.toFixed(4)}`
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("builder")

  const [config, setConfig] = useState<Config>({
    model: "anthropic/claude-sonnet-4.5",
    systemPromptStyle: "professional",
    customSystemPrompt: SYSTEM_PROMPT_PRESETS.find((p) => p.id === "professional")?.prompt ?? "",
    tools: {
      searchWeb: false,
      enrichCompany: false,
      enrichCrm: false,
    },
  })

  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [followUp, setFollowUp] = useState("")
  const [lastResult, setLastResult] = useState<RunResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [runs, setRuns] = useState<Run[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(false)

  const outputRef = useRef<HTMLDivElement>(null)

  const callGenerate = useCallback(
    async (msgs: Message[]) => {
      setIsGenerating(true)
      setError(null)
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            systemPromptStyle: config.systemPromptStyle,
            customSystemPrompt: config.customSystemPrompt,
            messages: msgs,
            tools: config.tools,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Generation failed")
        setLastResult({ ...data, toolCallLog: data.toolCallLog ?? [] })
        setMessages([...msgs, { role: "assistant", content: data.text }])
        setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
        return data
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return null
      } finally {
        setIsGenerating(false)
      }
    },
    [config]
  )

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    const msgs: Message[] = [{ role: "user", content: prompt }]
    await callGenerate(msgs)
  }

  const handleRandomPrompt = () => {
    const nextPrompt =
      SAMPLE_ENGAGEMENT_PROMPTS[Math.floor(Math.random() * SAMPLE_ENGAGEMENT_PROMPTS.length)]

    setPrompt(nextPrompt)
    setError(null)
  }

  const handleFollowUp = async () => {
    if (!followUp.trim()) return
    const msgs = [...messages, { role: "user" as const, content: followUp }]
    setFollowUp("")
    await callGenerate(msgs)
  }

  const handleDownloadPdf = async () => {
    if (!lastResult) return
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: lastResult.text, title: "Consulting Agreement" }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `proposal-${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadRuns = async () => {
    setIsLoadingRuns(true)
    try {
      const res = await fetch("/api/runs")
      const data = await res.json()
      setRuns(data.runs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingRuns(false)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === "analytics") loadRuns()
  }

  const currentModel = MODELS.find((m) => m.id === config.model)
  const activeFunctionTools = lastResult?.toolCallLog ?? []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-foreground flex items-center justify-center shrink-0">
              <span className="font-heading text-background text-base font-bold leading-none">P</span>
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold leading-none tracking-[0.01em] text-foreground">Proposal Builder</h1>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Overclock Accelerator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentModel && (
              <>
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                  {PROVIDER_LABELS[currentModel.provider]} · {currentModel.name}
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                  {CATEGORY_LABELS[currentModel.category]}
                </Badge>
              </>
            )}
            <Badge variant="outline" className="text-xs text-muted-foreground border-border">
              {currentModel?.inputPricePer1K === 0 ? "Free tier" : `$${currentModel?.inputPricePer1K}/1K in`}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList
            variant="line"
            className="w-full border-b border-border mb-10 p-0 h-auto rounded-none justify-start gap-0"
          >
            <TabsTrigger value="builder" className="px-5 py-3 text-sm gap-2 rounded-none border-0">
              <FileText className="w-4 h-4" />
              Proposal Builder
            </TabsTrigger>
            <TabsTrigger value="config" className="px-5 py-3 text-sm gap-2 rounded-none border-0">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="analytics" className="px-5 py-3 text-sm gap-2 rounded-none border-0">
              <BarChart3 className="w-4 h-4" />
              Run Analytics
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: BUILDER */}
          <TabsContent value="builder" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Describe Your Engagement</CardTitle>
                    <CardDescription className="text-[13px] leading-relaxed">
                      Tell the AI what kind of consulting work this covers. Include client, deliverables, timeline, budget.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="e.g. I need a consulting agreement for a 3-month data analytics engagement with a mid-size fintech company. Budget is $25,000. Deliverables include a data pipeline audit, recommendations report, and 2 strategy sessions..."
                      className="min-h-[180px] resize-none text-sm leading-relaxed"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRandomPrompt}
                        disabled={isGenerating}
                        className="h-10 sm:w-auto"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Random Demo Prompt
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={isGenerating || !prompt.trim()}
                        className="h-10 flex-1 bg-foreground text-background hover:bg-foreground/90 font-medium transition-all disabled:opacity-30"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating with {currentModel?.name}...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Generate Proposal
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {Object.values(config.tools).some(Boolean) && (
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(config.tools) as [keyof Config["tools"], boolean][])
                      .filter(([, enabled]) => enabled)
                      .map(([key]) => (
                        <Badge key={key} variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                          <Code2 className="w-3 h-3 mr-1" />
                          {TOOL_DISPLAY_NAMES[key]}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>

              <div ref={outputRef} className="space-y-5">
                {error && (
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="pt-4">
                      <p className="text-red-600 text-sm">{error}</p>
                    </CardContent>
                  </Card>
                )}

                {isGenerating && !lastResult && (
                  <Card>
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground text-sm">Generating with {currentModel?.name}...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {lastResult && (
                  <>
                    <div className="flex items-center gap-5 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {formatLatency(lastResult.latencyMs)}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="w-3.5 h-3.5" />
                        {formatCost(lastResult.estimatedCostUsd)}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Zap className="w-3.5 h-3.5" />
                        {lastResult.inputTokens + lastResult.outputTokens} tokens
                      </span>
                      {activeFunctionTools.length > 0 && (
                        <span className="flex items-center gap-1.5 text-blue-600">
                          <Code2 className="w-3.5 h-3.5" />
                          {activeFunctionTools.length} tool call{activeFunctionTools.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {activeFunctionTools.length > 0 && (
                      <Card className="border-blue-200 bg-blue-50/40">
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                            <Code2 className="w-4 h-4" />
                            Tool Call Log — LLM invoked {activeFunctionTools.length} function{activeFunctionTools.length > 1 ? "s" : ""}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pb-4">
                          {activeFunctionTools.map((call, i) => (
                            <div key={i} className="bg-white border border-blue-100 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-semibold text-blue-700">{call.toolName}()</span>
                                <span className="text-[10px] text-muted-foreground">{call.durationMs}ms</span>
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground bg-muted/40 p-2 overflow-x-auto">
                                {JSON.stringify(call.args, null, 2)}
                              </div>
                              <p className="text-[12px] text-foreground/80 leading-relaxed line-clamp-3">
                                {call.result}
                              </p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardContent className="pt-5 pb-5">
                        <pre className="whitespace-pre-wrap text-[14px] font-sans leading-7">
                          {lastResult.text}
                        </pre>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download PDF
                      </Button>
                    </div>

                    <Separator />
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Refine output</p>
                      <div className="flex gap-3">
                        <Textarea
                          placeholder="e.g. Make it shorter, add a payment milestone at 30 days, use more formal language..."
                          className="min-h-[80px] resize-none text-sm flex-1"
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={handleFollowUp}
                          disabled={isGenerating || !followUp.trim()}
                          className="bg-foreground text-background hover:bg-foreground/90 self-end transition-all disabled:opacity-30"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {messages.length > 2 && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1.5 select-none hover:text-foreground transition-colors">
                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                          {Math.floor(messages.length / 2)} prior exchange{messages.length > 3 ? "s" : ""}
                        </summary>
                        <div className="mt-3 space-y-2">
                          {messages.slice(0, -2).map((msg, i) => (
                            <div
                              key={i}
                              className={`text-xs p-3 border ${
                                msg.role === "user"
                                  ? "border-foreground/20 bg-foreground/5"
                                  : "border-border bg-muted/30"
                              }`}
                            >
                              <span className="font-medium uppercase text-[10px] tracking-wider opacity-50">
                                {msg.role}
                              </span>
                              <p className="mt-1 line-clamp-3">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}

                {!lastResult && !isGenerating && (
                  <Card className="border-dashed">
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 border border-border flex items-center justify-center mx-auto">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Your generated proposal will appear here</p>
                        <p className="text-muted-foreground/60 text-xs">Configure your model and AI tools in the Config tab</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: CONFIG */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Model Selection</CardTitle>
                  <CardDescription className="text-[13px] leading-relaxed">
                    Every request runs through OpenRouter. Choose the underlying model and compare pricing per 1K tokens.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setConfig((c) => ({ ...c, model: model.id }))}
                      className={`w-full text-left p-4 border transition-all ${
                        config.model === model.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border bg-background hover:border-foreground/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 transition-colors ${
                              config.model === model.id ? "bg-foreground" : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="text-sm font-medium">{model.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {PROVIDER_LABELS[model.provider]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {CATEGORY_LABELS[model.category]}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            {model.inputPricePer1K === 0
                              ? "Free"
                              : `$${model.inputPricePer1K}/1K`}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 ml-5">{model.description}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">System Prompt Style</CardTitle>
                    <CardDescription className="text-[13px] leading-relaxed">
                      Controls the AI&apos;s personality and writing style for generation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select
                      value={config.systemPromptStyle}
                      onValueChange={(v) => {
                        const preset = SYSTEM_PROMPT_PRESETS.find((p) => p.id === v)
                        setConfig((c) => ({
                          ...c,
                          systemPromptStyle: v ?? "professional",
                          customSystemPrompt: preset?.prompt ?? c.customSystemPrompt,
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_PROMPT_PRESETS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">
                          Custom Prompt
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Textarea
                      placeholder="Write your own system prompt..."
                      className="min-h-[160px] resize-y text-sm leading-relaxed"
                      value={config.customSystemPrompt}
                      onChange={(e) => setConfig((c) => ({ ...c, systemPromptStyle: "custom", customSystemPrompt: e.target.value }))}
                    />
                  </CardContent>
                </Card>

                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-blue-600" />
                      AI Function Calling Tools
                    </CardTitle>
                    <CardDescription className="text-[13px] leading-relaxed">
                      The LLM actively decides when to invoke these during generation. Results are returned to the model before it writes the proposal — the model cannot fake them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      {
                        key: "searchWeb" as const,
                        label: "Search Web",
                        description: "LLM calls Tavily for live information it can't know from training data",
                      },
                      {
                        key: "enrichCompany" as const,
                        label: "Enrich Company",
                        description: "LLM fetches real-time company intelligence — funding, products, news — to personalize the proposal",
                      },
                      {
                        key: "enrichCrm" as const,
                        label: "Enrich CRM",
                        description: "LLM logs the opportunity to a Notion CRM database once it has enough context from the conversation",
                      },
                    ].map((tool) => (
                      <div key={tool.key} className="flex items-start justify-between gap-4 p-3 hover:bg-blue-50/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{tool.label}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tool.description}</p>
                        </div>
                        <Switch
                          checked={config.tools[tool.key]}
                          onCheckedChange={(v) =>
                            setConfig((c) => ({ ...c, tools: { ...c.tools, [tool.key]: v } }))
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: ANALYTICS */}
          <TabsContent value="analytics" className="space-y-6">
            {lastResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Latency",
                    value: formatLatency(lastResult.latencyMs),
                    icon: <Clock className="w-4 h-4" />,
                  },
                  {
                    label: "Estimated Cost",
                    value: formatCost(lastResult.estimatedCostUsd),
                    icon: <DollarSign className="w-4 h-4" />,
                  },
                  {
                    label: "Total Tokens",
                    value: (lastResult.inputTokens + lastResult.outputTokens).toLocaleString(),
                    icon: <Zap className="w-4 h-4" />,
                  },
                  {
                    label: "Model",
                    value: currentModel?.name ?? "--",
                    icon: <Sparkles className="w-4 h-4" />,
                  },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        {stat.icon}
                        <span className="text-xs font-medium">{stat.label}</span>
                      </div>
                      <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {lastResult && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Last Run — Tools Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(config.tools) as [keyof Config["tools"], boolean][]).map(([key, enabled]) => (
                      <Badge
                        key={key}
                        variant={enabled ? "secondary" : "outline"}
                        className={`${enabled ? "" : "text-muted-foreground/50"} ${
                          enabled && ["searchWeb", "enrichCompany", "enrichCrm"].includes(key)
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : ""
                        }`}
                      >
                        {enabled ? "✓" : "○"} {TOOL_DISPLAY_NAMES[key]}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Run History</CardTitle>
                  <CardDescription className="text-[13px] leading-relaxed">
                    Compare performance across models, prompts, and tool configurations
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadRuns}
                  disabled={isLoadingRuns}
                >
                  {isLoadingRuns ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 border border-border flex items-center justify-center mx-auto mb-3">
                      <BarChart3 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">No runs yet</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Generate a proposal to see analytics here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Model</th>
                          <th className="text-left pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Provider</th>
                          <th className="text-right pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Latency</th>
                          <th className="text-right pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Cost</th>
                          <th className="text-left pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Tools</th>
                          <th className="text-left pb-3 font-medium text-xs uppercase tracking-wider">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((run) => (
                          <tr key={run.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                            <td className="py-3 pr-4 font-medium">{run.model}</td>
                            <td className="py-3 pr-4">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {PROVIDER_LABELS[run.provider] ?? run.provider}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-right text-muted-foreground">
                              {formatLatency(run.latency_ms)}
                            </td>
                            <td className="py-3 pr-4 text-right text-muted-foreground">
                              {formatCost(Number(run.estimated_cost_usd))}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(run.tools_enabled) && run.tools_enabled.length > 0 ? (
                                  run.tools_enabled.map((t) => (
                                    <Badge
                                      key={t}
                                      variant="secondary"
                                      className={`text-[10px] px-1 py-0 ${
                                        ["searchWeb", "enrichCompany", "enrichCrm"].includes(t)
                                          ? "bg-blue-100 text-blue-700"
                                          : ""
                                      }`}
                                    >
                                      {TOOL_DISPLAY_NAMES[t] ?? t}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground/40">none</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(run.created_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
