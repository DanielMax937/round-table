/**
 * MemOS client 单元测试
 * 验证 buildSearchQuery、buildAddMessageUserContent、formatMemoriesForPrompt
 * 以及 searchMemory、addMessage 在启用时调用 MemOS API
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSearchQuery,
  buildAddMessageUserContent,
  formatMemoriesForPrompt,
  searchMemory,
  addMessage,
} from '../client';

describe('MemOS client', () => {
  describe('buildSearchQuery', () => {
    test('拼接 heading、contentSummary、emotionalGoal、prevRoundSummary', () => {
      const sceneContext = {
        heading: 'INT. ROOM - DAY',
        contentSummary: 'Alice meets Bob.',
        emotionalGoal: 'Tension',
      };
      const prevRoundSummary = 'Alice: Hello. Bob: Hi.';
      const query = buildSearchQuery(sceneContext, prevRoundSummary);
      expect(query).toContain('INT. ROOM - DAY');
      expect(query).toContain('Alice meets Bob');
      expect(query).toContain('Tension');
      expect(query).toContain('Alice: Hello');
    });

    test('截断超长字段：heading 80、prevRound 200、总长 400', () => {
      const long = 'x'.repeat(100);
      const query = buildSearchQuery(
        { heading: long, contentSummary: '', emotionalGoal: '' },
        'y'.repeat(300)
      );
      expect(query.length).toBeLessThanOrEqual(400);
    });
  });

  describe('buildAddMessageUserContent', () => {
    test('包含场景上下文与同轮其他角色台词', () => {
      const sceneContext = {
        heading: 'INT. OFFICE',
        contentSummary: 'Meeting',
        emotionalGoal: 'Resolve conflict',
      };
      const otherLines = [
        { name: 'Alice', content: 'I disagree.' },
        { name: 'Bob', content: 'Let me explain.' },
      ];
      const content = buildAddMessageUserContent(sceneContext, otherLines);
      expect(content).toContain('[场景]');
      expect(content).toContain('INT. OFFICE');
      expect(content).toContain('目标: Resolve conflict');
      expect(content).toContain('Alice: I disagree');
      expect(content).toContain('Bob: Let me explain');
    });

    test('截断 scenePart 300、otherPart 500', () => {
      const longScene = 'x'.repeat(500);
      const content = buildAddMessageUserContent(
        { heading: longScene, contentSummary: '', emotionalGoal: '' },
        []
      );
      expect(content.length).toBeLessThanOrEqual(320);
    });
  });

  describe('formatMemoriesForPrompt', () => {
    test('空数组返回空字符串', () => {
      expect(formatMemoriesForPrompt([])).toBe('');
    });

    test('格式化为 - item 列表', () => {
      const items = [
        { text: 'Alice likes coffee', type: 'fact' as const },
        { text: 'Prefers morning meetings', type: 'preference' as const },
      ];
      const out = formatMemoriesForPrompt(items);
      expect(out).toContain('- Alice likes coffee');
      expect(out).toContain('- Prefers morning meetings');
    });

    test('超过 MAX_MEMORY_CHARS 时截断', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        text: `memory ${i} `.repeat(5),
        type: 'fact' as const,
      }));
      const out = formatMemoriesForPrompt(items);
      expect(out).toContain('... (truncated)');
    });
  });

  describe('searchMemory', () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env;

    beforeEach(() => {
      process.env.MEMOS_ENABLED = 'true';
      process.env.MEMOS_BASE_URL = 'http://localhost:9005';
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      process.env = originalEnv;
    });

    test('MEMOS_ENABLED=false 时直接返回空数组', async () => {
      process.env.MEMOS_ENABLED = 'false';
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      const result = await searchMemory('char1', 'movie1', 'query');
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('启用时调用 /product/search', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          memory_detail_list: [{ memory_value: 'Alice remembers X' }],
          preference_detail_list: [],
        }),
      });
      globalThis.fetch = mockFetch;

      const result = await searchMemory('char1', 'movie1', 'test query');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9005/product/search',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'test query',
            user_id: 'char1',
            readable_cube_ids: ['movie1'],
          }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Alice remembers X');
    });
  });

  describe('addMessage', () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env;

    beforeEach(() => {
      process.env.MEMOS_ENABLED = 'true';
      process.env.MEMOS_BASE_URL = 'http://localhost:9005';
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      process.env = originalEnv;
    });

    test('MEMOS_ENABLED=false 时不调用 fetch', async () => {
      process.env.MEMOS_ENABLED = 'false';
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      await addMessage('char1', 'movie1', [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('启用时调用 /product/add', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = mockFetch;

      await addMessage('char1', 'movie1', [
        { role: 'user', content: 'Scene context' },
        { role: 'assistant', content: 'My line' },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9005/product/add',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 'char1',
            writable_cube_ids: ['movie1'],
            messages: [
              { role: 'user', content: 'Scene context' },
              { role: 'assistant', content: 'My line' },
            ],
            async_mode: 'sync',
          }),
        })
      );
    });
  });
});
