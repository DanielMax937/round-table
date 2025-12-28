// Database operations for Round model

import { prisma } from '../prisma';
import { Round, RoundStatus } from '@prisma/client';
import { RoundWithMessages } from '../types';

/**
 * Create a new round for a round table
 */
export async function createRound(
  roundTableId: string,
  roundNumber: number
): Promise<Round> {
  const round = await prisma.round.create({
    data: {
      roundTableId,
      roundNumber,
      status: 'in_progress',
    },
  });

  return round;
}

/**
 * Get a round by ID
 */
export async function getRound(id: string): Promise<Round | null> {
  const round = await prisma.round.findUnique({
    where: { id },
  });

  return round;
}

/**
 * Get a round with all messages
 */
export async function getRoundWithMessages(id: string): Promise<RoundWithMessages | null> {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  return round;
}

/**
 * Get all rounds for a specific round table
 */
export async function getRoundsByRoundTable(roundTableId: string): Promise<Round[]> {
  const rounds = await prisma.round.findMany({
    where: {
      roundTableId,
    },
    orderBy: {
      roundNumber: 'asc',
    },
  });

  return rounds;
}

/**
 * Get all rounds for a round table with messages
 */
export async function getRoundsWithMessages(roundTableId: string): Promise<RoundWithMessages[]> {
  const rounds = await prisma.round.findMany({
    where: {
      roundTableId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      roundNumber: 'asc',
    },
  });

  return rounds;
}

/**
 * Get the latest (most recent) round for a round table
 */
export async function getLatestRound(roundTableId: string): Promise<Round | null> {
  const round = await prisma.round.findFirst({
    where: {
      roundTableId,
    },
    orderBy: {
      roundNumber: 'desc',
    },
  });

  return round;
}

/**
 * Get the latest round with messages
 */
export async function getLatestRoundWithMessages(
  roundTableId: string
): Promise<RoundWithMessages | null> {
  const round = await prisma.round.findFirst({
    where: {
      roundTableId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      roundNumber: 'desc',
    },
  });

  return round;
}

/**
 * Get the next round number for a round table
 */
export async function getNextRoundNumber(roundTableId: string): Promise<number> {
  const latestRound = await getLatestRound(roundTableId);

  if (!latestRound) {
    return 1; // First round
  }

  return latestRound.roundNumber + 1;
}

/**
 * Update round status
 */
export async function updateRoundStatus(
  id: string,
  status: RoundStatus,
  completedAt?: Date
): Promise<Round> {
  const round = await prisma.round.update({
    where: { id },
    data: {
      status,
      ...(completedAt && { completedAt }),
    },
  });

  return round;
}

/**
 * Mark a round as completed
 */
export async function completeRound(id: string): Promise<Round> {
  const round = await prisma.round.update({
    where: { id },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });

  return round;
}

/**
 * Get all in-progress rounds (for recovery after restart)
 */
export async function getInProgressRounds(): Promise<Round[]> {
  const rounds = await prisma.round.findMany({
    where: {
      status: 'in_progress',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return rounds;
}

/**
 * Count rounds for a round table
 */
export async function countRounds(roundTableId: string): Promise<number> {
  const count = await prisma.round.count({
    where: {
      roundTableId,
    },
  });

  return count;
}

/**
 * Count completed rounds for a round table
 */
export async function countCompletedRounds(roundTableId: string): Promise<number> {
  const count = await prisma.round.count({
    where: {
      roundTableId,
      status: 'completed',
    },
  });

  return count;
}
