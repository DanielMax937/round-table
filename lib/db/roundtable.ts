// Database operations for RoundTable model

import { prisma } from '../prisma';
import { RoundTable, RoundTableWithAgents, RoundTableWithDetails, RoundTableStatus } from '../types';
import { getDefaultPersonas } from '../personas';

/**
 * Create a new round table with agents
 */
export async function createRoundTable(
  topic: string,
  agentCount: number,
  customPersonas?: Array<{ name: string; persona: string }>
): Promise<RoundTableWithAgents> {
  // Validate agent count
  if (agentCount < 2 || agentCount > 6) {
    throw new Error('Agent count must be between 2 and 6');
  }

  // Validate topic
  if (!topic || topic.trim().length === 0) {
    throw new Error('Topic cannot be empty');
  }

  // Get personas (custom or default)
  const personas = customPersonas || getDefaultPersonas(agentCount);

  if (personas.length !== agentCount) {
    throw new Error(`Expected ${agentCount} personas, got ${personas.length}`);
  }

  // Create round table with agents in a transaction
  const roundTable = await prisma.roundTable.create({
    data: {
      topic: topic.trim(),
      agentCount,
      status: 'active',
      agents: {
        create: personas.map((persona, index) => ({
          name: persona.name,
          persona: persona.persona || persona.systemPrompt,
          order: index + 1,
        })),
      },
    },
    include: {
      agents: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  return roundTable;
}

/**
 * Get a round table by ID with agents
 */
export async function getRoundTable(id: string): Promise<RoundTableWithAgents | null> {
  const roundTable = await prisma.roundTable.findUnique({
    where: { id },
    include: {
      agents: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  return roundTable;
}

/**
 * Get a round table with full details (rounds and messages)
 */
export async function getRoundTableWithDetails(id: string): Promise<RoundTableWithDetails | null> {
  const roundTable = await prisma.roundTable.findUnique({
    where: { id },
    include: {
      agents: {
        orderBy: {
          order: 'asc',
        },
      },
      rounds: {
        orderBy: {
          roundNumber: 'asc',
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      },
    },
  });

  return roundTable;
}

/**
 * Get all round tables with agent and round counts
 */
export async function getAllRoundTables(
  status?: RoundTableStatus
): Promise<RoundTableWithAgents[]> {
  const where = status ? { status } : {};

  const roundTables = await prisma.roundTable.findMany({
    where,
    include: {
      agents: {
        orderBy: {
          order: 'asc',
        },
      },
      _count: {
        select: {
          rounds: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return roundTables as RoundTableWithAgents[];
}

/**
 * Update round table status
 */
export async function updateRoundTableStatus(
  id: string,
  status: RoundTableStatus
): Promise<RoundTable> {
  const roundTable = await prisma.roundTable.update({
    where: { id },
    data: { status },
  });

  return roundTable;
}

/**
 * Delete a round table (cascades to agents, rounds, messages)
 */
export async function deleteRoundTable(id: string): Promise<void> {
  await prisma.roundTable.delete({
    where: { id },
  });
}

/**
 * Check if round table exists
 */
export async function roundTableExists(id: string): Promise<boolean> {
  const count = await prisma.roundTable.count({
    where: { id },
  });

  return count > 0;
}

/**
 * Get round tables with pagination
 */
export async function getRoundTablesPaginated(
  page: number = 1,
  pageSize: number = 10,
  status?: RoundTableStatus
): Promise<{ roundTables: RoundTableWithAgents[]; total: number }> {
  const skip = (page - 1) * pageSize;
  const where = status ? { status } : {};

  const [roundTables, total] = await Promise.all([
    prisma.roundTable.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        agents: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            rounds: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.roundTable.count({ where }),
  ]);

  return {
    roundTables: roundTables as RoundTableWithAgents[],
    total,
  };
}
