# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Round Table is a multi-agent AI discussion platform where users create "round tables" with Claude agents that debate topics using distinct personas (Devil's Advocate, Optimist, Pragmatist, etc.). Agents discuss sequentially in rounds, with real-time streaming and web search capabilities.

**Tech Stack:**
- Frontend: Next.js 15 (App Router) + React 19 + Tailwind CSS
- Database: SQLite with Prisma ORM
- AI: Anthropic Claude SDK (not Agent SDK - direct API integration)
- Real-time: Server-Sent Events (SSE) for streaming

## Development Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)

# Building
npm run build           # Build for production
npm run start           # Start production server

# Testing & Quality
npm run lint            # Run ESLint
npm run test:db         # Test database operations
npm run test:agents     # Test agent orchestration
npm run test:api        # Test API routes
npm run test:blog       # Test blog post synthesis

# Database
npx prisma migrate dev  # Create and apply migrations
npx prisma studio       # View database in GUI
```

## Architecture

### Three-Tier Structure

1. **Presentation Layer** (`app/`, `components/`)
   - App Router pages in `app/`
   - React Client Components in `components/`
   - Server Components by default, Client Components for interactivity

2. **API Layer** (`app/api/`)
   - Next.js API routes handle HTTP requests
   - SSE streaming for real-time agent responses
   - No external API server needed

3. **Data Layer** (`lib/db/`, `prisma/`)
   - Prisma ORM with SQLite
   - Database operations in `lib/db/*.ts`
   - Schema in `prisma/schema.prisma`

### Agent System (Important: NOT using Agent SDK)

The project uses **direct Anthropic API calls**, not the Agent SDK:

- **Agent Configuration**: `lib/agents/config.ts` - Agent setup
- **Web Search Tool**: `lib/agents/tools/websearch.ts` - Tool implementation
- **Executor**: `lib/agents/executor.ts` - Core agent execution with streaming
- **Orchestrator**: `lib/agents/orchestrator.ts` - Multi-agent round coordination

**Key Implementation Details:**
- Each agent calls the Claude API directly using `@anthropic-ai/sdk`
- Agents execute **sequentially** (not parallel) - Agent 1 → Agent 2 → Agent 3 → back to Agent 1
- Full conversation context is passed to each agent (all previous rounds)
- Web search tool is available to all agents
- Streaming responses via SSE through `executeAgentTurn()` in `lib/agents/executor.ts:101`

### Data Flow

```
User clicks "Continue to Round X"
  ↓
POST /api/roundtable/[id]/round
  ↓
createRound() - Create new round in database
  ↓
executeRound() - Sequential agent execution
  ↓
For each agent:
  - buildAgentContext() - Compile all previous messages
  - executeAgentTurn() - Call Claude API with streaming
  - Stream SSE events: agent-start → chunk → tool-call → agent-complete
  - createMessage() - Save to database
  ↓
completeRound() - Mark round as completed
```

### SSE Events

The API emits these Server-Sent Events:

- `round-start`: Round begins (includes roundId, roundNumber, agentCount)
- `agent-start`: Agent begins speaking (agentId, agentName)
- `chunk`: Text token from agent (agentId, chunk)
- `tool-call`: Agent invoked web search (agentId, toolCall with query/results)
- `agent-complete`: Agent finished (message saved to DB)
- `message-saved`: Confirmation of message persistence
- `round-complete`: All agents finished
- `done`: Stream ended
- `error`: Error occurred

### Database Schema

**Models:**
- `RoundTable`: Topic, agentCount, status ("active" | "paused" | "archived")
- `Agent`: name, persona (system prompt), order (turn order 1, 2, 3...)
- `Round`: roundNumber, status ("in_progress" | "completed")
- `Message`: content, toolCalls (JSON array of web searches)

**Relationships:**
- RoundTable → Agents (one-to-many)
- RoundTable → Rounds (one-to-many)
- Round → Messages (one-to-many)
- Agent → Messages (one-to-many)

**Important:** Messages from all previous rounds are included as context for each agent. This is handled in `formatMessagesForClaude()` in `lib/agents/executor.ts:30`.

## Environment Variables

Required in `.env`:

```bash
DATABASE_URL="file:./dev.db"           # SQLite database path
ANTHROPIC_API_KEY="your-key-here"      # Claude API key (required)
```

Optional:

```bash
ANTHROPIC_BASE_URL="https://api.anthropic.com"  # Custom API endpoint
```

## Agent Personas

Default personas are defined in `lib/personas.ts`:
1. Devil's Advocate - Challenges assumptions
2. The Optimist - Focuses on opportunities
3. The Pragmatist - Evaluates feasibility
4. The Researcher - Uses web search heavily
5. The Critic - Critical analysis
6. The Synthesizer - Integrates perspectives

Users can customize these when creating a round table. Each agent maintains their persona across all rounds via their system prompt.

## Key Implementation Patterns

### Creating a Round Table

1. User submits form with topic and agent count
2. `POST /api/roundtable` creates RoundTable + Agent records
3. Redirects to `/roundtable/[id]`

### Running a Round

1. User clicks "Continue to Round X"
2. `POST /api/roundtable/[id]/round` creates Round record
3. API returns SSE stream
4. Frontend listens for events and updates UI in real-time
5. Messages saved to DB as agents complete

### Generating Blog Posts

1. User clicks "Generate Blog Post" on round table page
2. `POST /api/roundtable/[id]/blog-post` fetches all messages
3. Messages sent to Claude for synthesis via `synthesizeBlogPost()`
4. SSE stream returns markdown blog post
5. User downloads or copies to clipboard for Substack

Blog posts are ephemeral - generated on-demand, not persisted.

### Context Building

Critical function: `buildAgentContext()` in `lib/agents/executor.ts:12`

Compiles:
- Topic string
- Round number
- All previous messages (from past rounds)
- Current round messages (from agents who already spoke this round)

This context is formatted for Claude API in `formatMessagesForClaude()` (line 30).

## Common Gotchas

### Streaming Implementation

- The streaming loop in `executeAgentTurn()` (`lib/agents/executor.ts:152`) handles Claude API streaming events
- `content_block_start` → `content_block_delta` → `content_block_stop` sequence
- Tool calls must be accumulated across `input_json_delta` events before execution

### Message Buffering

- Messages are buffered during streaming (`messageBuffer` in API route)
- Only saved to database when `agent-complete` event fires
- This ensures atomic saves - either full message or nothing

### Turn Order

- Agents speak in their `order` field (1, 2, 3...)
- Each agent sees all previous messages from the current round
- This creates a conversational flow where later agents can reference earlier points

### Error Handling

- API errors during agent execution should not break the stream
- Errors are sent as `error` SSE events
- Round status remains "in_progress" on failure for resume capability

## File Organization

```
lib/
├── db/              # Database operations (CRUD for each model)
│   ├── roundtable.ts
│   ├── agents.ts
│   ├── rounds.ts
│   └── messages.ts
├── agents/          # Agent orchestration (NOT Agent SDK)
│   ├── config.ts
│   ├── tools/
│   │   └── websearch.ts
│   ├── executor.ts    # Core: executeAgentTurn()
│   ├── orchestrator.ts # Core: executeRound()
│   └── index.ts
├── blog/            # Blog post synthesis
│   ├── synthesizer.ts # Core: synthesizeBlogPost()
│   └── types.ts
├── personas.ts      # Default persona definitions
├── types.ts         # Shared TypeScript types
└── prisma.ts        # Prisma client singleton
```

## TypeScript Configuration

- Path alias `@/*` maps to project root
- Strict mode enabled
- Module resolution: "bundler"
- Target: ES2017

When adding new imports, use the `@/` prefix for project files.

## Testing

Test scripts are provided for each layer:
- `test:db` - Database CRUD operations
- `test:agents` - Agent execution with mock API
- `test:api` - API route integration tests
- `test:blog` - Blog post synthesis

Tests use `tsx` for direct TypeScript execution.

## Design Philosophy

- **Sequential over Parallel**: Clearer conversation flow, easier to follow
- **Persistence First**: Everything saved immediately, resumable discussions
- **Graceful Degradation**: Web search failures don't block discussions
- **Real-time Experience**: SSE streaming creates engaging live discussions
- **Simplicity**: Direct API calls instead of Agent SDK reduces complexity
