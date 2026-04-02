export interface ModelConfig {
  id: string
  name: string
  provider: 'openrouter'
  contextWindow: number
  inputPricePer1K: number
  outputPricePer1K: number
  description: string
  category: 'fast' | 'performant' | 'both'
}

export const MODELS: ModelConfig[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'openrouter',
    contextWindow: 1000000,
    inputPricePer1K: 0.003,
    outputPricePer1K: 0.015,
    description: 'Best default for proposal writing: strong reasoning, tone control, and tool use.',
    category: 'both',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    contextWindow: 128000,
    inputPricePer1K: 0.0025,
    outputPricePer1K: 0.01,
    description: 'Reliable general-purpose OpenAI model routed through OpenRouter.',
    category: 'both',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    contextWindow: 128000,
    inputPricePer1K: 0.00015,
    outputPricePer1K: 0.0006,
    description: 'Fast, inexpensive drafting model for lightweight proposal iterations.',
    category: 'fast',
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    provider: 'openrouter',
    contextWindow: 200000,
    inputPricePer1K: 0.015,
    outputPricePer1K: 0.075,
    description: 'Highest-end writing quality when premium output matters more than speed.',
    category: 'performant',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'openrouter',
    contextWindow: 200000,
    inputPricePer1K: 0.0008,
    outputPricePer1K: 0.004,
    description: 'Fast Anthropic option with better writing quality than most cheap models.',
    category: 'fast',
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'openrouter',
    contextWindow: 1050000,
    inputPricePer1K: 0.00125,
    outputPricePer1K: 0.01,
    description: 'Massive-context Google model for long briefs, research, and dense source material.',
    category: 'performant',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'openrouter',
    contextWindow: 1050000,
    inputPricePer1K: 0.0003,
    outputPricePer1K: 0.0025,
    description: 'Google workhorse model for fast long-context runs through OpenRouter.',
    category: 'fast',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    contextWindow: 131072,
    inputPricePer1K: 0.00012,
    outputPricePer1K: 0.0003,
    description: 'Affordable open model with solid prose quality for cost-sensitive runs.',
    category: 'both',
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'openrouter',
    contextWindow: 131072,
    inputPricePer1K: 0.00029,
    outputPricePer1K: 0.00029,
    description: 'High-throughput Qwen model that works well for quick first drafts.',
    category: 'fast',
  },
]

export const SYSTEM_PROMPT_PRESETS = [
  {
    id: 'professional',
    label: 'Professional & Formal',
    prompt: `You are an expert business consultant and contract attorney. Generate polished, professional proposals and consulting agreements that are clear, precise, and legally sound. Use formal language, structured sections, and industry-standard terminology. Ensure all deliverables, timelines, payment terms, and legal protections are clearly articulated. The document should be ready for a Fortune 500 client.`,
  },
  {
    id: 'casual',
    label: 'Casual & Friendly',
    prompt: `You are a friendly, approachable consultant who writes proposals that feel like conversations rather than legal documents. Keep the tone warm and human. Use plain English, avoid jargon, and make the client feel excited to work together. Still include all necessary details — just present them in a way that feels personal and relationship-focused rather than transactional.`,
  },
  {
    id: 'startup',
    label: 'Startup / Tech Forward',
    prompt: `You are a modern tech consultant who writes concise, high-signal proposals. Use startup-style writing: bold, direct, outcome-focused. Lead with the value proposition. Minimal fluff. Think Y Combinator pitch meets consulting brief. Format with clear headers, bullet points for deliverables, and a confident tone that signals deep expertise without over-explaining.`,
  },
  {
    id: 'comedic',
    label: 'Comedic & Absurd',
    prompt: `You are a wildly creative consultant who writes hilariously over-the-top proposals. Inject humor, pop culture references, dramatic flair, and the occasional absurdist tangent into every section. Make the client laugh while still (somehow) covering all the actual business requirements. Think David Sedaris writing a consulting agreement. The more ridiculous the better — but it should still technically be a real proposal.`,
  },
]
