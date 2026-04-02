# Proposal Builder

Proposal Builder is a consultant-facing drafting app for generating polished proposals and consulting agreements with configurable models, system prompts, and optional function-calling tools.

It is built as a single Next.js app with:

- a premium proposal composition UI
- model selection and prompt controls
- optional live web research via Tavily
- optional CRM logging to Notion
- DOCX export
- lightweight run analytics with graceful fallback when Postgres is unavailable

## What It Does

Users can:

- describe an engagement in natural language
- load supporting context files such as notes, transcripts, emails, or redlines
- choose a model from the built-in catalog
- switch between prompt presets or write a custom system prompt
- enable AI tools for web research and CRM enrichment
- generate and refine proposal copy in Markdown
- export the result as a `.docx`
- review recent runs, latency, token usage, and estimated cost

## Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `OpenRouter` for model access
- `Tavily` for live web search
- `Notion` for CRM logging
- `Postgres` for optional server-side run persistence
- browser `localStorage` for local run history in the UI

## App Structure

- `app/page.tsx`: main product UI for prompt entry, configuration, output, and analytics
- `app/api/generate/route.ts`: generation endpoint, prompt augmentation, tool enablement, optional DB persistence
- `app/api/pdf/route.ts`: DOCX export endpoint
- `lib/llm.ts`: OpenRouter chat completion orchestration and tool-calling loop
- `lib/models.ts`: available model catalog and prompt presets
- `lib/tools.ts`: Tavily search and Notion CRM tool definitions/execution
- `lib/db.ts`: Postgres connection and run persistence helpers

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create local environment variables

Create `./.env.local` with the variables you need:

```bash
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Proposal Builder
TAVILY_API_KEY=
NOTION_API_KEY=
DATABASE_URL=
```

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes | Required for all model generation |
| `OPENROUTER_SITE_URL` | Recommended | Sent as OpenRouter referer header |
| `OPENROUTER_APP_NAME` | Recommended | Sent as OpenRouter app title header |
| `TAVILY_API_KEY` | Only if using `Search Web` | Enables live web research tool |
| `NOTION_API_KEY` | Only if using `Enrich CRM` | Enables Notion CRM logging |
| `DATABASE_URL` | No | Optional Postgres persistence for server-side run storage |

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Workflow

### Proposal generation

1. Enter an engagement brief.
2. Optionally attach context files.
3. Select a model and prompt style.
4. Optionally enable AI tools.
5. Generate the proposal.
6. Refine the output with follow-up prompts.
7. Export the final result as DOCX.

### Tools

`Search Web`
- Lets the model call Tavily for current company or industry research.

`Enrich CRM`
- Lets the model log an opportunity into a Notion database named `Proposals CRM`.
- If the database does not already exist, the app attempts to create it under an accessible Notion page.

## Persistence Behavior

Run persistence is intentionally fault-tolerant:

- the API attempts to save runs to Postgres if `DATABASE_URL` is configured and reachable
- if Postgres is unavailable, generation still succeeds
- the UI stores recent runs in browser `localStorage` so analytics remain usable locally

## Current Model Setup

The app exposes multiple model options from Anthropic, OpenAI, DeepSeek, Qwen, z.ai, Moonshot, xAI, and MiniMax, but the current generation pipeline is wired through `OpenRouter` in `lib/llm.ts`.

## Notes

- Generation output is Markdown-first and rendered in-app with a live preview.
- DOCX export is generated from the current Markdown text, with lightweight heading and bullet conversion.
- The app is optimized for consultant workflows rather than general-purpose chat.
