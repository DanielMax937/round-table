// Agent execution logic

import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { Agent as AgentModel, Message } from '@prisma/client';
import { AgentContext, ToolCall } from '../types';
import { performWebSearch, formatSearchResults } from './tools/websearch';
import { z } from 'zod';

/**
 * Build agent context from discussion history
 */
export function buildAgentContext(
  topic: string,
  roundNumber: number,
  previousMessages: (Message & { agent: AgentModel })[],
  currentRoundMessages: (Message & { agent: AgentModel })[]
): AgentContext {
  // Parse toolCalls from JSON string to object (safely)
  const safeParseToolCalls = (toolCalls: unknown): any[] | undefined => {
    if (!toolCalls || typeof toolCalls !== 'string' || toolCalls.trim() === '') {
      return undefined;
    }
    try {
      return JSON.parse(toolCalls);
    } catch {
      console.warn('Failed to parse toolCalls JSON:', toolCalls);
      return undefined;
    }
  };

  const mapMessage = (msg: Message & { agent: AgentModel }) => ({
    ...msg,
    toolCalls: safeParseToolCalls(msg.toolCalls)
  });

  return {
    topic,
    roundNumber,
    previousMessages: previousMessages.map(mapMessage),
    currentRoundMessages: currentRoundMessages.map(mapMessage),
  };
}

/**
 * Format messages for the Claude API
 * Converts database messages to Claude message format
 */
export function formatMessagesForClaude(
  context: AgentContext,
  currentAgentId: string
): any[] { // Using any[] to bypass SDK type mismatches for now
  const messages: any[] = [];

  // Add conversation history
  const allMessages = [...context.previousMessages, ...context.currentRoundMessages];

  for (const message of allMessages) {
    // Skip messages from the current agent (don't include own responses)
    if (message.agentId === currentAgentId) {
      continue;
    }

    messages.push({
      role: 'user',
      content: `[${message.agent.name}]: ${message.content}`,
    });
  }

  // Add initial prompt for the first round
  if (context.roundNumber === 1 && messages.length === 0) {
    messages.push({
      role: 'user',
      content: `Please begin the discussion on: "${context.topic}"\n\nShare your perspective on this topic, and feel free to use web search to support your arguments.`,
    });
  } else if (messages.length === 0) {
    // Subsequent rounds start with a prompt to continue
    messages.push({
      role: 'user',
      content: `Round ${context.roundNumber} is beginning. Please continue the discussion on: "${context.topic}"\n\nBuild upon the previous rounds and share your ${context.roundNumber === 2 ? 'next thoughts' : 'continued perspective'}.`,
    });
  }

  return messages;
}

/**
 * Parse tool use blocks from Claude response
 */
export function parseToolUseBlocks(
  content: any[]
): Array<{ toolUse: any; index: number }> {
  const toolUses: Array<{ toolUse: any; index: number }> = [];

  content.forEach((block, index) => {
    if (block.type === 'tool_use') {
      toolUses.push({ toolUse: block, index });
    }
  });

  return toolUses;
}

/**
 * Extract text content from Claude response
 */
export function extractTextContent(
  content: any[]
): string {
  const textBlocks = content
    .filter((block) => block.type === 'text')
    .map((block) => (block as any).text);

  return textBlocks.join('\n');
}

/**
 * Execute an agent turn with streaming using Claude Agent SDK
 */
export async function executeAgentTurn(
  agent: AgentModel,
  context: AgentContext,
  apiKey: string,
  onChunk?: (chunk: string) => void,
  onToolCall?: (toolCall: ToolCall) => void
): Promise<{ content: string; toolCalls: ToolCall[] }> {

  const formattedMessages = formatMessagesForClaude(context, agent.id);
  const toolCalls: ToolCall[] = [];
  let fullContent = '';

  // Build prompt from messages
  let promptContent = "";
  for (const m of formattedMessages) {
    if (typeof m.content === 'string') {
      promptContent += `${m.content}\n\n`;
    }
  }

  // Create web search tool using SDK's tool helper
  const webSearchTool = tool(
    'web_search',
    'Search the web for current information, facts, or recent events. Use key terms only.',
    { query: z.string().describe('The search query terms') },
    async (args) => {
      console.log(`🔍 Executing web_search tool with query: "${args.query}"`);

      // Create and notify about tool call
      const toolCall: ToolCall = {
        type: 'web_search',
        query: args.query,
        timestamp: new Date(),
      };
      toolCalls.push(toolCall);
      onToolCall?.(toolCall);

      try {
        const results = await performWebSearch(args.query);
        toolCall.results = results;
        const content = formatSearchResults(results);
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (error: any) {
        console.error("Web search failed:", error);
        return { content: [{ type: 'text' as const, text: `Search failed: ${error.message}` }] };
      }
    }
  );

  // Create MCP server with the web search tool
  const mcpServer = createSdkMcpServer({
    name: 'round-table-tools',
    version: '1.0.0',
    tools: [webSearchTool],
  });

  try {
    const stream = query({
      prompt: promptContent,
      options: {
        systemPrompt: agent.persona,
        model: 'claude-sonnet-4-20250514',
        includePartialMessages: true,
        mcpServers: {
          'round-table-tools': mcpServer,
        },
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
      },
    });

    for await (const message of stream) {
      // Handle streaming events for text chunks
      if (message.type === 'stream_event') {
        const event = (message as any).event;

        // Handle text deltas
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
          const chunk = event.delta.text;
          fullContent += chunk;
          onChunk?.(chunk);
        }
      }

      // Handle final result message
      if (message.type === 'result') {
        // If we didn't get streaming content, extract from result
        if (!fullContent && (message as any).result) {
          const result = (message as any).result;
          if (result.content) {
            for (const block of result.content) {
              if (block.type === 'text') {
                fullContent += block.text;
              }
            }
          }
        }
      }
    }

    return {
      content: fullContent,
      toolCalls,
    };
  } catch (error) {
    console.error(`Error executing agent ${agent.name}:`, error);
    throw error;
  }
}


/**
 * Execute agent turn without streaming (for testing or batch operations)
 */
export async function executeAgentTurnSimple(
  agent: AgentModel,
  context: AgentContext,
  apiKey: string
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  let content = '';
  const toolCalls: ToolCall[] = [];

  await executeAgentTurn(
    agent,
    context,
    apiKey,
    (chunk) => {
      content += chunk;
    },
    (toolCall) => {
      toolCalls.push(toolCall);
    }
  );

  return { content, toolCalls };
}
