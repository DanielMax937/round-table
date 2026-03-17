// Round orchestration - coordinates multi-agent discussion

import { Agent as AgentModel, Round, Message } from '@prisma/client';
import { executeAgentTurn, buildAgentContext } from './executor';
import { ToolCall } from '../types';
import type { MovieContext } from '../types';

/**
 * Stream event data structure
 */
export interface OrchestratorEvent {
  type: 'agent-start' | 'chunk' | 'tool-call' | 'agent-complete' | 'round-complete';
  data: {
    agentId?: string;
    agentName?: string;
    chunk?: string;
    toolCall?: ToolCall;
    timestamp: Date;
  };
}

/**
 * Options for round execution
 */
export interface RoundExecutionOptions {
  onEvent?: (event: OrchestratorEvent) => void;
  apiKey: string;
  language?: 'en' | 'zh';
  /** When false, agents have no tools (for scene dialogue) */
  toolsEnabled?: boolean;
  /** MemOS context for AI Movie - enables search before turn, add after turn */
  movieContext?: MovieContext;
}

export async function executeRound(
  agents: AgentModel[],
  topic: string,
  roundNumber: number,
  previousMessages: (Message & { agent: AgentModel })[],
  options: RoundExecutionOptions
): Promise<{ messages: Array<{ agentId: string; content: string; toolCalls: ToolCall[]; citations: Array<{ url: string; title: string; usedInContext?: boolean }> }> }> {
  const results: Array<{ agentId: string; content: string; toolCalls: ToolCall[]; citations: Array<{ url: string; title: string; usedInContext?: boolean }> }> = [];
  const currentRoundMessages: (Message & { agent: AgentModel })[] = [];

  // Execute each agent in sequence
  for (const agent of agents) {
    // Notify that agent is starting
    options.onEvent?.({
      type: 'agent-start',
      data: {
        agentId: agent.id,
        agentName: agent.name,
        timestamp: new Date(),
      },
    });

    // Build context for this agent
    const context = buildAgentContext(topic, roundNumber, previousMessages, currentRoundMessages);

    // Execute agent turn
    const { content, toolCalls, citations } = await executeAgentTurn(
      agent,
      context,
      options.apiKey,
      {
        language: options.language,
        toolsEnabled: options.toolsEnabled ?? true,
        movieContext: options.movieContext,
      },
      (chunk) => {
        // Stream chunks to client
        options.onEvent?.({
          type: 'chunk',
          data: {
            agentId: agent.id,
            agentName: agent.name,
            chunk,
            timestamp: new Date(),
          },
        });
      },
      (toolCall) => {
        // Notify about tool call
        options.onEvent?.({
          type: 'tool-call',
          data: {
            agentId: agent.id,
            agentName: agent.name,
            toolCall,
            timestamp: new Date(),
          },
        });
      }
    );

    // Store result
    results.push({
      agentId: agent.id,
      content,
      toolCalls,
      citations,
    }    );

    // MemOS: add character dialogue after each line (AI Movie only)
    if (options.movieContext && content?.trim()) {
      const characterId = options.movieContext.characterIdByAgentId[agent.id];
      if (characterId && options.movieContext.sceneContext) {
        const { addMessage, buildAddMessageUserContent } = await import('@/lib/memos/client');
        const otherLines = currentRoundMessages.map((m) => ({
          name: m.agent.name,
          content: m.content || '',
        }));
        const userContent = buildAddMessageUserContent(
          options.movieContext.sceneContext,
          otherLines
        );
        await addMessage(characterId, options.movieContext.movieId, [
          { role: 'user', content: userContent },
          { role: 'assistant', content: content.trim() },
        ]);
      } else if (!characterId) {
        console.warn(`[MemOS] No characterId for agent ${agent.name}, skipping add_message`);
      }
    }

    // Create a temporary message object for context building
    const tempMessage = {
      id: `temp-${agent.id}`,
      roundId: 'temp-round',
      agentId: agent.id,
      content,
      toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
      createdAt: new Date(),
      agent,
    } as Message & { agent: AgentModel };

    currentRoundMessages.push(tempMessage);

    // Notify that agent is complete
    options.onEvent?.({
      type: 'agent-complete',
      data: {
        agentId: agent.id,
        agentName: agent.name,
        timestamp: new Date(),
      },
    });
  }

  // Notify that round is complete
  options.onEvent?.({
    type: 'round-complete',
    data: {
      timestamp: new Date(),
    },
  });

  return { messages: results };
}

/**
 * Execute a single agent (for retries or single-agent mode)
 */
export async function executeSingleAgent(
  agent: AgentModel,
  topic: string,
  roundNumber: number,
  previousMessages: (Message & { agent: AgentModel })[],
  currentRoundMessages: (Message & { agent: AgentModel })[],
  options: RoundExecutionOptions
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  // Notify that agent is starting
  options.onEvent?.({
    type: 'agent-start',
    data: {
      agentId: agent.id,
      agentName: agent.name,
      timestamp: new Date(),
    },
  });

  // Build context
  const context = buildAgentContext(topic, roundNumber, previousMessages, currentRoundMessages);

  // Execute agent
  const result = await executeAgentTurn(
    agent,
    context,
    options.apiKey,
    {
      language: options.language,
      toolsEnabled: options.toolsEnabled ?? true,
      movieContext: options.movieContext,
    },
    (chunk) => {
      options.onEvent?.({
        type: 'chunk',
        data: {
          agentId: agent.id,
          agentName: agent.name,
          chunk,
          timestamp: new Date(),
        },
      });
    },
    (toolCall) => {
      options.onEvent?.({
        type: 'tool-call',
        data: {
          agentId: agent.id,
          agentName: agent.name,
          toolCall,
          timestamp: new Date(),
        },
      });
    }
  );

  // Notify completion
  options.onEvent?.({
    type: 'agent-complete',
    data: {
      agentId: agent.id,
      agentName: agent.name,
      timestamp: new Date(),
    },
  });

  return result;
}

/**
 * Validate round before execution
 */
export function validateRoundExecution(
  agents: AgentModel[],
  topic: string,
  apiKey: string
): { valid: boolean; error?: string } {
  if (!topic || topic.trim().length === 0) {
    return { valid: false, error: 'Topic cannot be empty' };
  }

  if (!agents || agents.length === 0) {
    return { valid: false, error: 'At least one agent is required' };
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'Anthropic API key is required' };
  }

  return { valid: true };
}

/**
 * Calculate estimated round execution time
 */
export function estimateRoundDuration(agentCount: number): number {
  // Assume ~30 seconds per agent on average
  const baseTime = agentCount * 30000; // 30 seconds per agent

  // Add buffer for tool calls
  const toolBuffer = agentCount * 5000; // 5 seconds per agent for potential tool calls

  return baseTime + toolBuffer;
}

/**
 * Format round summary
 */
export function formatRoundSummary(
  messages: Array<{ agentId: string; content: string; toolCalls: ToolCall[] }>,
  agents: AgentModel[]
): string {
  const summary: string[] = [];

  summary.push(`# Round Summary`);
  summary.push(``);
  summary.push(`**Agents participated:** ${agents.length}`);
  summary.push(`**Total messages:** ${messages.length}`);
  summary.push(`**Tool calls made:** ${messages.reduce((sum, m) => sum + m.toolCalls.length, 0)}`);
  summary.push(``);

  messages.forEach((msg, index) => {
    const agent = agents.find((a) => a.id === msg.agentId);
    if (agent) {
      summary.push(`**${index + 1}. ${agent.name}**`);
      summary.push(`   ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      if (msg.toolCalls.length > 0) {
        summary.push(`   🔍 Made ${msg.toolCalls.length} web search(es)`);
      }
      summary.push(``);
    }
  });

  return summary.join('\n');
}
