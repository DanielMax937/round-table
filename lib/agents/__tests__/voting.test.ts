import { describe, test, expect } from 'vitest';
import { aggregateVotes, determineWinner } from '../voting';
import { Vote, AgentScore } from '@/lib/moe-vote/types';

describe('Voting Logic', () => {
  const mockAgents = [
    { id: 'a1', name: 'Agent 1' },
    { id: 'a2', name: 'Agent 2' },
    { id: 'a3', name: 'Agent 3' },
  ];

  test('aggregateVotes calculates average scores correctly', () => {
    const votes: Vote[] = [
      {
        agentId: 'a1',
        voterId: 'v1',
        voterName: 'Voter 1',
        score: 8,
        justification: 'Good',
      },
      {
        agentId: 'a1',
        voterId: 'v2',
        voterName: 'Voter 2',
        score: 6,
        justification: 'Okay',
      },
      {
        agentId: 'a2',
        voterId: 'v1',
        voterName: 'Voter 1',
        score: 9,
        justification: 'Great',
      },
    ];

    const aggregated = aggregateVotes(votes, mockAgents as any);

    expect(aggregated['a1'].averageScore).toBe(7); // (8+6)/2
    expect(aggregated['a1'].votes.length).toBe(2);
    expect(aggregated['a2'].averageScore).toBe(9);
    expect(aggregated['a2'].votes.length).toBe(1);
  });

  test('determineWinner selects agent with highest average', () => {
    const scores: { [key: string]: AgentScore } = {
      a1: {
        agentId: 'a1',
        agentName: 'Agent 1',
        averageScore: 7.5,
        votes: [],
      },
      a2: {
        agentId: 'a2',
        agentName: 'Agent 2',
        averageScore: 9.0,
        votes: [],
      },
      a3: {
        agentId: 'a3',
        agentName: 'Agent 3',
        averageScore: 6.0,
        votes: [],
      },
    };

    const winner = determineWinner(scores);

    expect(winner.agentId).toBe('a2');
    expect(winner.agentName).toBe('Agent 2');
    expect(winner.averageScore).toBe(9.0);
  });

  test('determineWinner handles tie by selecting first agent', () => {
    const scores: { [key: string]: AgentScore } = {
      a1: {
        agentId: 'a1',
        agentName: 'Agent 1',
        averageScore: 8.0,
        votes: [],
      },
      a2: {
        agentId: 'a2',
        agentName: 'Agent 2',
        averageScore: 8.0,
        votes: [],
      },
    };

    const winner = determineWinner(scores);

    expect(winner.agentId).toBe('a1');
    expect(winner.averageScore).toBe(8.0);
  });
});
