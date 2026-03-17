/**
 * MemOS REST client for AI Movie character memory.
 * Self-hosted API: /product/add, /product/search
 */

import type {
  MemosAddMessageRequest,
  MemosSearchRequest,
  MemosSearchResponse,
  MemosMemoryItem,
} from './types';

const MAX_MEMORY_CHARS = 1500;

function getBaseUrl(): string {
  const url = process.env.MEMOS_BASE_URL || 'http://localhost:9005';
  return url.replace(/\/$/, '');
}

function isEnabled(): boolean {
  return process.env.MEMOS_ENABLED !== 'false';
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = process.env.MEMOS_API_KEY;
  if (key?.trim()) {
    headers['Authorization'] = `Token ${key.trim()}`;
  }
  return headers;
}

/**
 * Add messages to MemOS (character dialogue).
 * Fails silently - logs and returns, does not throw.
 */
export async function addMessage(
  characterId: string,
  movieId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  if (!isEnabled()) return;

  const body: MemosAddMessageRequest = {
    user_id: characterId,
    writable_cube_ids: [movieId],
    messages,
    async_mode: 'sync',
  };

  try {
    const res = await fetch(`${getBaseUrl()}/product/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[MemOS] add_message failed: ${res.status} ${res.statusText}`);
      return;
    }
  } catch (err) {
    console.warn('[MemOS] add_message error:', err instanceof Error ? err.message : err);
  }
}

/**
 * Search MemOS for relevant memories.
 * Returns parsed memory items, or empty array on failure/empty.
 */
export async function searchMemory(
  characterId: string,
  movieId: string,
  query: string
): Promise<MemosMemoryItem[]> {
  if (!isEnabled()) return [];

  const body: MemosSearchRequest = {
    query,
    user_id: characterId,
    readable_cube_ids: [movieId],
  };

  try {
    const res = await fetch(`${getBaseUrl()}/product/search`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[MemOS] search_memory failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as MemosSearchResponse;
    return parseSearchResponse(data);
  } catch (err) {
    console.warn('[MemOS] search_memory error:', err instanceof Error ? err.message : err);
    return [];
  }
}

function parseSearchResponse(data: MemosSearchResponse): MemosMemoryItem[] {
  const items: MemosMemoryItem[] = [];

  if (Array.isArray(data.memory_detail_list)) {
    for (const m of data.memory_detail_list) {
      const text = m.memory_value ?? m.memory_key ?? '';
      if (typeof text === 'string' && text.trim()) {
        items.push({ text: text.trim(), type: 'fact' });
      }
    }
  }

  if (Array.isArray(data.preference_detail_list)) {
    for (const p of data.preference_detail_list) {
      const text = p.preference ?? p.reasoning ?? '';
      if (typeof text === 'string' && text.trim()) {
        items.push({ text: text.trim(), type: 'preference' });
      }
    }
  }

  return items;
}

/**
 * Format memory items for prompt injection. Truncates to MAX_MEMORY_CHARS.
 */
export function formatMemoriesForPrompt(items: MemosMemoryItem[]): string {
  if (items.length === 0) return '';

  let out = items.map((i) => `- ${i.text}`).join('\n');
  if (out.length > MAX_MEMORY_CHARS) {
    out = out.slice(0, MAX_MEMORY_CHARS - 20) + '\n... (truncated)';
  }
  return out;
}

const truncate = (s: string, max: number) =>
  s.length <= max ? s : s.slice(0, max - 3) + '...';

/**
 * Build search query per spec: [heading] [contentSummary] [emotionalGoal] [prev round summary]
 * Each segment max 80 chars, prev round max 200 chars, total max 400 chars.
 */
export function buildSearchQuery(
  sceneContext: { heading: string; contentSummary: string; emotionalGoal: string },
  prevRoundSummary: string
): string {
  const parts = [
    truncate(sceneContext.heading, 80),
    truncate(sceneContext.contentSummary, 80),
    truncate(sceneContext.emotionalGoal, 80),
    truncate(prevRoundSummary, 200),
  ].filter(Boolean);
  const query = parts.join(' ');
  return truncate(query, 400);
}

/**
 * Build user content for add_message: scene context + other characters' lines this round.
 * Scene context max 300 chars, other lines max 500 chars.
 */
export function buildAddMessageUserContent(
  sceneContext: { heading: string; contentSummary: string; emotionalGoal: string },
  otherLinesThisRound: Array<{ name: string; content: string }>
): string {
  const scenePart = `[场景] ${sceneContext.heading}\n${sceneContext.contentSummary}\n目标: ${sceneContext.emotionalGoal}`;
  const sceneTruncated = truncate(scenePart, 300);
  const otherPart = otherLinesThisRound
    .map((l) => `${l.name}: ${l.content}`)
    .join('\n');
  const otherTruncated = truncate(otherPart, 500);
  return [sceneTruncated, otherTruncated].filter(Boolean).join('\n\n');
}
