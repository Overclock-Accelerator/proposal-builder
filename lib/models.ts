export interface ModelConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter'
  contextWindow: number
  inputPricePer1K: number
  outputPricePer1K: number
  description: string
}

export const MODELS: ModelConfig[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePer1K: 0.005,
    outputPricePer1K: 0.015,
    description: 'Most capable OpenAI model',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePer1K: 0.00015,
    outputPricePer1K: 0.0006,
    description: 'Fast and affordable OpenAI model',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextWindow: 16385,
    inputPricePer1K: 0.0005,
    outputPricePer1K: 0.0015,
    description: 'Legacy OpenAI workhorse',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePer1K: 0.003,
    outputPricePer1K: 0.015,
    description: 'Best Anthropic model for complex tasks',
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePer1K: 0.00025,
    outputPricePer1K: 0.00125,
    description: 'Fast and cheap Anthropic model',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    contextWindow: 1000000,
    inputPricePer1K: 0.00125,
    outputPricePer1K: 0.005,
    description: 'Google\'s most capable model',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextWindow: 1000000,
    inputPricePer1K: 0.000075,
    outputPricePer1K: 0.0003,
    description: 'Fast and cheap Google model',
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B',
    provider: 'openrouter',
    contextWindow: 131072,
    inputPricePer1K: 0,
    outputPricePer1K: 0,
    description: 'Free open-source Meta model',
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B',
    provider: 'openrouter',
    contextWindow: 32768,
    inputPricePer1K: 0.00024,
    outputPricePer1K: 0.00024,
    description: 'Efficient open-source mixture-of-experts',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    contextWindow: 131072,
    inputPricePer1K: 0.00012,
    outputPricePer1K: 0.0003,
    description: 'Powerful open-source Meta model',
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
