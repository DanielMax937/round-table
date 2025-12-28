// Agent execution logic

import { Agent } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { Agent as AgentModel, Message } from '@prisma/client';
import { AgentContext, ToolCall } from '../types';
import { handleWebSearchToolUse } from './tools/websearch';

/**
 * Build agent context from discussion history
 */
export function buildAgentContext(
  topic: string,
  roundNumber: number,
  previousMessages: (Message & { agent: AgentModel })[],
  currentRoundMessages: (Message & { agent: AgentModel })[]
): AgentContext {
  return {
    topic,
    roundNumber,
    previousMessages,
    currentRoundMessages,
  };
}

/**
 * Format messages for the Claude API
 * Converts database messages to Claude message format
 */
export function formatMessagesForClaude(
  context: AgentContext,
  currentAgentId: string
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

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
  content: Anthropic.ContentBlock[]
): Array<{ toolUse: Anthropic.ToolUseBlock; index: number }> {
  const toolUses: Array<{ toolUse: Anthropic.ToolUseBlock; index: number }> = [];

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
  content: Anthropic.ContentBlock[]
): string {
  const textBlocks = content
    .filter((block) => block.type === 'text')
    .map((block) => (block as Anthropic.TextBlock).text);

  return textBlocks.join('\n');
}

/**
 * Execute an agent turn with streaming
 */
export async function executeAgentTurn(
  agent: AgentModel,
  context: AgentContext,
  apiKey: string,
  onChunk?: (chunk: string) => void,
  onToolCall?: (toolCall: ToolCall) => void
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const anthropic = new Anthropic({ apiKey });

  const messages = formatMessagesForClaude(context, agent.id);

  // Build system prompt from agent's persona
  const systemPrompt = agent.persona;

  const toolCalls: ToolCall[] = [];
  let fullContent = '';

  try {
    // Create message with streaming
    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // or latest model
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: [
        {
          name: 'web_search',
          description:
            'Search the web for current information to support your arguments',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
            },
            required: ['query'],
          },
        },
      ],
      stream: true,
    });

    // Process streaming response
    let currentToolUse: Anthropic.ToolUseBlock | null = null;
    let toolInput = '';

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'tool_use') {
            currentToolUse = event.content_block;
            toolInput = '';
          }
          break;

        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            const chunk = event.delta.text;
            fullContent += chunk;
            onChunk?.(chunk);
          } else if (event.delta.type === 'input_json_delta') {
            if (currentToolUse) {
              toolInput += event.delta.partial_json;
            }
          }
          break;

        case 'content_block_stop':
          if (currentToolUse) {
            // Tool use complete - execute it
            const toolName = currentToolUse.name;
            const input = JSON.parse(toolInput);

            if (toolName === 'web_search') {
              const { results, toolCall } = await handleWebSearchToolUse(input.query);
              toolCalls.push(toolCall);
              onToolCall?.(toolCall);

              // Add search results to content
              fullContent += `\n\n🔍 **Searched for:** ${input.query}\n`;
              // Results will be visible in the UI separately
            }

            currentToolUse = null;
            toolInput = '';
          }
          break;
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
