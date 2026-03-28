import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 10,
})

export default sql

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model VARCHAR(100) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      system_prompt_style VARCHAR(100) NOT NULL,
      prompt TEXT NOT NULL,
      output TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      estimated_cost_usd DECIMAL(10, 6) NOT NULL,
      tools_enabled JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

export interface Run {
  id: string
  model: string
  provider: string
  system_prompt_style: string
  prompt: string
  output: string
  latency_ms: number
  estimated_cost_usd: number
  tools_enabled: string[]
  created_at: string
}

export async function saveRun(run: Omit<Run, 'id' | 'created_at'>) {
  const result = await sql`
    INSERT INTO runs (model, provider, system_prompt_style, prompt, output, latency_ms, estimated_cost_usd, tools_enabled)
    VALUES (${run.model}, ${run.provider}, ${run.system_prompt_style}, ${run.prompt}, ${run.output}, ${run.latency_ms}, ${run.estimated_cost_usd}, ${JSON.stringify(run.tools_enabled)})
    RETURNING *
  `
  return result[0] as Run
}

export async function getRecentRuns(limit = 20): Promise<Run[]> {
  const result = await sql`
    SELECT * FROM runs ORDER BY created_at DESC LIMIT ${limit}
  `
  return result as unknown as Run[]
}
