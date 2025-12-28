# Round Table - AI Discussion Platform

Multi-agent AI discussion platform where users create "round tables" with Claude agents that discuss topics with different personas.

## Features

- **Multi-Agent Discussions**: Create discussions with 2-6 AI agents
- **Distinct Personas**: Each agent has a unique perspective (Devil's Advocate, Optimist, Pragmatist, etc.)
- **Real-time Streaming**: Watch agents respond in real-time
- **Web Search Integration**: Agents can search the web to support their arguments
- **Full Persistence**: All discussions saved and resumable
- **Round-based Flow**: Structured discussion progression across multiple rounds

## Tech Stack

- **Frontend**: Next.js 15 with App Router, React 19, Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **AI**: Claude Agent SDK with web search tools
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Anthropic API key ([Get one here](https://console.anthropic.com/))

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd round-table
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Add your Anthropic API key to `.env`:
   ```
   ANTHROPIC_API_KEY="your-actual-api-key"
   ```

5. Initialize the database:
   ```bash
   npx prisma migrate dev
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
round-table/
├── app/                      # Next.js App Router pages
│   ├── api/                  # API routes
│   ├── roundtable/[id]/      # Discussion view
│   └── history/              # History page
├── components/               # React components
├── lib/                      # Utility functions
│   ├── prisma.ts            # Prisma client
│   ├── personas.ts          # Agent persona definitions
│   └── agents.ts            # Agent orchestration logic
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
└── docs/                    # Design and planning docs
```

## Development Status

**Phase**: Foundation setup complete ✅

- [x] Project initialization
- [x] Database schema (Prisma + SQLite)
- [x] Agent SDK installation
- [ ] Agent orchestration implementation
- [ ] API routes
- [ ] Frontend components
- [ ] Real-time streaming
- [ ] Testing

## Design Documentation

See [docs/plans/2025-12-28-round-table-design.md](./docs/plans/2025-12-28-round-table-design.md) for complete technical design.

## License

MIT
