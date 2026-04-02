import { Client as NotionClient } from '@notionhq/client'

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_web',
      description:
        'Search the web for current information. Use this when you need real-time data, recent news, or current facts about a topic, company, or industry that may have changed since your training cutoff.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'enrich_crm',
      description:
        'Log this proposal opportunity to the CRM database. Call this once you have enough context about the engagement — extract the company name and engagement type from the conversation. This records the lead in Notion.',
      parameters: {
        type: 'object',
        properties: {
          company_name: {
            type: 'string',
            description: 'Name of the client company',
          },
          engagement_type: {
            type: 'string',
            description:
              'Type of consulting engagement (e.g., "Data Analytics", "Strategy Consulting", "Technical Audit")',
          },
          budget_estimate: {
            type: 'string',
            description: 'Budget mentioned in the request, if any (e.g., "$25,000")',
          },
          notes: {
            type: 'string',
            description: 'Brief summary of the engagement scope (1-2 sentences)',
          },
        },
        required: ['company_name', 'engagement_type'],
      },
    },
  },
]

export interface ToolResult {
  toolName: string
  args: Record<string, unknown>
  result: string
  meta?: Record<string, unknown>
  durationMs: number
}

async function callSearchWeb(args: { query: string }): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: args.query,
      search_depth: 'basic',
      max_results: 5,
    }),
  })
  if (!res.ok) throw new Error(`Tavily search failed: ${res.statusText}`)
  const data = await res.json()
  const results = ((data.results ?? []) as Array<{ title: string; url: string; content: string }>)
    .slice(0, 5)
    .map((r) => `**${r.title}**\n${r.url}\n${r.content}`)
  return results.length > 0 ? results.join('\n\n') : 'No results found.'
}

let cachedNotionDataSourceId: string | null = null

async function getOrCreateNotionDataSource(): Promise<string> {
  if (cachedNotionDataSourceId) return cachedNotionDataSourceId

  const notion = new NotionClient({ auth: process.env.NOTION_API_KEY })

  const searchRes = await notion.search({
    query: 'Proposals CRM',
    filter: { value: 'data_source', property: 'object' },
  })

  if (searchRes.results.length > 0) {
    cachedNotionDataSourceId = searchRes.results[0].id
    return cachedNotionDataSourceId
  }

  const pageSearch = await notion.search({
    filter: { value: 'page', property: 'object' },
    page_size: 1,
  })

  if (pageSearch.results.length === 0) {
    throw new Error(
      'No parent page found in Notion. Share a page with the Notion integration first, then try again.'
    )
  }

  const parentId = pageSearch.results[0].id

  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentId },
    title: [{ type: 'text', text: { content: 'Proposals CRM' } }],
    initial_data_source: {
      properties: {
        Company: { title: {} },
        'Engagement Type': { rich_text: {} },
        Budget: { rich_text: {} },
        Notes: { rich_text: {} },
        Status: {
          select: {
            options: [
              { name: 'Lead', color: 'blue' },
              { name: 'Proposal Sent', color: 'yellow' },
              { name: 'Closed', color: 'green' },
            ],
          },
        },
        Created: { date: {} },
      },
    },
  })

  const dataSourceId = 'data_sources' in db ? db.data_sources[0]?.id : undefined
  if (!dataSourceId) {
    throw new Error('Proposals CRM was created in Notion, but no data source ID was returned.')
  }

  cachedNotionDataSourceId = dataSourceId
  return dataSourceId
}

async function callEnrichCrm(args: {
  company_name: string
  engagement_type: string
  budget_estimate?: string
  notes?: string
}): Promise<{ result: string; meta?: Record<string, unknown> }> {
  const notion = new NotionClient({ auth: process.env.NOTION_API_KEY })
  const dataSourceId = await getOrCreateNotionDataSource()

  const createdPage = await notion.pages.create({
    parent: { data_source_id: dataSourceId },
    properties: {
      Company: {
        title: [{ text: { content: args.company_name } }],
      },
      'Engagement Type': {
        rich_text: [{ text: { content: args.engagement_type } }],
      },
      Budget: {
        rich_text: [{ text: { content: args.budget_estimate ?? 'Not specified' } }],
      },
      Notes: {
        rich_text: [{ text: { content: args.notes ?? '' } }],
      },
      Status: {
        select: { name: 'Lead' },
      },
      Created: {
        date: { start: new Date().toISOString().split('T')[0] },
      },
    },
  })

  return {
    result: `CRM record created for "${args.company_name}" — ${args.engagement_type}${args.budget_estimate ? ` (${args.budget_estimate})` : ''}. Logged as a Lead in Proposals CRM (Notion).`,
    meta: {
      notionPageUrl: `https://www.notion.so/${createdPage.id.replace(/-/g, '')}`,
    },
  }
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now()
  let result: string
  let meta: Record<string, unknown> | undefined

  try {
    switch (name) {
      case 'search_web':
        result = await callSearchWeb(args as { query: string })
        break
      case 'enrich_crm': {
        const crmResult = await callEnrichCrm(
          args as {
            company_name: string
            engagement_type: string
            budget_estimate?: string
            notes?: string
          }
        )
        result = crmResult.result
        meta = crmResult.meta
        break
      }
      default:
        result = `Unknown tool: ${name}`
    }
  } catch (e) {
    result = `Tool error: ${e instanceof Error ? e.message : String(e)}`
  }

  return { toolName: name, args, result, meta, durationMs: Date.now() - start }
}
