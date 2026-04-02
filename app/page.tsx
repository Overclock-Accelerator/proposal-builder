"use client"

import { Fragment, useState, useRef, useCallback, useEffect, type ChangeEvent } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { DEFAULT_MODEL_ID, MODELS, SYSTEM_PROMPT_PRESETS } from "@/lib/models"
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
  Upload,
  X,
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
    enrichCrm: boolean
  }
}

interface ContextFile {
  id: string
  name: string
  content: string
  source: "demo" | "upload"
  kind: "brief" | "transcript" | "notes" | "contract" | "email"
}

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: "OpenRouter",
  Anthropic: "Anthropic",
  OpenAI: "OpenAI",
  DeepSeek: "DeepSeek",
  Qwen: "Qwen",
  "z.ai": "z.ai",
  "Moonshot AI": "Moonshot AI",
  xAI: "xAI",
  MiniMax: "MiniMax",
}

const CATEGORY_LABELS: Record<string, string> = {
  fast: "Fast",
  performant: "Performant",
  both: "Fast & Performant",
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  searchWeb: "Search Web",
  enrichCrm: "Enrich CRM",
}

const SAMPLE_ENGAGEMENT_PROMPTS = [
  "Draft a consulting proposal for a 6-week AI workflow audit for Stripe. Budget is $18,000. Deliverables include stakeholder interviews, process mapping, automation opportunities, and a final recommendations workshop.",
  "Create a proposal for a 3-month growth strategy engagement for Mercury, a fintech company. Budget is $35,000. Scope includes market positioning, KPI design, pricing experiments, and biweekly advisory sessions.",
  "Generate a consulting agreement for a cybersecurity readiness assessment for Atlantic Health System. Timeline is 8 weeks with a $42,000 budget. Deliverables include risk review, compliance gap analysis, remediation roadmap, and executive briefing.",
  "Write a proposal for a product analytics implementation for Allbirds ahead of a major seasonal campaign. Budget is $22,500 over 5 weeks. Deliverables include event taxonomy, dashboard setup, QA, and team training.",
  "Prepare a consulting proposal for a fractional CTO engagement with Flexport. This is a 2-month engagement at $28,000 covering architecture review, vendor evaluation, engineering planning, and weekly leadership calls.",
  "Create a proposal for a brand messaging and website conversion audit for Watershed. Timeline is 4 weeks and budget is $12,000. Deliverables include homepage copy recommendations, messaging framework, and conversion experiments.",
  "Draft a proposal for an operations redesign engagement for VaynerMedia. Timeline is 7 weeks with a $26,000 budget. Deliverables include workflow mapping, capacity planning, SOP recommendations, and a leadership implementation roadmap.",
  "Create a consulting proposal for a customer success transformation for Gainsight. Budget is $31,500 over 10 weeks. Scope includes renewal risk analysis, onboarding redesign, success playbooks, and manager training sessions.",
  "Write a proposal for a finance systems review for Hamilton Lane. This is a 5-week engagement at $19,500 covering reporting requirements, tool evaluation, close-process redesign, and a controller advisory memo.",
  "Generate a consulting agreement for a go-to-market readiness sprint for Boston Dynamics. Timeline is 6 weeks with a $24,000 budget. Deliverables include ICP refinement, messaging architecture, sales narrative, and launch recommendations.",
  "Prepare a proposal for an executive AI training series for Cooley LLP. Budget is $14,000 over 3 weeks. Deliverables include two leadership workshops, one hands-on team session, prompt libraries, and responsible-use guidance.",
  "Create a proposal for a nonprofit impact measurement framework for charity: water. Timeline is 9 weeks and budget is $27,000. Scope includes KPI design, stakeholder interviews, reporting templates, and board-ready impact dashboards.",
  "Draft a proposal for a pricing and packaging review for Superside. Budget is $16,500 over 4 weeks. Deliverables include offer ladder recommendations, competitor benchmarking, pricing scenarios, and an executive decision memo.",
  "Write a consulting proposal for a post-merger integration planning engagement for Eastman. This is a 12-week engagement at $58,000 covering org design recommendations, systems consolidation priorities, communication planning, and weekly steering committee support.",
  "Generate a proposal for a sales pipeline diagnostic for Bloom Energy. Timeline is 5 weeks with a $17,800 budget. Deliverables include funnel analysis, CRM hygiene review, rep interview synthesis, and a prioritized revenue operations plan.",
] as const

const RUN_HISTORY_STORAGE_KEY = "proposal-builder:runs"
const MAX_STORED_RUNS = 20

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatContextBundle(files: ContextFile[]): string {
  return [
    "Use the following context files from prior company interactions, notes, and contract markups.",
    "Treat them as supporting source material for the current proposal unless the user's latest instruction overrides them.",
    ...files.map(
      (file, index) =>
        `## Context File ${index + 1}: ${file.name}\nType: ${file.kind}\nSource: ${file.source}\n\n${file.content}`
    ),
  ].join("\n\n")
}

function createDemoContextFiles(prompt: string, demoIndex: number): ContextFile[] {
  const themes = [
    {
      client: "Stripe",
      sponsor: "Maya Chen",
      risk: "The VP team wants a fast recommendation memo before the next quarterly planning review.",
      priority: "They care most about workflow bottlenecks, low-leverage meetings, and automation quick wins.",
    },
    {
      client: "Mercury",
      sponsor: "Jordan Alvarez",
      risk: "Leadership wants sharper positioning guidance without slowing product experimentation.",
      priority: "They care most about pricing, activation metrics, and a founder-facing decision cadence.",
    },
    {
      client: "Atlantic Health System",
      sponsor: "Sonia Patel",
      risk: "Legal and compliance teams will review the proposal language before signature.",
      priority: "They care most about stakeholder confidence, remediation sequencing, and executive-ready reporting.",
    },
    {
      client: "Allbirds",
      sponsor: "Trevor Miles",
      risk: "The campaign launch window is fixed, so recommendations need to be implementation-ready.",
      priority: "They care most about instrumentation coverage, reporting clarity, and a short QA window.",
    },
    {
      client: "Flexport",
      sponsor: "Hannah Brooks",
      risk: "Leadership wants CTO-level guidance without creating confusion for the current engineering manager.",
      priority: "They care most about architecture tradeoffs, vendor selection, and a clear weekly operating cadence.",
    },
    {
      client: "Watershed",
      sponsor: "Elena Park",
      risk: "The team wants messaging improvements that can ship quickly without a full rebrand.",
      priority: "They care most about homepage clarity, differentiated positioning, and high-intent conversion paths.",
    },
    {
      client: "VaynerMedia",
      sponsor: "Owen Carter",
      risk: "Department leads are protective of their existing workflows, so change management needs to be explicit.",
      priority: "They care most about workflow visibility, capacity planning, and an implementation roadmap leadership can enforce.",
    },
    {
      client: "Gainsight",
      sponsor: "Leah Morgan",
      risk: "Customer-facing managers want practical recommendations, not an abstract transformation deck.",
      priority: "They care most about renewal risk signals, onboarding consistency, and clear manager playbooks.",
    },
    {
      client: "Hamilton Lane",
      sponsor: "Victor Romero",
      risk: "Finance leadership needs the review to land cleanly before the next reporting cycle.",
      priority: "They care most about reporting integrity, tooling tradeoffs, and a low-friction close process.",
    },
    {
      client: "Boston Dynamics",
      sponsor: "Alicia Grant",
      risk: "Commercial teams want launch guidance that is concrete enough to use in active deals.",
      priority: "They care most about ICP clarity, sales narrative consistency, and launch sequencing.",
    },
    {
      client: "Cooley LLP",
      sponsor: "Daniel Kim",
      risk: "Partners want the AI sessions to feel practical and low-risk rather than experimental.",
      priority: "They care most about leadership adoption, usable prompt libraries, and responsible-use guidance.",
    },
    {
      client: "charity: water",
      sponsor: "Rachel Torres",
      risk: "The board wants impact reporting that is simple to understand and credible to external stakeholders.",
      priority: "They care most about KPI clarity, stakeholder alignment, and dashboard-ready reporting structures.",
    },
    {
      client: "Superside",
      sponsor: "Noah Bennett",
      risk: "Leadership wants pricing options that increase clarity without adding complexity to the sales process.",
      priority: "They care most about packaging logic, competitor framing, and decision-ready pricing scenarios.",
    },
    {
      client: "Eastman",
      sponsor: "Priya Singh",
      risk: "Executive stakeholders need the integration plan to surface tradeoffs early and keep communications tight.",
      priority: "They care most about org design decisions, systems consolidation sequencing, and steering committee visibility.",
    },
    {
      client: "Bloom Energy",
      sponsor: "Marcus Cole",
      risk: "Sales leadership wants a diagnostic that is evidence-based and immediately actionable for revenue operations.",
      priority: "They care most about funnel quality, CRM hygiene, and a prioritized pipeline improvement plan.",
    },
  ] as const

  const selectedTheme = themes[demoIndex % themes.length]
  const shortPrompt = prompt.length > 320 ? `${prompt.slice(0, 317)}...` : prompt
  const randomItem = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

  const representedFirm = {
    name: randomItem([
      "Blackline Advisory",
      "North Harbor Consulting",
      "Fieldstone Strategy",
      "Iron Ledger Partners",
      "Aster Row Advisory",
    ] as const),
    lead: randomItem([
      "Elliot Shaw",
      "Nadia Mercer",
      "Julian Cross",
      "Priya Holloway",
      "Marcus Vale",
    ] as const),
    posture: randomItem([
      "premium operator-led advisory",
      "high-trust editorial consulting",
      "board-ready strategic execution support",
      "sharp, operator-minded transformation work",
      "senior advisory with implementation discipline",
    ] as const),
    proposalStyle: randomItem([
      "Keep the writing crisp, assured, and commercially legible.",
      "Frame the work like a premium engagement, not freelance staff augmentation.",
      "Lead with business judgment, then translate into scope, milestones, and deliverables.",
      "Avoid startup language; the voice should sound calm, senior, and exact.",
      "Make the recommendation feel like a point of view, not a generic menu of services.",
    ] as const),
    negotiationPreference: randomItem([
      "We prefer fixed-fee scopes with explicit revision boundaries.",
      "We usually structure work in phased milestones so change requests stay visible.",
      "We try to protect interview bandwidth by batching discovery into a tight window.",
      "We avoid open-ended implementation promises unless they are separately scoped.",
      "We generally keep IP language simple and reserve our pre-existing frameworks.",
    ] as const),
    operatingNote: randomItem([
      "The client should feel that we have done this exact pattern before.",
      "The proposal should make leadership decision moments impossible to miss.",
      "We want the commercial terms to feel firm but not adversarial.",
      "The draft should signal confidence without overpromising custom execution.",
      "We should make optional phase-two work visible without sounding salesy.",
    ] as const),
  }

  const internalConstraints = [
    "Do not imply daily implementation support unless it is priced separately.",
    "Keep discovery lean: no more than 6 stakeholder interviews in the base scope.",
    "Use milestone-based language so the client sees how decisions unlock the next phase.",
    "Protect turnaround time by limiting async review cycles on the final deliverable.",
    "Avoid promising detailed technical documentation if the engagement is primarily strategic.",
  ] as const

  const internalWins = [
    "The team responds well when we position the roadmap as executive decision support.",
    "Short, specific deliverable language tends to close better than long methodology sections.",
    "Clients like seeing a named workshop or briefing at the end of the engagement.",
    "Budget confidence improves when payment terms are tied to visible milestones.",
    "We usually get better alignment when the proposal names explicit client dependencies.",
  ] as const

  return [
    {
      id: createId("ctx"),
      name: "01-engagement-brief.md",
      source: "demo",
      kind: "brief",
      content: [
        "# Engagement Brief",
        "",
        `Client: ${selectedTheme.client}`,
        `Primary Sponsor: ${selectedTheme.sponsor}`,
        "",
        "Original request:",
        shortPrompt,
        "",
        "Working assumptions:",
        "- The client wants a premium consultant-led engagement, not a lightweight template.",
        "- The proposal should balance strategic insight with specific operational deliverables.",
        `- ${selectedTheme.priority}`,
      ].join("\n"),
    },
    {
      id: createId("ctx"),
      name: "02-consultant-positioning-notes.md",
      source: "demo",
      kind: "notes",
      content: [
        "# Represented Firm Positioning Notes",
        "",
        `Firm: ${representedFirm.name}`,
        `Engagement Lead: ${representedFirm.lead}`,
        `Positioning: ${representedFirm.posture}`,
        "",
        "Proposal guidance:",
        `- ${representedFirm.proposalStyle}`,
        `- ${representedFirm.negotiationPreference}`,
        `- ${representedFirm.operatingNote}`,
      ].join("\n"),
    },
    {
      id: createId("ctx"),
      name: "03-kickoff-transcript.md",
      source: "demo",
      kind: "transcript",
      content: [
        "# Kickoff Call Transcript Excerpt",
        "",
        `${selectedTheme.sponsor}: We need a proposal that shows you understand how decisions actually get made here.`,
        "Consultant: What would make this engagement feel successful in the first 30 days?",
        `${selectedTheme.sponsor}: A clear diagnostic, a practical roadmap, and language our leadership team can sign off on quickly.`,
        `Consultant: Any known constraints?`,
        `${selectedTheme.sponsor}: ${selectedTheme.risk}`,
        "Consultant: Understood. I will frame the proposal around credibility, sequencing, and decision support.",
      ].join("\n"),
    },
    {
      id: createId("ctx"),
      name: "04-delivery-team-handoff.md",
      source: "demo",
      kind: "notes",
      content: [
        "# Internal Delivery Team Handoff",
        "",
        `Lead consultant: ${representedFirm.lead}`,
        `Client sponsor: ${selectedTheme.sponsor}`,
        "",
        "Internal constraints:",
        `- ${randomItem(internalConstraints)}`,
        `- ${randomItem(internalConstraints)}`,
        "",
        "What usually works for us:",
        `- ${randomItem(internalWins)}`,
        `- ${randomItem(internalWins)}`,
      ].join("\n"),
    },
    {
      id: createId("ctx"),
      name: "05-contract-redlines.md",
      source: "demo",
      kind: "contract",
      content: [
        "# Contract / SOW Notes",
        "",
        "- Client prefers a 50% upfront / 50% midpoint payment structure.",
        "- Limit revision rounds on final deliverables to avoid open-ended editing cycles.",
        "- Include a client dependency clause for interview scheduling and access to systems or data.",
        "- Clarify that implementation support beyond the described deliverables is out of scope unless added by change order.",
        "- Keep IP language simple: client owns paid-for deliverables, consultant retains pre-existing frameworks and templates.",
      ].join("\n"),
    },
    {
      id: createId("ctx"),
      name: "06-follow-up-email.md",
      source: "demo",
      kind: "email",
      content: [
        "# Follow-Up Email Summary",
        "",
        `From: ${selectedTheme.sponsor}`,
        "Subject: Proposal expectations before review",
        "",
        "Please make sure the proposal:",
        "- feels tailored to our situation rather than generic consulting language,",
        "- shows a realistic sequence of work by phase,",
        "- makes the value of each deliverable legible to non-technical stakeholders,",
        "- includes a clear recommendation cadence so we know when decisions are required.",
      ].join("\n"),
    },
  ].slice(0, 5)
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

function formatModelPrice(pricePer1M: number): string {
  if (pricePer1M === 0) return "Free"
  if (pricePer1M < 0.1) return `$${pricePer1M.toFixed(3)}/1M`
  return `$${pricePer1M.toFixed(2)}/1M`
}

function getNotionPageUrl(toolCallLog: ToolResult[]): string | null {
  const enrichResult = [...toolCallLog]
    .reverse()
    .find((toolCall) => toolCall.toolName === "enrich_crm" && !toolCall.result.startsWith("Tool error:"))

  const notionPageUrl = enrichResult?.meta?.notionPageUrl
  return typeof notionPageUrl === "string" && notionPageUrl.length > 0 ? notionPageUrl : null
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="space-y-4 text-[14px] leading-7 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="font-heading text-3xl font-semibold tracking-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="font-heading text-2xl font-semibold tracking-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="font-heading text-xl font-semibold tracking-tight">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold tracking-tight">{children}</h4>,
          p: ({ children }) => <p className="text-sm leading-7 text-foreground">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-5 text-sm">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5 text-sm">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="border-border" />,
          a: ({ href, children }) => (
            <a href={href} className="underline underline-offset-4" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-border text-left">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border/70">{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
          pre: ({ children }) => (
            <pre className="overflow-x-auto border border-border bg-muted/40 p-4 text-xs leading-6">{children}</pre>
          ),
          code: ({ children }) => (
            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[12px]">{children}</code>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function readStoredRuns(): Run[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Run[]) : []
  } catch {
    return []
  }
}

function writeStoredRuns(runs: Run[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(runs))
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("builder")

  const [config, setConfig] = useState<Config>({
    model: DEFAULT_MODEL_ID,
    systemPromptStyle: "professional",
    customSystemPrompt: SYSTEM_PROMPT_PRESETS.find((p) => p.id === "professional")?.prompt ?? "",
    tools: {
      searchWeb: false,
      enrichCrm: false,
    },
  })

  const [prompt, setPrompt] = useState("")
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [expandedContextIds, setExpandedContextIds] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [followUp, setFollowUp] = useState("")
  const [lastResult, setLastResult] = useState<RunResult | null>(null)
  const [outputTab, setOutputTab] = useState("preview")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [runs, setRuns] = useState<Run[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(false)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [demoPromptIndex, setDemoPromptIndex] = useState(-1)

  const outputRef = useRef<HTMLDivElement>(null)
  const contextInputRef = useRef<HTMLInputElement>(null)

  const loadRuns = useCallback(() => {
    setIsLoadingRuns(true)
    try {
      setRuns(readStoredRuns())
    } finally {
      setIsLoadingRuns(false)
    }
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (outputTab === "tool-log" && (lastResult?.toolCallLog?.length ?? 0) === 0) {
      setOutputTab("preview")
    }
  }, [lastResult, outputTab])

  const callGenerate = useCallback(
    async (msgs: Message[]) => {
      setIsGenerating(true)
      setError(null)
      try {
        const requestMessages =
          contextFiles.length > 0
            ? ([{ role: "user", content: formatContextBundle(contextFiles) }, ...msgs] as Message[])
            : msgs

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            systemPromptStyle: config.systemPromptStyle,
            customSystemPrompt: config.customSystemPrompt,
            messages: requestMessages,
            tools: config.tools,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Generation failed")
        const selectedModel = MODELS.find((entry) => entry.id === config.model)

        const nextRun: Run = {
          id:
            data.runId ??
            (typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}`),
          model: config.model,
          provider: selectedModel?.vendor ?? selectedModel?.provider ?? "openrouter",
          system_prompt_style: config.systemPromptStyle,
          prompt: msgs[msgs.length - 1]?.content ?? "",
          output: data.text,
          latency_ms: data.latencyMs,
          estimated_cost_usd: data.estimatedCostUsd,
          tools_enabled: Object.entries(config.tools)
            .filter(([, enabled]) => enabled)
            .map(([toolName]) => toolName),
          created_at: new Date().toISOString(),
        }

        const updatedRuns = [nextRun, ...readStoredRuns()].slice(0, MAX_STORED_RUNS)
        writeStoredRuns(updatedRuns)
        setRuns(updatedRuns)

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
    [config, contextFiles]
  )

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    const msgs: Message[] = [{ role: "user", content: prompt }]
    await callGenerate(msgs)
  }

  const handleRandomPrompt = () => {
    const nextIndex = (demoPromptIndex + 1) % SAMPLE_ENGAGEMENT_PROMPTS.length
    const nextPrompt = SAMPLE_ENGAGEMENT_PROMPTS[nextIndex]
    const nextContextFiles = createDemoContextFiles(nextPrompt, nextIndex)

    setDemoPromptIndex(nextIndex)
    setPrompt(nextPrompt)
    setContextFiles(nextContextFiles)
    setExpandedContextIds([])
    setError(null)
  }

  const handleContextUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (selectedFiles.length === 0) return

    const uploadedFiles = await Promise.all(
      selectedFiles.map(async (file) => ({
        id: createId("ctx"),
        name: file.name,
        content: await file.text(),
        source: "upload" as const,
        kind: "notes" as const,
      }))
    )

    setContextFiles((current) => [...current, ...uploadedFiles])
    setExpandedContextIds((current) => [...new Set([...current, ...uploadedFiles.map((file) => file.id)])])
    setError(null)
    event.target.value = ""
  }

  const toggleContextFile = (fileId: string) => {
    setExpandedContextIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId]
    )
  }

  const removeContextFile = (fileId: string) => {
    setContextFiles((current) => current.filter((file) => file.id !== fileId))
    setExpandedContextIds((current) => current.filter((id) => id !== fileId))
  }

  const openAllContextFiles = () => {
    setExpandedContextIds(contextFiles.map((file) => file.id))
  }

  const collapseAllContextFiles = () => {
    setExpandedContextIds([])
  }

  const clearContextFiles = () => {
    setContextFiles([])
    setExpandedContextIds([])
  }

  const handleFollowUp = async () => {
    if (!followUp.trim()) return
    const msgs = [...messages, { role: "user" as const, content: followUp }]
    setFollowUp("")
    await callGenerate(msgs)
  }

  const handleDownloadDocx = async () => {
    if (!lastResult) return
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: lastResult.text, title: "Consulting Agreement" }),
      })

      if (!res.ok) {
        throw new Error("DOCX export failed")
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `proposal-${Date.now()}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "DOCX export failed")
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === "analytics") loadRuns()
  }

  const currentModel = MODELS.find((m) => m.id === config.model)
  const activeFunctionTools = lastResult?.toolCallLog ?? []
  const notionPageUrl = getNotionPageUrl(activeFunctionTools)
  const totalContextCharacters = contextFiles.reduce((total, file) => total + file.content.length, 0)

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
                  {PROVIDER_LABELS[currentModel.vendor] ?? currentModel.vendor} · {currentModel.name}
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                  {CATEGORY_LABELS[currentModel.category]}
                </Badge>
              </>
            )}
            <Badge variant="outline" className="text-xs text-muted-foreground border-border">
              {currentModel ? `Approx. ${formatModelPrice(currentModel.approxPricePer1M)}` : "Select a model"}
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
                    <div className="border border-border bg-muted/20 p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">Context Files</p>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                              {contextFiles.length} loaded
                            </Badge>
                          </div>
                          <p className="text-[12px] leading-relaxed text-muted-foreground">
                            Upload notes, transcripts, emails, or contract markups. Every loaded file is attached to the
                            generation request so students can see how much context can be packed into a prompt.
                          </p>
                          {contextFiles.length > 0 && (
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              {totalContextCharacters.toLocaleString()} characters of loaded context
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            ref={contextInputRef}
                            type="file"
                            multiple
                            accept=".txt,.md,.markdown,.json,.csv"
                            className="hidden"
                            onChange={handleContextUpload}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => contextInputRef.current?.click()}
                            className="h-8"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Upload Files
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={openAllContextFiles}
                            disabled={contextFiles.length === 0}
                            className="h-8"
                          >
                            Open All
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={collapseAllContextFiles}
                            disabled={contextFiles.length === 0}
                            className="h-8"
                          >
                            Collapse All
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={clearContextFiles}
                            disabled={contextFiles.length === 0}
                            className="h-8"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>

                      {contextFiles.length === 0 ? (
                        <div className="border border-dashed border-border bg-background px-4 py-8 text-center">
                          <p className="text-sm text-muted-foreground">No context files loaded yet.</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Upload your own notes or press `Cycle Demo Prompt` to auto-load 5 mock context files.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {contextFiles.map((file, index) => {
                            const isExpanded = expandedContextIds.includes(file.id)

                            return (
                              <div key={file.id} className="border border-border bg-background">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleContextFile(file.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  >
                                    <ChevronDown
                                      className={`h-4 w-4 shrink-0 transition-transform ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-sm font-medium">
                                      {index + 1}. {file.name}
                                    </span>
                                  </button>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                      {file.kind}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                      {file.source}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                      {file.content.length.toLocaleString()} chars
                                    </Badge>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => removeContextFile(file.id)}
                                      aria-label={`Remove ${file.name}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="p-3">
                                    <Textarea
                                      readOnly
                                      value={file.content}
                                      className="min-h-[180px] resize-y bg-background font-mono text-[12px] leading-6"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRandomPrompt}
                        disabled={isGenerating}
                        className="h-10 sm:w-auto"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Cycle Demo Prompt
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

                    <Card>
                      <CardContent className="pt-5 pb-5">
                        <Tabs value={outputTab} onValueChange={setOutputTab} className="gap-4">
                          <TabsList
                            variant="line"
                            className="w-full border-b border-border p-0 h-auto rounded-none justify-start gap-0"
                          >
                            <TabsTrigger value="preview" className="px-4 py-2.5 text-sm rounded-none border-0">
                              Markdown Preview
                            </TabsTrigger>
                            <TabsTrigger value="raw" className="px-4 py-2.5 text-sm rounded-none border-0">
                              Raw Markdown
                            </TabsTrigger>
                            {activeFunctionTools.length > 0 && (
                              <TabsTrigger value="tool-log" className="px-4 py-2.5 text-sm rounded-none border-0">
                                Tool Call Log
                              </TabsTrigger>
                            )}
                          </TabsList>

                          <TabsContent value="preview" className="pt-2">
                            <MarkdownPreview content={lastResult.text} />
                          </TabsContent>

                          <TabsContent value="raw" className="pt-2">
                            <pre className="whitespace-pre-wrap overflow-x-auto border border-border bg-muted/30 p-4 text-[13px] leading-7">
                              {lastResult.text}
                            </pre>
                          </TabsContent>

                          {activeFunctionTools.length > 0 && (
                            <TabsContent value="tool-log" className="pt-2">
                              <div className="space-y-3">
                                {activeFunctionTools.map((call, i) => (
                                  <div key={i} className="border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-mono font-semibold text-blue-700">{call.toolName}()</span>
                                      <span className="text-[10px] text-muted-foreground">{call.durationMs}ms</span>
                                    </div>
                                    <div className="text-[11px] font-mono text-muted-foreground bg-background p-2 overflow-x-auto border border-blue-100">
                                      {JSON.stringify(call.args, null, 2)}
                                    </div>
                                    <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                      {call.result}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </TabsContent>
                          )}
                        </Tabs>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={handleDownloadDocx}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download DOCX
                      </Button>
                      {notionPageUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(notionPageUrl, "_blank", "noopener,noreferrer")}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          Open Notion Page
                        </Button>
                      )}
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
                    Every request runs through OpenRouter. Choose the underlying model and compare approximate pricing per 1M tokens.
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
                            {PROVIDER_LABELS[model.vendor] ?? model.vendor}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {CATEGORY_LABELS[model.category]}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{formatModelPrice(model.approxPricePer1M)}</div>
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
                        description: "LLM calls Tavily for live information it can't know from training data, including company research when a client needs to be profiled",
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
                          enabled && ["searchWeb", "enrichCrm"].includes(key)
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
                          <th className="text-left pb-3 pr-4 font-medium text-xs uppercase tracking-wider">Output</th>
                          <th className="text-left pb-3 font-medium text-xs uppercase tracking-wider">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((run) => {
                          const isExpanded = expandedRunId === run.id

                          return (
                            <Fragment key={run.id}>
                              <tr className="border-b border-border hover:bg-muted/50 transition-colors">
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
                                        ["searchWeb", "enrichCrm"].includes(t)
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
                                <td className="py-3 pr-4">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                                  >
                                    {isExpanded ? "Hide" : "View output"}
                                  </Button>
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
                              {isExpanded && (
                                <tr className="border-b border-border bg-muted/20">
                                  <td colSpan={7} className="p-4">
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                      <div className="space-y-2">
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                          Prompt
                                        </p>
                                        <div className="max-h-48 overflow-auto border border-border bg-background p-3 text-[12px] leading-6 whitespace-pre-wrap">
                                          {run.prompt}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                          Output
                                        </p>
                                        <div className="max-h-80 overflow-auto border border-border bg-background p-4">
                                          <MarkdownPreview content={run.output || "No output recorded for this run."} />
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
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
