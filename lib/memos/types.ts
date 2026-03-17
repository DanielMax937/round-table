/** MemOS REST API types - adapt to actual MemOS self-hosted response structure */

export interface MemosAddMessageRequest {
  user_id: string;
  mem_cube_id: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  async_mode?: 'sync' | 'async';
}

export interface MemosSearchRequest {
  query: string;
  user_id: string;
  mem_cube_id: string;
}

/** Parsed memory item for prompt injection */
export interface MemosMemoryItem {
  text: string;
  type?: 'fact' | 'preference';
}

/**
 * MemOS search response - structure may vary by version.
 * Parse memory_detail_list, preference_detail_list, or similar fields.
 */
export interface MemosSearchResponse {
  memory_detail_list?: Array<{ memory_key?: string; memory_value?: string; [k: string]: unknown }>;
  preference_detail_list?: Array<{
    preference?: string;
    reasoning?: string;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
}
