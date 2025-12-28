// Database operations for Message model

import { prisma } from '../prisma';
import { Message, ToolCall } from '../types';

/**
 * Create a new message
 */
export async function createMessage(
  roundId: string,
  agentId: string,
  content: string,
  toolCalls?: ToolCall[]
): Promise<Message> {
  const message = await prisma.message.create({
    data: {
      roundId,
      agentId,
      content,
      toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
    },
  });

  // Parse tool calls for return
  return {
    ...message,
    toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
  };
}

/**
 * Get all messages for a specific round
 */
export async function getMessagesByRound(roundId: string): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: {
      roundId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Parse tool calls for each message
  return messages.map((message) => ({
    ...message,
    toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
  }));
}

/**
 * Get messages for a round with agent information
 */
export async function getMessagesWithAgents(roundId: string) {
  const messages = await prisma.message.findMany({
    where: {
      roundId,
    },
    include: {
      agent: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Parse tool calls for each message
  return messages.map((message) => ({
    ...message,
    toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
  }));
}

/**
 * Get all messages for a specific agent
 */
export async function getMessagesByAgent(agentId: string): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: {
      agentId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Parse tool calls for each message
  return messages.map((message) => ({
    ...message,
    toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
  }));
}

/**
 * Get a message by ID
 */
export async function getMessage(id: string): Promise<Message | null> {
  const message = await prisma.message.findUnique({
    where: { id },
  });

  if (!message) return null;

  return {
    ...message,
    toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
  };
}

/**
 * Update message content
 */
export async function updateMessage(
  id: string,
  content: string,
  toolCalls?: ToolCall[]
): Promise<Message> {
  const message = await prisma.message.update({
    where: { id },
    data: {
      content,
      ...(toolCalls && { toolCalls: JSON.stringify(toolCalls) }),
    },
  });

  return {
    ...message,
    toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
  };
}

/**
 * Delete a message
 */
export async function deleteMessage(id: string): Promise<void> {
  await prisma.message.delete({
    where: { id },
  });
}

/**
 * Delete all messages for a round
 */
export async function deleteMessagesByRound(roundId: string): Promise<void> {
  await prisma.message.deleteMany({
    where: {
      roundId,
    },
  });
}

/**
 * Count messages for a round
 */
export async function countMessages(roundId: string): Promise<number> {
  const count = await prisma.message.count({
    where: {
      roundId,
    },
  });

  return count;
}

/**
 * Get all messages across all rounds for a round table
 */
export async function getAllMessagesForRoundTable(roundTableId: string) {
  const messages = await prisma.message.findMany({
    where: {
      round: {
        roundTableId,
      },
    },
    include: {
      round: true,
      agent: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Parse tool calls for each message
  return messages.map((message) => ({
    ...message,
    toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
  }));
}

/**
 * Get messages for the current (in-progress) round of a round table
 */
export async function getCurrentRoundMessages(roundTableId: string) {
  const round = await prisma.round.findFirst({
    where: {
      roundTableId,
      status: 'in_progress',
    },
    include: {
      messages: {
        include: {
          agent: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!round) return null;

  return {
    round,
    messages: round.messages.map((message) => ({
      ...message,
      toolCalls: message.toolCalls ? JSON.parse(message.toolCalls) : undefined,
    })),
  };
}
