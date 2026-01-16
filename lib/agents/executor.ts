// Agent execution logic

import { Agent as AgentModel, Message } from '@prisma/client';
import { AgentContext, ToolCall } from '../types';
import { performWebSearch, formatSearchResults } from './tools/websearch';
import { z } from 'zod';
import { streamChatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';

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

  // NOTE: Web search tooling has been removed with the Claude SDK migration.
  // To re-add web search capability, you can implement it as:
  // 1. Function calling with OpenAI (if your model supports it)
  // 2. Prompt-based approach where agent requests search via special syntax
  // 3. External orchestration layer that detects search requests

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

    const stream = streamChatCompletion(messages);

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        fullContent += chunk.delta;
        onChunk?.(chunk.delta);
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
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
