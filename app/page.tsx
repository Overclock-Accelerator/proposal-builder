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
import type { Run } from "@/lib/db"
import {
  Loader2,
  FileText,
  Settings,
  BarChart3,
  Send,
  Download,
  Link,
  RefreshCw,
  Zap,
  DollarSign,
  Clock,
  ChevronDown,
  Sparkles,
} from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface RunResult {
  text: string
  latencyMs: number
  estimatedCostUsd: number
  inputTokens: number
  outputTokens: number
  signableUrl: string | null
  logoUrl: string | null
  runId: string
}

interface Config {
  model: string
  systemPromptStyle: string
  customSystemPrompt: string
  tools: {
    mirrorSamples: boolean
    extractLogo: boolean
    signableLink: boolean
    downloadPdf: boolean
  }
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-500/15 text-green-400 border-green-500/30",
  anthropic: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  gemini: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  openrouter: "bg-purple-500/15 text-purple-400 border-purple-500/30",
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google",
  openrouter: "OpenRouter",
}

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
    model: "gpt-4o-mini",
    systemPromptStyle: "professional",
    customSystemPrompt: "",
    tools: {
      mirrorSamples: false,
      extractLogo: false,
      signableLink: false,
      downloadPdf: false,
    },
  })

  const [prompt, setPrompt] = useState("")
  const [referenceContent, setReferenceContent] = useState("")
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
            mirrorSamples: config.tools.mirrorSamples,
            referenceContent,
            tools: config.tools,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Generation failed")
        setLastResult(data)
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
    [config, referenceContent]
  )

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    const msgs: Message[] = [{ role: "user", content: prompt }]
    await callGenerate(msgs)
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900">
      <header className="border-b border-neutral-700/50 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm tracking-tight">Proposal Builder</h1>
              <p className="text-xs text-neutral-400">AI Engineering Demo — Overclock Accelerator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentModel && (
              <Badge variant="outline" className={`text-xs ${PROVIDER_COLORS[currentModel.provider]}`}>
                {PROVIDER_LABELS[currentModel.provider]} · {currentModel.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs text-neutral-300 border-neutral-600">
              {currentModel?.inputPricePer1K === 0 ? "Free tier" : `$${currentModel?.inputPricePer1K}/1K in`}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-neutral-900/80 border border-neutral-700/50">
            <TabsTrigger value="builder" className="flex items-center gap-2 text-neutral-400 data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
              <FileText className="w-4 h-4" />
              Proposal Builder
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2 text-neutral-400 data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 text-neutral-400 data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4" />
              Run Analytics
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: BUILDER */}
          <TabsContent value="builder" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card className="bg-neutral-900 border-neutral-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-neutral-200">Describe Your Engagement</CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      Tell the AI what kind of consulting work this covers. Include client, deliverables, timeline, budget.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="e.g. I need a consulting agreement for a 3-month data analytics engagement with a mid-size fintech company. Budget is $25,000. Deliverables include a data pipeline audit, recommendations report, and 2 strategy sessions..."
                      className="min-h-[160px] bg-neutral-950 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 resize-none text-sm"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={isGenerating || !prompt.trim()}
                      className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-medium transition-colors disabled:opacity-40"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating with {currentModel?.name}…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Generate Proposal
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-700/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-neutral-200">Reference Content</CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      Paste a sample proposal or agreement. Used when Mirror Samples or Extract Logo is enabled.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Paste a sample proposal, contract, or any reference content here..."
                      className="min-h-[120px] bg-neutral-950 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 resize-none text-sm font-mono"
                      value={referenceContent}
                      onChange={(e) => setReferenceContent(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {Object.values(config.tools).some(Boolean) && (
                  <div className="flex flex-wrap gap-2">
                    {config.tools.mirrorSamples && (
                      <Badge variant="secondary" className="text-xs bg-violet-500/20 text-violet-300 border-violet-500/30">
                        Mirror Samples
                      </Badge>
                    )}
                    {config.tools.extractLogo && (
                      <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">
                        Extract Logo
                      </Badge>
                    )}
                    {config.tools.signableLink && (
                      <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-300 border-green-500/30">
                        Signable Link
                      </Badge>
                    )}
                    {config.tools.downloadPdf && (
                      <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-300 border-orange-500/30">
                        PDF Export
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div ref={outputRef} className="space-y-4">
                {error && (
                  <Card className="bg-red-950/30 border-red-800">
                    <CardContent className="pt-4">
                      <p className="text-red-400 text-sm">{error}</p>
                    </CardContent>
                  </Card>
                )}

                {isGenerating && !lastResult && (
                  <Card className="bg-neutral-900 border-neutral-700/50">
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
                        <p className="text-neutral-400 text-sm">Generating with {currentModel?.name}…</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {lastResult && (
                  <>
                    <div className="flex items-center gap-4 text-xs text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatLatency(lastResult.latencyMs)}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatCost(lastResult.estimatedCostUsd)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {lastResult.inputTokens + lastResult.outputTokens} tokens
                      </span>
                    </div>

                    {lastResult.logoUrl && (
                      <div className="flex items-center gap-2 p-3 bg-neutral-900 border border-neutral-700/50 rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lastResult.logoUrl}
                          alt="Extracted logo"
                          className="h-10 object-contain max-w-[120px]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                        <span className="text-xs text-neutral-400">Logo extracted from reference</span>
                      </div>
                    )}

                    <Card className="bg-neutral-900 border-neutral-700/50">
                      <CardContent className="pt-4">
                        <pre className="whitespace-pre-wrap text-sm text-neutral-100 font-sans leading-7">
                          {lastResult.text}
                        </pre>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap gap-2">
                      {config.tools.downloadPdf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                          onClick={handleDownloadPdf}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download PDF
                        </Button>
                      )}
                      {lastResult.signableUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600 text-green-400 hover:bg-green-900/30 hover:text-green-300 transition-colors"
                          onClick={() => window.open(lastResult.signableUrl!, "_blank")}
                        >
                          <Link className="w-3 h-3 mr-1" />
                          Sign Document
                        </Button>
                      )}
                      {config.tools.signableLink && !lastResult.signableUrl && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <Link className="w-3 h-3" />
                          Signing link unavailable
                        </span>
                      )}
                    </div>

                    <Separator className="bg-neutral-800" />
                    <div className="space-y-2">
                      <p className="text-xs text-neutral-400">Refine or adjust the output:</p>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="e.g. Make it shorter, add a payment milestone at 30 days, use more formal language..."
                          className="min-h-[80px] bg-neutral-950 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 resize-none text-sm flex-1"
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={handleFollowUp}
                          disabled={isGenerating || !followUp.trim()}
                          className="bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white self-end transition-colors disabled:opacity-40"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {messages.length > 2 && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-neutral-400 flex items-center gap-1 select-none">
                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                          {Math.floor(messages.length / 2)} prior exchange{messages.length > 3 ? "s" : ""}
                        </summary>
                        <div className="mt-2 space-y-2">
                          {messages.slice(0, -2).map((msg, i) => (
                            <div
                              key={i}
                              className={`text-xs p-2 rounded ${
                                msg.role === "user"
                                  ? "bg-violet-950/40 text-violet-300"
                                  : "bg-neutral-800 text-neutral-400"
                              }`}
                            >
                              <span className="font-medium uppercase text-[10px] tracking-wider opacity-60">
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
                  <Card className="bg-neutral-900 border-neutral-700/50 border-dashed">
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-2">
                        <FileText className="w-8 h-8 text-neutral-600 mx-auto" />
                        <p className="text-neutral-400 text-sm">Your generated proposal will appear here</p>
                        <p className="text-neutral-500 text-xs">Configure your model and settings in the Config tab</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: CONFIG */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-neutral-900 border-neutral-700/50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-neutral-200">Model Selection</CardTitle>
                  <CardDescription className="text-xs text-neutral-400">
                    Compare cost and capability across providers. Prices shown per 1K tokens.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setConfig((c) => ({ ...c, model: model.id }))}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        config.model === model.id
                          ? "border-violet-500/60 bg-violet-950/30 shadow-sm shadow-violet-500/10"
                          : "border-neutral-700/40 bg-neutral-950 hover:border-neutral-600/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              config.model === model.id ? "bg-violet-400" : "bg-neutral-600"
                            }`}
                          />
                          <span className="text-sm font-medium text-neutral-200">{model.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${PROVIDER_COLORS[model.provider]}`}
                          >
                            {PROVIDER_LABELS[model.provider]}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-neutral-400">
                            {model.inputPricePer1K === 0
                              ? "Free"
                              : `$${model.inputPricePer1K}/1K`}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 ml-4">{model.description}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="bg-neutral-900 border-neutral-700/50">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-neutral-200">System Prompt Style</CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      Controls the AI&apos;s personality and writing style for generation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select
                      value={config.systemPromptStyle}
                      onValueChange={(v) => setConfig((c) => ({ ...c, systemPromptStyle: v ?? "professional" }))}
                    >
                      <SelectTrigger className="bg-neutral-950 border-neutral-700 text-neutral-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-700">
                        {SYSTEM_PROMPT_PRESETS.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-neutral-200">
                            {p.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-neutral-200">
                          ✏️ Custom Prompt
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {config.systemPromptStyle !== "custom" && (
                      <div className="p-3 bg-neutral-950 rounded border border-neutral-700/50">
                        <p className="text-xs text-neutral-400 line-clamp-4">
                          {SYSTEM_PROMPT_PRESETS.find((p) => p.id === config.systemPromptStyle)?.prompt}
                        </p>
                      </div>
                    )}

                    {config.systemPromptStyle === "custom" && (
                      <Textarea
                        placeholder="Write your own system prompt..."
                        className="min-h-[120px] bg-neutral-950 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 resize-none text-sm"
                        value={config.customSystemPrompt}
                        onChange={(e) => setConfig((c) => ({ ...c, customSystemPrompt: e.target.value }))}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-700/50">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-neutral-200">Tool Toggles</CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      Enable capabilities that affect how the document is generated and delivered.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        key: "mirrorSamples" as const,
                        label: "Mirror Samples Provided",
                        description: "Use reference content to match style and structure of the output",
                        color: "text-violet-400",
                      },
                      {
                        key: "extractLogo" as const,
                        label: "Extract and Place Logo",
                        description: "Detect an image/logo from reference content and display it in the output",
                        color: "text-blue-400",
                      },
                      {
                        key: "signableLink" as const,
                        label: "Generate Signable Web Link",
                        description: "Create a SignWell signing link for the generated agreement",
                        color: "text-green-400",
                      },
                      {
                        key: "downloadPdf" as const,
                        label: "Download PDF",
                        description: "Enable PDF/HTML export of the final generated document",
                        color: "text-orange-400",
                      },
                    ].map((tool) => (
                      <div key={tool.key} className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${tool.color}`}>{tool.label}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">{tool.description}</p>
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
                    color: "text-blue-400",
                  },
                  {
                    label: "Estimated Cost",
                    value: formatCost(lastResult.estimatedCostUsd),
                    icon: <DollarSign className="w-4 h-4" />,
                    color: "text-green-400",
                  },
                  {
                    label: "Total Tokens",
                    value: (lastResult.inputTokens + lastResult.outputTokens).toLocaleString(),
                    icon: <Zap className="w-4 h-4" />,
                    color: "text-yellow-400",
                  },
                  {
                    label: "Model",
                    value: currentModel?.name ?? "—",
                    icon: <Sparkles className="w-4 h-4" />,
                    color: "text-violet-400",
                  },
                ].map((stat) => (
                  <Card key={stat.label} className="bg-neutral-900 border-neutral-700/50">
                    <CardContent className="pt-4">
                      <div className={`flex items-center gap-2 ${stat.color} mb-1`}>
                        {stat.icon}
                        <span className="text-xs text-neutral-400">{stat.label}</span>
                      </div>
                      <p className="text-xl font-semibold text-neutral-100">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {lastResult && (
              <Card className="bg-neutral-900 border-neutral-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-neutral-200">Last Run — Tools Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(config.tools).map(([key, enabled]) => (
                      <Badge
                        key={key}
                        variant={enabled ? "secondary" : "outline"}
                        className={
                          enabled
                            ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                            : "text-neutral-500 border-neutral-700"
                        }
                      >
                        {enabled ? "✓" : "○"}{" "}
                        {key === "mirrorSamples"
                          ? "Mirror Samples"
                          : key === "extractLogo"
                          ? "Extract Logo"
                          : key === "signableLink"
                          ? "Signable Link"
                          : "Download PDF"}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-neutral-900 border-neutral-700/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-neutral-200">Run History</CardTitle>
                  <CardDescription className="text-xs text-neutral-400">
                    Compare performance across models, prompts, and tool configurations
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-neutral-600 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                  onClick={loadRuns}
                  disabled={isLoadingRuns}
                >
                  {isLoadingRuns ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="text-neutral-400 text-sm">No runs yet</p>
                    <p className="text-neutral-500 text-xs mt-1">Generate a proposal to see analytics here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-neutral-700/50 text-neutral-400">
                          <th className="text-left pb-2 pr-4 font-medium">Model</th>
                          <th className="text-left pb-2 pr-4 font-medium">Provider</th>
                          <th className="text-right pb-2 pr-4 font-medium">Latency</th>
                          <th className="text-right pb-2 pr-4 font-medium">Cost</th>
                          <th className="text-left pb-2 pr-4 font-medium">Tools</th>
                          <th className="text-left pb-2 font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((run) => (
                          <tr key={run.id} className="border-b border-neutral-700/30 hover:bg-neutral-800/50 transition-colors">
                            <td className="py-2 pr-4 text-neutral-200 font-medium">{run.model}</td>
                            <td className="py-2 pr-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${PROVIDER_COLORS[run.provider] ?? ""}`}
                              >
                                {PROVIDER_LABELS[run.provider] ?? run.provider}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4 text-right text-neutral-300">
                              {formatLatency(run.latency_ms)}
                            </td>
                            <td className="py-2 pr-4 text-right text-neutral-300">
                              {formatCost(Number(run.estimated_cost_usd))}
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(run.tools_enabled) && run.tools_enabled.length > 0 ? (
                                  run.tools_enabled.map((t) => (
                                    <Badge
                                      key={t}
                                      variant="secondary"
                                      className="text-[10px] px-1 py-0 bg-violet-500/20 text-violet-400 border-violet-500/20"
                                    >
                                      {t}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-neutral-500">none</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 text-neutral-400">
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
