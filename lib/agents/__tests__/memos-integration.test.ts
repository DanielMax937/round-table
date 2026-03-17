/**
 * MemOS 集成测试
 * 验证 executor 和 orchestrator 在传入 movieContext 时调用 MemOS 接口
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { executeAgentTurn } from '../executor';
import { executeRound } from '../orchestrator';
import type { AgentModel } from '@/lib/types';

const mockSearchMemory = vi.fn();
const mockAddMessage = vi.fn();
const mockBuildSearchQuery = vi.fn();
const mockFormatMemoriesForPrompt = vi.fn();
const mockBuildAddMessageUserContent = vi.fn();

vi.mock('@/lib/memos/client', () => ({
  searchMemory: (...args: unknown[]) => mockSearchMemory(...args),
  addMessage: (...args: unknown[]) => mockAddMessage(...args),
  buildSearchQuery: (...args: unknown[]) => mockBuildSearchQuery(...args),
  formatMemoriesForPrompt: (...args: unknown[]) => mockFormatMemoriesForPrompt(...args),
  buildAddMessageUserContent: (...args: unknown[]) => mockBuildAddMessageUserContent(...args),
}));

vi.mock('@/lib/llm/client', () => ({
  streamChatCompletion: vi.fn().mockImplementation(async function* () {
    yield { type: 'content_delta', delta: 'Mocked response' };
  }),
}));

describe('MemOS integration', () => {
  const mockAgent: AgentModel = {
    id: 'agent-1',
    name: 'Alice',
    persona: 'You are Alice.',
    order: 1,
    roundTableId: 'rt-1',
  };

  const mockContext = {
    topic: 'Scene: INT. ROOM - DAY',
    roundNumber: 1,
    previousMessages: [],
    currentRoundMessages: [],
  };

  const movieContext = {
    movieId: 'movie-123',
    characterIdByAgentId: { 'agent-1': 'char-alice' },
    sceneContext: {
      heading: 'INT. ROOM - DAY',
      contentSummary: 'Alice meets Bob',
      emotionalGoal: 'Tension',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMemory.mockResolvedValue([]);
    mockBuildSearchQuery.mockReturnValue('search query');
    mockFormatMemoriesForPrompt.mockReturnValue('');
    mockBuildAddMessageUserContent.mockReturnValue('user content');
  });

  describe('executeAgentTurn with movieContext', () => {
    test('调用 searchMemory 当 movieContext 存在且 characterId 匹配', async () => {
      await executeAgentTurn(
        mockAgent,
        mockContext,
        'sk-test',
        { movieContext, toolsEnabled: false }
      );

      expect(mockBuildSearchQuery).toHaveBeenCalledWith(
        movieContext.sceneContext,
        expect.any(String)
      );
      expect(mockSearchMemory).toHaveBeenCalledWith(
        'char-alice',
        'movie-123',
        'search query'
      );
    });

    test('不调用 searchMemory 当 movieContext 不存在', async () => {
      await executeAgentTurn(mockAgent, mockContext, 'sk-test', {
        toolsEnabled: false,
      });

      expect(mockSearchMemory).not.toHaveBeenCalled();
      expect(mockBuildSearchQuery).not.toHaveBeenCalled();
    });

    test('不调用 searchMemory 当 characterId 不匹配', async () => {
      const ctxNoChar = {
        ...movieContext,
        characterIdByAgentId: {},
      };
      await executeAgentTurn(mockAgent, mockContext, 'sk-test', {
        movieContext: ctxNoChar,
        toolsEnabled: false,
      });

      expect(mockSearchMemory).not.toHaveBeenCalled();
    });
  });

  describe('executeRound with movieContext', () => {
    test('每轮 agent 完成后调用 addMessage', async () => {
      const agents: AgentModel[] = [mockAgent];
      const result = await executeRound(
        agents,
        'Topic',
        1,
        [],
        { apiKey: 'sk-test', toolsEnabled: false, movieContext }
      );

      expect(result.messages).toHaveLength(1);
      expect(mockBuildAddMessageUserContent).toHaveBeenCalledWith(
        movieContext.sceneContext,
        expect.any(Array)
      );
      expect(mockAddMessage).toHaveBeenCalledWith(
        'char-alice',
        'movie-123',
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'user content' }),
          expect.objectContaining({ role: 'assistant', content: 'Mocked response' }),
        ])
      );
    });

    test('不调用 addMessage 当 movieContext 不存在', async () => {
      await executeRound([mockAgent], 'Topic', 1, [], {
        apiKey: 'sk-test',
        toolsEnabled: false,
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });
  });
});
