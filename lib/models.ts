export interface ModelConfig {
  id: string
  name: string
  provider: 'openrouter'
  vendor: string
  approxPricePer1M: number
  description: string
  category: 'fast' | 'performant' | 'both'
}

export const DEFAULT_MODEL_ID = 'anthropic/claude-haiku-4.5'

export const MODELS: ModelConfig[] = [
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'openrouter',
    vendor: 'Anthropic',
    approxPricePer1M: 1.0,
    description: 'Fast and efficient Anthropic option for lightweight proposal drafting.',
    category: 'fast',
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'openrouter',
    vendor: 'Anthropic',
    approxPricePer1M: 3.0,
    description: 'Balanced option with strong writing quality and reliable instruction-following.',
    category: 'both',
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'openrouter',
    vendor: 'Anthropic',
    approxPricePer1M: 5.0,
    description: 'Highest-end writing quality when premium output matters more than speed.',
    category: 'performant',
  },
  {
    id: 'openai/gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    provider: 'openrouter',
    vendor: 'OpenAI',
    approxPricePer1M: 0.2,
    description: 'Fast, cheap OpenAI option for quick iterations and low-cost runs.',
    category: 'fast',
  },
  {
    id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openrouter',
    vendor: 'OpenAI',
    approxPricePer1M: 0.75,
    description: 'Balanced speed and quality for fast OpenAI-based proposal generation.',
    category: 'fast',
  },
  {
    id: 'openai/gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openrouter',
    vendor: 'OpenAI',
    approxPricePer1M: 2.5,
    description: 'OpenAI flagship with stronger reasoning and polish than the lighter GPT-5.4 variants.',
    category: 'both',
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'openrouter',
    vendor: 'DeepSeek',
    approxPricePer1M: 0.26,
    description: 'Cost-effective balanced model with strong value for general proposal work.',
    category: 'both',
  },
  {
    id: 'qwen/qwen3.5-flash-02-23',
    name: 'Qwen 3.5 Flash',
    provider: 'openrouter',
    vendor: 'Qwen',
    approxPricePer1M: 0.065,
    description: 'Very fast low-cost Qwen model for first drafts and quick experiments.',
    category: 'fast',
  },
  {
    id: 'z-ai/glm-4.7-flash',
    name: 'GLM-4.7 Flash',
    provider: 'openrouter',
    vendor: 'z.ai',
    approxPricePer1M: 0.06,
    description: 'Extremely inexpensive flash model for rapid low-stakes generation.',
    category: 'fast',
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'openrouter',
    vendor: 'Moonshot AI',
    approxPricePer1M: 0.4,
    description: 'Balanced Moonshot model with solid value for longer-form drafting.',
    category: 'both',
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    provider: 'openrouter',
    vendor: 'xAI',
    approxPricePer1M: 0.2,
    description: 'Fast xAI option for inexpensive iterations and alternative phrasing.',
    category: 'fast',
  },
  {
    id: 'minimax/minimax-m2.5',
    name: 'MiniMax M2.5',
    provider: 'openrouter',
    vendor: 'MiniMax',
    approxPricePer1M: 0.12,
    description: 'Cheap balanced model for broad comparison runs and prompt testing.',
    category: 'both',
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
