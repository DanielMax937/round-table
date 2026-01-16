// Agent execution logic

import { Agent as AgentModel, Message } from '@prisma/client';
import { AgentContext, ToolCall } from '../types';
import { performWebSearch, formatSearchResults } from './tools/websearch';
import { z } from 'zod';
import { streamChatCompletion } from '@/lib/llm/client';
import type { LLMMessage, LLMTool } from '@/lib/llm/types';

// Web search tool definition for OpenAI function calling
const WEB_SEARCH_TOOL: LLMTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information, facts, or recent events. Use this to find supporting evidence for your arguments.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query terms',
        },
      },
      required: ['query'],
    },
  },
};

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

export async function executeAgentTurn(
  agent: AgentModel,
  context: AgentContext,
  apiKey: string,
  language?: 'en' | 'zh',
  onChunk?: (chunk: string) => void,
  onToolCall?: (toolCall: ToolCall) => void
): Promise<{ content: string; toolCalls: ToolCall[]; citations: Array<{ url: string; title: string; usedInContext?: boolean }> }> {

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

  try {
    // Build system prompt with language instruction
    let systemPrompt = agent.persona;
    if (language === 'zh') {
      systemPrompt += '\n\nIMPORTANT: You MUST respond in Chinese (中文). All your responses should be in Chinese, including analysis, arguments, and conclusions.';
    } else if (language === 'en') {
      systemPrompt += '\n\nIMPORTANT: You MUST respond in English. All your responses should be in English.';
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptContent },
    ];

    // Log whether tools are enabled
    console.log(`[Agent ${agent.name}] Starting turn with web_search tool enabled`);

    // First call - may result in tool calls
    let stream = streamChatCompletion(messages, { tools: [WEB_SEARCH_TOOL] });
    let pendingToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        fullContent += chunk.delta;
        onChunk?.(chunk.delta);
      } else if (chunk.type === 'tool_call_complete' && chunk.toolCall) {
        pendingToolCalls.push({
          id: chunk.toolCall.id,
          name: chunk.toolCall.function.name,
          arguments: chunk.toolCall.function.arguments,
        });
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }

    // Process tool calls if any
    if (pendingToolCalls.length > 0) {
      console.log(`[Agent ${agent.name}] LLM requested ${pendingToolCalls.length} tool call(s)`);

      for (const tc of pendingToolCalls) {
        if (tc.name === 'web_search') {
          try {
            const args = JSON.parse(tc.arguments);
            const query = args.query;

            console.log(`[Agent ${agent.name}] 🔍 Executing web_search with query: "${query}"`);

            const searchResults = await performWebSearch(query);
            const formattedResults = formatSearchResults(searchResults);

            console.log(`[Agent ${agent.name}] 📊 Web search returned ${searchResults.length} results:`);
            searchResults.slice(0, 3).forEach((r, i) => {
              console.log(`  [${i + 1}] ${r.title} - ${r.url}`);
            });

            // Create tool call record
            const toolCallRecord: ToolCall = {
              type: 'web_search',
              query,
              results: searchResults,
              timestamp: new Date(),
            };
            toolCalls.push(toolCallRecord);
            onToolCall?.(toolCallRecord);

            // Add assistant message with tool call and tool result to messages
            messages.push({
              role: 'assistant',
              content: '',
              tool_calls: [{
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              }],
            });

            messages.push({
              role: 'tool',
              content: formattedResults,
              tool_call_id: tc.id,
            });

          } catch (error) {
            console.error(`[Agent ${agent.name}] ❌ Web search failed:`, error);
            // Add error response
            messages.push({
              role: 'assistant',
              content: '',
              tool_calls: [{
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              }],
            });
            messages.push({
              role: 'tool',
              content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              tool_call_id: tc.id,
            });
          }
        }
      }

      // Continue conversation after tool calls
      console.log(`[Agent ${agent.name}] Continuing after tool calls...`);
      stream = streamChatCompletion(messages, { tools: [WEB_SEARCH_TOOL] });

      for await (const chunk of stream) {
        if (chunk.type === 'content_delta' && chunk.delta) {
          fullContent += chunk.delta;
          onChunk?.(chunk.delta);
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error || 'LLM streaming error');
        }
      }
    } else {
      console.log(`[Agent ${agent.name}] ℹ️ LLM did not use web_search tool`);
    }

    // Extract citations from content and search results
    const { extractCitations } = await import('./citations');
    const allSearchResults = toolCalls.flatMap(tc => tc.results || []);

    const citations = extractCitations(fullContent, allSearchResults);

    return {
      content: fullContent,
      toolCalls,
      citations,
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
): Promise<{ content: string; toolCalls: ToolCall[]; citations: Array<{ url: string; title: string; usedInContext?: boolean }> }> {
  let content = '';
  const toolCalls: ToolCall[] = [];
  let citations: Array<{ url: string; title: string; usedInContext?: boolean }> = [];

  const result = await executeAgentTurn(
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

  return {
    content: result.content,
    toolCalls: result.toolCalls,
    citations: result.citations,
  };
}
