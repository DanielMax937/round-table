// Type definitions for Round Table application

import { RoundTable, Agent, Round, Message as PrismaMessage } from '@prisma/client';

// Prisma model types with relations
export type { RoundTable, Agent, Round };

// Message type with tool calls parsed from JSON
export interface Message extends Omit<PrismaMessage, 'toolCalls'> {
  toolCalls?: ToolCall[];
}

// Tool call interface
export interface ToolCall {
  type: 'web_search';
  query: string;
  results?: WebSearchResult[];
  timestamp: Date;
}

// Basic result from Serper
export interface SerperSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Enriched result with Jina content
export interface EnrichedSearchResult {
  title: string;
  url: string;
  snippet: string;  // Original Serper snippet
  enrichedContent: {
    markdown: string;      // Full content from Jina
    fetchedAt: Date;       // When content was fetched
    source: 'jina' | 'fallback';  // Track if Jina succeeded
    truncated?: boolean;   // If Jina indicated truncation
  } | null;  // null if enrichment failed
}

// Update existing WebSearchResult type
export interface WebSearchResult extends EnrichedSearchResult {}

// Agent persona interface
export interface AgentPersona {
  name: string;
  description: string;
  systemPrompt: string;
}

// Input types for creating round table
export interface CreateRoundTableInput {
  topic: string;
  agentCount: number;
  customPersonas?: AgentPersona[];
}

export interface CreateRoundTableData {
  topic: string;
  agentCount: number;
  status: 'active' | 'paused' | 'archived';
  agents: {
    name: string;
    persona: string;
    order: number;
  }[];
}

// Round table with relations
export interface RoundTableWithAgents extends RoundTable {
  agents: Agent[];
  _count?: {
    rounds: number;
  };
}

export interface RoundTableWithDetails extends RoundTable {
  agents: Agent[];
  rounds: RoundWithMessages[];
}

// Round with messages
export interface RoundWithMessages extends Round {
  messages: Message[];
}

// Round table with messages for API responses
export interface RoundTableFull extends RoundTable {
  agents: Agent[];
  rounds: (Round & {
    messages: (Message & {
      agent: Agent;
    })[];
  })[];
}

// Stream event types
export type StreamEventType =
  | 'agent-start'
  | 'chunk'
  | 'tool-call'
  | 'agent-complete'
  | 'round-complete'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: StreamEventData;
}

export interface StreamEventData {
  agentId?: string;
  agentName?: string;
  chunk?: string;
  toolCall?: ToolCall;
  roundNumber?: number;
  error?: string;
  timestamp: Date;
}

// API response types
export interface CreateRoundTableResponse {
  roundTable: RoundTableWithAgents;
}

export interface StartRoundResponse {
  round: Round;
  streamUrl: string;
}

export interface RoundTableListResponse {
  roundTables: RoundTableWithAgents[];
  total: number;
}

// Status types
export type RoundTableStatus = 'active' | 'paused' | 'archived';
export type RoundStatus = 'in_progress' | 'completed';

// Agent context for execution
export interface AgentContext {
  topic: string;
  roundNumber: number;
  previousMessages: (Message & { agent: Agent })[];
  currentRoundMessages: (Message & { agent: Agent })[];
}
