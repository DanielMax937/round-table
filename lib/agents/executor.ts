// Agent execution logic

import { query } from '@anthropic-ai/claude-agent-sdk';
import { Agent as AgentModel, Message } from '@prisma/client';
import { AgentContext, ToolCall } from '../types';
import { webSearchTool, createWebSearchToolCall } from './tools/websearch';

/**
 * Build agent context from discussion history
 */
export function buildAgentContext(
  topic: string,
  roundNumber: number,
  previousMessages: (Message & { agent: AgentModel })[],
  currentRoundMessages: (Message & { agent: AgentModel })[]
): AgentContext {
  // Parse toolCalls from JSON string to object
  const mapMessage = (msg: Message & { agent: AgentModel }) => ({
    ...msg,
    toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls as string) : undefined
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

  let promptContent = "";
  for (const m of formattedMessages) {
    if (typeof m.content === 'string') {
      promptContent += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
    }
  }

  promptContent += `\nYou are ${agent.name}. Respond to the discussion above.`;

  const toolCalls: ToolCall[] = [];
  let fullContent = '';

  // Wrap webSearchTool to capture execution
  const toolWrapper = {
    ...webSearchTool,
    execute: async (args: any) => {
      // Capture the tool call
      const toolCall = createWebSearchToolCall(args.query);
      toolCalls.push(toolCall);
      onToolCall?.(toolCall);

      // Execute the original tool
      return webSearchTool.execute(args);
    }
  };

  try {
    const stream = query({
      prompt: promptContent,
      options: {
        // verbose: true, // Removed as invalid in type definition
        systemPrompt: agent.persona,
        tools: [toolWrapper as any],
        includePartialMessages: true,
      }
    });

    for await (const event of stream) {
      // Handle text deltas
      if ((event as any).type === 'stream_event') {
        const payload = (event as any).payload;
        // Based on Anthropic API, text deltas look like:
        // { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } }

        if (payload?.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
          const chunk = payload.delta.text;
          fullContent += chunk;
          onChunk?.(chunk);
        }
      }

      // Handle tool execution success
      // The SDK emits 'tool_result' or similar?
      // Actually, my test script showed 'stream_event' for everything.
      // But we can check if the final result mentions tool use?
      // Or we can rely on 'tool_use' event if it exists.

      // Let's assume we capture tool use from the stream if possible.
      // If the SDK executes the tool, it should emit an event.
      // For now, let's just ensure we get the content. 
      // Tool calls are captured if we parse the output or hook into valid events.

      // Re-reading test output... 
      // If I can't easily capture tool calls from the stream without better types,
      // I might need to rely on the fact that the SDK *did* it.
      // But I need to save it to DB.

      // Let's inspect 'stream_event' payload for tool use.
      if ((event as any).type === 'stream_event') {
        const payload = (event as any).payload;
        if (payload?.type === 'content_block_start' && payload?.content_block?.type === 'tool_use') {
          // Tool use started
          const toolName = payload.content_block.name;
          const toolId = payload.content_block.id;
          // We can't get args yet.
        }
        if (payload?.type === 'content_block_stop') {
          // Tool use block stopped. But where is the JSON input? 
          // It comes in 'content_block_delta' with 'input_json_delta'.
        }
      }

      // IMPORTANT: The SDK executes the tool. We might receive the RESULT.
      // We also want to save that the agent used the tool.
      // If we see 'tool_use' event type (which appeared in test script output as "Event: tool_use" maybe?)
      // Actually in Step 265 output: "Event: stream_event" repeated.
      // "Event: result" at end.

      // Let's assume for now we just want the text content to be right.
      // For `toolCalls` array, if we miss it, the UI won't show the "Search" icon, but the content will have the answer.
      // We can try to extract it from `webSearchTool.execute` side effect? 
      // `webSearchTool.execute` is defined in our code. We can hook it!

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
