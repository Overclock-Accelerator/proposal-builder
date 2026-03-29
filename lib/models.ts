export interface ModelConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter'
  contextWindow: number
  inputPricePer1K: number
  outputPricePer1K: number
  description: string
  category: 'fast' | 'performant' | 'both'
}

export const MODELS: ModelConfig[] = [
  // ── OpenAI ──
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePer1K: 0.0025,
    outputPricePer1K: 0.01,
    description: 'Best balance of speed and intelligence from OpenAI',
    category: 'both',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePer1K: 0.00015,
    outputPricePer1K: 0.0006,
    description: 'Ultra-fast and affordable for simple proposals',
    category: 'fast',
  },
  // ── Anthropic ──
  {
    id: 'claude-sonnet-4-6-20260320',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePer1K: 0.003,
    outputPricePer1K: 0.015,
    description: 'Top-tier quality with strong reasoning and writing',
    category: 'performant',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePer1K: 0.0008,
    outputPricePer1K: 0.004,
    description: 'Fast Anthropic model with excellent cost efficiency',
    category: 'fast',
  },
  // ── Google ──
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    contextWindow: 1000000,
    inputPricePer1K: 0.00125,
    outputPricePer1K: 0.005,
    description: 'Google\'s most capable model with massive context',
    category: 'performant',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    contextWindow: 1000000,
    inputPricePer1K: 0.000075,
    outputPricePer1K: 0.0003,
    description: 'Extremely fast with 1M token context window',
    category: 'fast',
  },
  // ── OpenRouter ──
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    contextWindow: 131072,
    inputPricePer1K: 0.00012,
    outputPricePer1K: 0.0003,
    description: 'Powerful open-source model, strong writing quality',
    category: 'both',
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'openrouter',
    contextWindow: 131072,
    inputPricePer1K: 0.00029,
    outputPricePer1K: 0.00029,
    description: 'High-throughput model at 464 tok/s — great for drafts',
    category: 'fast',
  },
  {
    id: 'anthropic/claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'openrouter',
    contextWindow: 200000,
    inputPricePer1K: 0.015,
    outputPricePer1K: 0.075,
    description: 'Most capable model available — premium quality proposals',
    category: 'performant',
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'openrouter',
    contextWindow: 1000000,
    inputPricePer1K: 0.00125,
    outputPricePer1K: 0.005,
    description: 'Top-ranked on OpenRouter intelligence index (57.2)',
    category: 'performant',
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
