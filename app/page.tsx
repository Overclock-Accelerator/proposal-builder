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
  Gauge,
  Rocket,
} from "lucide-react"

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
  openai: "bg-emerald-50 text-emerald-700 border-emerald-200",
  anthropic: "bg-amber-50 text-amber-700 border-amber-200",
  gemini: "bg-sky-50 text-sky-700 border-sky-200",
  openrouter: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google",
  openrouter: "OpenRouter",
}

const CATEGORY_STYLES: Record<string, { icon: typeof Zap; label: string; className: string }> = {
  fast: { icon: Rocket, label: "Fast", className: "bg-sky-50 text-sky-600 border-sky-200" },
  performant: { icon: Gauge, label: "Performant", className: "bg-violet-50 text-violet-600 border-violet-200" },
  both: { icon: Sparkles, label: "Fast & Performant", className: "bg-indigo-50 text-indigo-600 border-indigo-200" },
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
    model: "gpt-4o",
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
    <div className="min-h-screen bg-[#fafafa]">
      {/* Top accent gradient */}
      <div className="fixed inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 z-20" />

      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-base tracking-tight">Proposal Builder</h1>
              <p className="text-[13px] text-gray-500">Overclock Accelerator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentModel && (
              <>
                <Badge variant="outline" className={`text-xs ${PROVIDER_COLORS[currentModel.provider]}`}>
                  {PROVIDER_LABELS[currentModel.provider]} · {currentModel.name}
                </Badge>
                {(() => {
                  const cat = CATEGORY_STYLES[currentModel.category]
                  const CatIcon = cat.icon
                  return (
                    <Badge variant="outline" className={`text-xs ${cat.className}`}>
                      <CatIcon className="w-3 h-3 mr-1" />
                      {cat.label}
                    </Badge>
                  )
                })()}
              </>
            )}
            <Badge variant="outline" className="text-xs text-gray-500 border-gray-200 bg-gray-50">
              {currentModel?.inputPricePer1K === 0 ? "Free tier" : `$${currentModel?.inputPricePer1K}/1K in`}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-10 bg-gray-100/80 border border-gray-200 p-1 rounded-xl">
            <TabsTrigger value="builder" className="flex items-center gap-2 text-gray-500 rounded-lg data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all">
              <FileText className="w-4 h-4" />
              Proposal Builder
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2 text-gray-500 rounded-lg data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 text-gray-500 rounded-lg data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all">
              <BarChart3 className="w-4 h-4" />
              Run Analytics
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: BUILDER */}
          <TabsContent value="builder" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">Describe Your Engagement</CardTitle>
                    <CardDescription className="text-[13px] text-gray-500 leading-relaxed">
                      Tell the AI what kind of consulting work this covers. Include client, deliverables, timeline, budget.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="e.g. I need a consulting agreement for a 3-month data analytics engagement with a mid-size fintech company. Budget is $25,000. Deliverables include a data pipeline audit, recommendations report, and 2 strategy sessions..."
                      className="min-h-[180px] bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 resize-none text-sm leading-relaxed focus:border-violet-400 focus:ring-violet-200 transition-colors"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={isGenerating || !prompt.trim()}
                      className="w-full h-10 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-violet-500/20 transition-all disabled:opacity-30 disabled:shadow-none"
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
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">Reference Content</CardTitle>
                    <CardDescription className="text-[13px] text-gray-500 leading-relaxed">
                      Paste a sample proposal or agreement. Used when Mirror Samples or Extract Logo is enabled.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Paste a sample proposal, contract, or any reference content here..."
                      className="min-h-[140px] bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 resize-none text-sm font-mono leading-relaxed focus:border-violet-400 focus:ring-violet-200 transition-colors"
                      value={referenceContent}
                      onChange={(e) => setReferenceContent(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {Object.values(config.tools).some(Boolean) && (
                  <div className="flex flex-wrap gap-2">
                    {config.tools.mirrorSamples && (
                      <Badge variant="secondary" className="text-xs bg-violet-50 text-violet-700 border border-violet-200">
                        Mirror Samples
                      </Badge>
                    )}
                    {config.tools.extractLogo && (
                      <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700 border border-sky-200">
                        Extract Logo
                      </Badge>
                    )}
                    {config.tools.signableLink && (
                      <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Signable Link
                      </Badge>
                    )}
                    {config.tools.downloadPdf && (
                      <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border border-amber-200">
                        PDF Export
                      </Badge>
                    )}
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
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
                        <p className="text-gray-500 text-sm">Generating with {currentModel?.name}...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {lastResult && (
                  <>
                    <div className="flex items-center gap-5 text-xs">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        {formatLatency(lastResult.latencyMs)}
                      </span>
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        {formatCost(lastResult.estimatedCostUsd)}
                      </span>
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        {lastResult.inputTokens + lastResult.outputTokens} tokens
                      </span>
                    </div>

                    {lastResult.logoUrl && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lastResult.logoUrl}
                          alt="Extracted logo"
                          className="h-10 object-contain max-w-[120px]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                        <span className="text-xs text-gray-500">Logo extracted from reference</span>
                      </div>
                    )}

                    <Card className="bg-white border-gray-200 shadow-sm">
                      <CardContent className="pt-5 pb-5">
                        <pre className="whitespace-pre-wrap text-[14px] text-gray-800 font-sans leading-7">
                          {lastResult.text}
                        </pre>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap gap-2">
                      {config.tools.downloadPdf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:text-gray-900 transition-all"
                          onClick={handleDownloadPdf}
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Download PDF
                        </Button>
                      )}
                      {lastResult.signableUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 transition-all"
                          onClick={() => window.open(lastResult.signableUrl!, "_blank")}
                        >
                          <Link className="w-3.5 h-3.5 mr-1.5" />
                          Sign Document
                        </Button>
                      )}
                      {config.tools.signableLink && !lastResult.signableUrl && (
                        <span className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Link className="w-3.5 h-3.5" />
                          Signing link unavailable
                        </span>
                      )}
                    </div>

                    <Separator className="bg-gray-200" />
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Refine output</p>
                      <div className="flex gap-3">
                        <Textarea
                          placeholder="e.g. Make it shorter, add a payment milestone at 30 days, use more formal language..."
                          className="min-h-[80px] bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 resize-none text-sm flex-1 focus:border-violet-400 focus:ring-violet-200 transition-colors"
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={handleFollowUp}
                          disabled={isGenerating || !followUp.trim()}
                          className="bg-violet-600 hover:bg-violet-500 text-white self-end transition-all disabled:opacity-30"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {messages.length > 2 && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-gray-400 flex items-center gap-1.5 select-none hover:text-gray-600 transition-colors">
                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                          {Math.floor(messages.length / 2)} prior exchange{messages.length > 3 ? "s" : ""}
                        </summary>
                        <div className="mt-3 space-y-2">
                          {messages.slice(0, -2).map((msg, i) => (
                            <div
                              key={i}
                              className={`text-xs p-3 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-violet-50 text-violet-700 border border-violet-100"
                                  : "bg-gray-50 text-gray-600 border border-gray-100"
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
                  <Card className="bg-gray-50/50 border-gray-200 border-dashed shadow-none">
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto">
                          <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Your generated proposal will appear here</p>
                        <p className="text-gray-400 text-xs">Configure your model and settings in the Config tab</p>
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
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">Model Selection</CardTitle>
                  <CardDescription className="text-[13px] text-gray-500 leading-relaxed">
                    Compare cost and capability across providers. Prices shown per 1K tokens.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {MODELS.map((model) => {
                    const cat = CATEGORY_STYLES[model.category]
                    const CatIcon = cat.icon
                    return (
                      <button
                        key={model.id}
                        onClick={() => setConfig((c) => ({ ...c, model: model.id }))}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          config.model === model.id
                            ? "border-violet-300 bg-violet-50/50 shadow-sm ring-1 ring-violet-200"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full transition-colors ${
                                config.model === model.id ? "bg-violet-500 shadow-sm shadow-violet-400/50" : "bg-gray-300"
                              }`}
                            />
                            <span className="text-sm font-medium text-gray-800">{model.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${PROVIDER_COLORS[model.provider]}`}
                            >
                              {PROVIDER_LABELS[model.provider]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${cat.className}`}
                            >
                              <CatIcon className="w-2.5 h-2.5 mr-0.5" />
                              {cat.label}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400">
                              {model.inputPricePer1K === 0
                                ? "Free"
                                : `$${model.inputPricePer1K}/1K`}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 ml-5">{model.description}</p>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">System Prompt Style</CardTitle>
                    <CardDescription className="text-[13px] text-gray-500 leading-relaxed">
                      Controls the AI&apos;s personality and writing style for generation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select
                      value={config.systemPromptStyle}
                      onValueChange={(v) => setConfig((c) => ({ ...c, systemPromptStyle: v ?? "professional" }))}
                    >
                      <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-800 hover:border-gray-300 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {SYSTEM_PROMPT_PRESETS.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-gray-800 focus:bg-gray-100 focus:text-gray-900">
                            {p.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-gray-800 focus:bg-gray-100 focus:text-gray-900">
                          Custom Prompt
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {config.systemPromptStyle !== "custom" && (
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 line-clamp-4 leading-relaxed">
                          {SYSTEM_PROMPT_PRESETS.find((p) => p.id === config.systemPromptStyle)?.prompt}
                        </p>
                      </div>
                    )}

                    {config.systemPromptStyle === "custom" && (
                      <Textarea
                        placeholder="Write your own system prompt..."
                        className="min-h-[120px] bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 resize-none text-sm focus:border-violet-400 focus:ring-violet-200 transition-colors"
                        value={config.customSystemPrompt}
                        onChange={(e) => setConfig((c) => ({ ...c, customSystemPrompt: e.target.value }))}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">Tool Toggles</CardTitle>
                    <CardDescription className="text-[13px] text-gray-500 leading-relaxed">
                      Enable capabilities that affect how the document is generated and delivered.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {[
                      {
                        key: "mirrorSamples" as const,
                        label: "Mirror Samples Provided",
                        description: "Use reference content to match style and structure of the output",
                        color: "text-violet-600",
                      },
                      {
                        key: "extractLogo" as const,
                        label: "Extract and Place Logo",
                        description: "Detect an image/logo from reference content and display it in the output",
                        color: "text-sky-600",
                      },
                      {
                        key: "signableLink" as const,
                        label: "Generate Signable Web Link",
                        description: "Create a SignWell signing link for the generated agreement",
                        color: "text-emerald-600",
                      },
                      {
                        key: "downloadPdf" as const,
                        label: "Download PDF",
                        description: "Enable PDF/HTML export of the final generated document",
                        color: "text-amber-600",
                      },
                    ].map((tool) => (
                      <div key={tool.key} className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${tool.color}`}>{tool.label}</p>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tool.description}</p>
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
                    color: "text-sky-600",
                    bg: "bg-sky-50",
                  },
                  {
                    label: "Estimated Cost",
                    value: formatCost(lastResult.estimatedCostUsd),
                    icon: <DollarSign className="w-4 h-4" />,
                    color: "text-emerald-600",
                    bg: "bg-emerald-50",
                  },
                  {
                    label: "Total Tokens",
                    value: (lastResult.inputTokens + lastResult.outputTokens).toLocaleString(),
                    icon: <Zap className="w-4 h-4" />,
                    color: "text-amber-600",
                    bg: "bg-amber-50",
                  },
                  {
                    label: "Model",
                    value: currentModel?.name ?? "--",
                    icon: <Sparkles className="w-4 h-4" />,
                    color: "text-violet-600",
                    bg: "bg-violet-50",
                  },
                ].map((stat) => (
                  <Card key={stat.label} className={`${stat.bg} border-gray-200 shadow-sm`}>
                    <CardContent className="pt-5 pb-4">
                      <div className={`flex items-center gap-2 ${stat.color} mb-2`}>
                        {stat.icon}
                        <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-900 tracking-tight">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {lastResult && (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">Last Run — Tools Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(config.tools).map(([key, enabled]) => (
                      <Badge
                        key={key}
                        variant={enabled ? "secondary" : "outline"}
                        className={
                          enabled
                            ? "bg-violet-50 text-violet-700 border border-violet-200"
                            : "text-gray-400 border-gray-200"
                        }
                      >
                        {enabled ? "\u2713" : "\u25CB"}{" "}
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

            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">Run History</CardTitle>
                  <CardDescription className="text-[13px] text-gray-500 leading-relaxed">
                    Compare performance across models, prompts, and tool configurations
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-200 text-gray-500 bg-white hover:bg-gray-50 hover:text-gray-700 transition-all"
                  onClick={loadRuns}
                  disabled={isLoadingRuns}
                >
                  {isLoadingRuns ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <BarChart3 className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">No runs yet</p>
                    <p className="text-gray-400 text-xs mt-1">Generate a proposal to see analytics here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-400">
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
                          <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4 text-gray-800 font-medium">{run.model}</td>
                            <td className="py-3 pr-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${PROVIDER_COLORS[run.provider] ?? ""}`}
                              >
                                {PROVIDER_LABELS[run.provider] ?? run.provider}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-600">
                              {formatLatency(run.latency_ms)}
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-600">
                              {formatCost(Number(run.estimated_cost_usd))}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(run.tools_enabled) && run.tools_enabled.length > 0 ? (
                                  run.tools_enabled.map((t) => (
                                    <Badge
                                      key={t}
                                      variant="secondary"
                                      className="text-[10px] px-1 py-0 bg-violet-50 text-violet-600 border-violet-200"
                                    >
                                      {t}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-300">none</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-gray-400">
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
