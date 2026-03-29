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
  openai: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  anthropic: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  gemini: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  openrouter: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
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
    <div className="min-h-screen bg-[#09090b]">
      {/* Top accent gradient */}
      <div className="fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white text-base tracking-tight">Proposal Builder</h1>
              <p className="text-[13px] text-zinc-500">AI Engineering Demo — Overclock Accelerator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentModel && (
              <Badge variant="outline" className={`text-xs ${PROVIDER_COLORS[currentModel.provider]}`}>
                {PROVIDER_LABELS[currentModel.provider]} · {currentModel.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700/50 bg-zinc-800/30">
              {currentModel?.inputPricePer1K === 0 ? "Free tier" : `$${currentModel?.inputPricePer1K}/1K in`}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-10 bg-zinc-900/50 border border-white/[0.06] p-1 rounded-xl">
            <TabsTrigger value="builder" className="flex items-center gap-2 text-zinc-500 rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              <FileText className="w-4 h-4" />
              Proposal Builder
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2 text-zinc-500 rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 text-zinc-500 rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              <BarChart3 className="w-4 h-4" />
              Run Analytics
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: BUILDER */}
          <TabsContent value="builder" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <Card className="bg-zinc-900/50 border-white/[0.06] backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-white tracking-tight">Describe Your Engagement</CardTitle>
                    <CardDescription className="text-[13px] text-zinc-400 leading-relaxed">
                      Tell the AI what kind of consulting work this covers. Include client, deliverables, timeline, budget.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="e.g. I need a consulting agreement for a 3-month data analytics engagement with a mid-size fintech company. Budget is $25,000. Deliverables include a data pipeline audit, recommendations report, and 2 strategy sessions..."
                      className="min-h-[180px] bg-black/40 border-white/[0.08] text-zinc-100 placeholder:text-zinc-600 resize-none text-sm leading-relaxed focus:border-violet-500/50 focus:ring-violet-500/20 transition-colors"
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

                <Card className="bg-zinc-900/50 border-white/[0.06] backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-white tracking-tight">Reference Content</CardTitle>
                    <CardDescription className="text-[13px] text-zinc-400 leading-relaxed">
                      Paste a sample proposal or agreement. Used when Mirror Samples or Extract Logo is enabled.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Paste a sample proposal, contract, or any reference content here..."
                      className="min-h-[140px] bg-black/40 border-white/[0.08] text-zinc-100 placeholder:text-zinc-600 resize-none text-sm font-mono leading-relaxed focus:border-violet-500/50 focus:ring-violet-500/20 transition-colors"
                      value={referenceContent}
                      onChange={(e) => setReferenceContent(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {Object.values(config.tools).some(Boolean) && (
                  <div className="flex flex-wrap gap-2">
                    {config.tools.mirrorSamples && (
                      <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20">
                        Mirror Samples
                      </Badge>
                    )}
                    {config.tools.extractLogo && (
                      <Badge variant="secondary" className="text-xs bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        Extract Logo
                      </Badge>
                    )}
                    {config.tools.signableLink && (
                      <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Signable Link
                      </Badge>
                    )}
                    {config.tools.downloadPdf && (
                      <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        PDF Export
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div ref={outputRef} className="space-y-5">
                {error && (
                  <Card className="bg-red-950/20 border-red-500/20">
                    <CardContent className="pt-4">
                      <p className="text-red-400 text-sm">{error}</p>
                    </CardContent>
                  </Card>
                )}

                {isGenerating && !lastResult && (
                  <Card className="bg-zinc-900/50 border-white/[0.06]">
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
                        <p className="text-zinc-400 text-sm">Generating with {currentModel?.name}…</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {lastResult && (
                  <>
                    <div className="flex items-center gap-5 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        {formatLatency(lastResult.latencyMs)}
                      </span>
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        {formatCost(lastResult.estimatedCostUsd)}
                      </span>
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {lastResult.inputTokens + lastResult.outputTokens} tokens
                      </span>
                    </div>

                    {lastResult.logoUrl && (
                      <div className="flex items-center gap-3 p-4 bg-zinc-900/50 border border-white/[0.06] rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lastResult.logoUrl}
                          alt="Extracted logo"
                          className="h-10 object-contain max-w-[120px]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                        <span className="text-xs text-zinc-500">Logo extracted from reference</span>
                      </div>
                    )}

                    <Card className="bg-zinc-900/50 border-white/[0.06]">
                      <CardContent className="pt-5 pb-5">
                        <pre className="whitespace-pre-wrap text-[14px] text-zinc-200 font-sans leading-7">
                          {lastResult.text}
                        </pre>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap gap-2">
                      {config.tools.downloadPdf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-700/50 hover:text-white transition-all"
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
                          className="border-emerald-700/50 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/30 hover:text-emerald-300 transition-all"
                          onClick={() => window.open(lastResult.signableUrl!, "_blank")}
                        >
                          <Link className="w-3.5 h-3.5 mr-1.5" />
                          Sign Document
                        </Button>
                      )}
                      {config.tools.signableLink && !lastResult.signableUrl && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                          <Link className="w-3.5 h-3.5" />
                          Signing link unavailable
                        </span>
                      )}
                    </div>

                    <Separator className="bg-white/[0.06]" />
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Refine output</p>
                      <div className="flex gap-3">
                        <Textarea
                          placeholder="e.g. Make it shorter, add a payment milestone at 30 days, use more formal language..."
                          className="min-h-[80px] bg-black/40 border-white/[0.08] text-zinc-100 placeholder:text-zinc-600 resize-none text-sm flex-1 focus:border-violet-500/50 focus:ring-violet-500/20 transition-colors"
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
                        <summary className="cursor-pointer text-xs text-zinc-500 flex items-center gap-1.5 select-none hover:text-zinc-300 transition-colors">
                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                          {Math.floor(messages.length / 2)} prior exchange{messages.length > 3 ? "s" : ""}
                        </summary>
                        <div className="mt-3 space-y-2">
                          {messages.slice(0, -2).map((msg, i) => (
                            <div
                              key={i}
                              className={`text-xs p-3 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-violet-950/30 text-violet-300 border border-violet-500/10"
                                  : "bg-zinc-800/50 text-zinc-400 border border-white/[0.04]"
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
                  <Card className="bg-zinc-900/30 border-white/[0.06] border-dashed">
                    <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mx-auto">
                          <FileText className="w-6 h-6 text-zinc-600" />
                        </div>
                        <p className="text-zinc-400 text-sm font-medium">Your generated proposal will appear here</p>
                        <p className="text-zinc-600 text-xs">Configure your model and settings in the Config tab</p>
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
              <Card className="bg-zinc-900/50 border-white/[0.06] backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-white tracking-tight">Model Selection</CardTitle>
                  <CardDescription className="text-[13px] text-zinc-400 leading-relaxed">
                    Compare cost and capability across providers. Prices shown per 1K tokens.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setConfig((c) => ({ ...c, model: model.id }))}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        config.model === model.id
                          ? "border-violet-500/40 bg-violet-950/20 shadow-[0_0_20px_rgba(139,92,246,0.08)]"
                          : "border-white/[0.06] bg-black/20 hover:border-white/[0.12] hover:bg-zinc-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full transition-colors ${
                              config.model === model.id ? "bg-violet-400 shadow-sm shadow-violet-400/50" : "bg-zinc-700"
                            }`}
                          />
                          <span className="text-sm font-medium text-zinc-200">{model.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${PROVIDER_COLORS[model.provider]}`}
                          >
                            {PROVIDER_LABELS[model.provider]}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">
                            {model.inputPricePer1K === 0
                              ? "Free"
                              : `$${model.inputPricePer1K}/1K`}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1.5 ml-5">{model.description}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card className="bg-zinc-900/50 border-white/[0.06] backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-white tracking-tight">System Prompt Style</CardTitle>
                    <CardDescription className="text-[13px] text-zinc-400 leading-relaxed">
                      Controls the AI&apos;s personality and writing style for generation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select
                      value={config.systemPromptStyle}
                      onValueChange={(v) => setConfig((c) => ({ ...c, systemPromptStyle: v ?? "professional" }))}
                    >
                      <SelectTrigger className="bg-black/40 border-white/[0.08] text-zinc-200 hover:border-white/[0.15] transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700/50">
                        {SYSTEM_PROMPT_PRESETS.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-zinc-200 focus:bg-zinc-800 focus:text-white">
                            {p.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-zinc-200 focus:bg-zinc-800 focus:text-white">
                          ✏️ Custom Prompt
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {config.systemPromptStyle !== "custom" && (
                      <div className="p-4 bg-black/30 rounded-xl border border-white/[0.04]">
                        <p className="text-xs text-zinc-500 line-clamp-4 leading-relaxed">
                          {SYSTEM_PROMPT_PRESETS.find((p) => p.id === config.systemPromptStyle)?.prompt}
                        </p>
                      </div>
                    )}

                    {config.systemPromptStyle === "custom" && (
                      <Textarea
                        placeholder="Write your own system prompt..."
                        className="min-h-[120px] bg-black/40 border-white/[0.08] text-zinc-100 placeholder:text-zinc-600 resize-none text-sm focus:border-violet-500/50 focus:ring-violet-500/20 transition-colors"
                        value={config.customSystemPrompt}
                        onChange={(e) => setConfig((c) => ({ ...c, customSystemPrompt: e.target.value }))}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-white/[0.06] backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-white tracking-tight">Tool Toggles</CardTitle>
                    <CardDescription className="text-[13px] text-zinc-400 leading-relaxed">
                      Enable capabilities that affect how the document is generated and delivered.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
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
                        color: "text-sky-400",
                      },
                      {
                        key: "signableLink" as const,
                        label: "Generate Signable Web Link",
                        description: "Create a SignWell signing link for the generated agreement",
                        color: "text-emerald-400",
                      },
                      {
                        key: "downloadPdf" as const,
                        label: "Download PDF",
                        description: "Enable PDF/HTML export of the final generated document",
                        color: "text-amber-400",
                      },
                    ].map((tool) => (
                      <div key={tool.key} className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${tool.color}`}>{tool.label}</p>
                          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{tool.description}</p>
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
                    color: "text-sky-400",
                    bg: "bg-sky-500/5",
                  },
                  {
                    label: "Estimated Cost",
                    value: formatCost(lastResult.estimatedCostUsd),
                    icon: <DollarSign className="w-4 h-4" />,
                    color: "text-emerald-400",
                    bg: "bg-emerald-500/5",
                  },
                  {
                    label: "Total Tokens",
                    value: (lastResult.inputTokens + lastResult.outputTokens).toLocaleString(),
                    icon: <Zap className="w-4 h-4" />,
                    color: "text-amber-400",
                    bg: "bg-amber-500/5",
                  },
                  {
                    label: "Model",
                    value: currentModel?.name ?? "—",
                    icon: <Sparkles className="w-4 h-4" />,
                    color: "text-violet-400",
                    bg: "bg-violet-500/5",
                  },
                ].map((stat) => (
                  <Card key={stat.label} className={`${stat.bg} border-white/[0.06]`}>
                    <CardContent className="pt-5 pb-4">
                      <div className={`flex items-center gap-2 ${stat.color} mb-2`}>
                        {stat.icon}
                        <span className="text-xs text-zinc-500 font-medium">{stat.label}</span>
                      </div>
                      <p className="text-2xl font-semibold text-white tracking-tight">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {lastResult && (
              <Card className="bg-zinc-900/50 border-white/[0.06]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-white tracking-tight">Last Run — Tools Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(config.tools).map(([key, enabled]) => (
                      <Badge
                        key={key}
                        variant={enabled ? "secondary" : "outline"}
                        className={
                          enabled
                            ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                            : "text-zinc-600 border-zinc-700/50"
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

            <Card className="bg-zinc-900/50 border-white/[0.06]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-white tracking-tight">Run History</CardTitle>
                  <CardDescription className="text-[13px] text-zinc-400 leading-relaxed">
                    Compare performance across models, prompts, and tool configurations
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-400 bg-zinc-800/50 hover:bg-zinc-700/50 hover:text-white transition-all"
                  onClick={loadRuns}
                  disabled={isLoadingRuns}
                >
                  {isLoadingRuns ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                      <BarChart3 className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-sm font-medium">No runs yet</p>
                    <p className="text-zinc-600 text-xs mt-1">Generate a proposal to see analytics here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-zinc-500">
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
                          <tr key={run.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 pr-4 text-zinc-200 font-medium">{run.model}</td>
                            <td className="py-3 pr-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${PROVIDER_COLORS[run.provider] ?? ""}`}
                              >
                                {PROVIDER_LABELS[run.provider] ?? run.provider}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-right text-zinc-300">
                              {formatLatency(run.latency_ms)}
                            </td>
                            <td className="py-3 pr-4 text-right text-zinc-300">
                              {formatCost(Number(run.estimated_cost_usd))}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(run.tools_enabled) && run.tools_enabled.length > 0 ? (
                                  run.tools_enabled.map((t) => (
                                    <Badge
                                      key={t}
                                      variant="secondary"
                                      className="text-[10px] px-1 py-0 bg-violet-500/10 text-violet-400 border-violet-500/15"
                                    >
                                      {t}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-zinc-600">none</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-zinc-500">
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
