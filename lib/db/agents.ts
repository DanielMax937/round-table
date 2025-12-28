// Database operations for Agent model

import { prisma } from '../prisma';
import { Agent } from '@prisma/client';
import { AgentPersona } from '../types';

/**
 * Create multiple agents for a round table
 */
export async function createAgents(
  roundTableId: string,
  personas: AgentPersona[]
): Promise<Agent[]> {
  const agents = await prisma.agent.createMany({
    data: personas.map((persona, index) => ({
      roundTableId,
      name: persona.name,
      persona: persona.systemPrompt,
      order: index + 1,
    })),
  });

  // Fetch and return the created agents
  return getAgentsByRoundTable(roundTableId);
}

/**
 * Get all agents for a specific round table, ordered by turn order
 */
export async function getAgentsByRoundTable(roundTableId: string): Promise<Agent[]> {
  const agents = await prisma.agent.findMany({
    where: {
      roundTableId,
    },
    orderBy: {
      order: 'asc',
    },
  });

  return agents;
}

/**
 * Get a single agent by ID
 */
export async function getAgent(id: string): Promise<Agent | null> {
  const agent = await prisma.agent.findUnique({
    where: { id },
  });

  return agent;
}

/**
 * Get agents with their messages for a specific round table
 */
export async function getAgentsWithMessages(roundTableId: string) {
  const agents = await prisma.agent.findMany({
    where: {
      roundTableId,
    },
    include: {
      messages: {
        include: {
          round: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      order: 'asc',
    },
  });

  return agents;
}

/**
 * Update an agent's persona
 */
export async function updateAgentPersona(
  id: string,
  persona: string
): Promise<Agent> {
  const agent = await prisma.agent.update({
    where: { id },
    data: {
      persona,
    },
  });

  return agent;
}

/**
 * Get agent by round table and order (turn position)
 */
export async function getAgentByOrder(
  roundTableId: string,
  order: number
): Promise<Agent | null> {
  const agent = await prisma.agent.findFirst({
    where: {
      roundTableId,
      order,
    },
  });

  return agent;
}

/**
 * Delete all agents for a round table
 * Note: This is typically handled by cascade delete when deleting the round table
 */
export async function deleteAgentsByRoundTable(roundTableId: string): Promise<void> {
  await prisma.agent.deleteMany({
    where: {
      roundTableId,
    },
  });
}
