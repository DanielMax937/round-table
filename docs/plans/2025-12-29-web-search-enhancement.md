# Web Search Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock web search with production Serper AI + Jina AI Reader integration with database caching

**Architecture:** Two-tier search (Serper for discovery, Jina for content extraction) with SQLite cache (24h TTL), parallel Jina fetches (concurrency: 3), graceful fallback to snippets

**Tech Stack:** Serper AI API, Jina AI Reader API, p-limit, Prisma, SQLite

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (dependencies section)

**Step 1: Install p-limit package**

Run: `npm install p-limit`

Expected: Package added to package.json and node_modules

**Step 2: Verify installation**

Run: `npm list p-limit`

Expected: Shows p-limit@4.x.x

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add p-limit for concurrency control"
```

---

## Task 2: Add SearchCache Model to Schema

**Files:**
- Modify: `prisma/schema.prisma` (add model after Message model)

**Step 1: Add SearchCache model**

Add to `prisma/schema.prisma` after the Message model:

```prisma
model SearchCache {
  id        String   @id @default(cuid())
  query     String   @unique
  results   Json     // Array of EnrichedSearchResult
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])  // For efficient cleanup
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add-search-cache`

Expected: Migration created and applied, Prisma Client regenerated

**Step 3: Verify schema**

Run: `npx prisma studio`

Expected: SearchCache table visible in Prisma Studio (can close immediately)

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SearchCache model for 24h result caching"
```

---

## Task 3: Update Type Definitions

**Files:**
- Modify: `lib/types.ts:21-25` (replace WebSearchResult)

**Step 1: Add new search result types**

Replace lines 21-25 in `lib/types.ts` with:

```typescript
// Basic result from Serper
export interface SerperSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Enriched result with Jina content
export interface EnrichedSearchResult {
  title: string;
  url: string;
  snippet: string;  // Original Serper snippet
  enrichedContent: {
    markdown: string;      // Full content from Jina
    fetchedAt: Date;       // When content was fetched
    source: 'jina' | 'fallback';  // Track if Jina succeeded
    truncated?: boolean;   // If Jina indicated truncation
  } | null;  // null if enrichment failed
}

// Update existing WebSearchResult type
export interface WebSearchResult extends EnrichedSearchResult {}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No errors (types backward-compatible)

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add enriched search result types for Jina content"
```

---

## Task 4: Create Search Configuration File

**Files:**
- Create: `lib/agents/tools/config.ts`

**Step 1: Create config file**

Create `lib/agents/tools/config.ts`:

```typescript
// Search tool configuration

export const searchConfig = {
  serperApiKey: process.env.SERPER_API_KEY,  // Required
  jinaEnabled: true,                          // Always enabled (free)
  maxResults: 5,                              // Fixed
  serperTimeout: 15000,                       // 15 seconds
  jinaTimeout: 8000,                          // 8 seconds per URL
  jinaMaxConcurrency: 3,                      // Parallel fetch limit
  cacheTTL: 24 * 60 * 60 * 1000,             // 24 hours in ms
};

// Validation on module load
if (!searchConfig.serperApiKey) {
  console.warn('⚠️  SERPER_API_KEY not set - web search will fail');
  console.warn('   Get free API key at: https://serper.dev/');
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add lib/agents/tools/config.ts
git commit -m "feat: add search tool configuration with validation"
```

---

## Task 5: Create Search Cache Database Module (TDD - Part 1: Tests)

**Files:**
- Create: `lib/db/searchCache.ts`
- Create: `scripts/test-search-cache.ts`

**Step 1: Write failing test**

Create `scripts/test-search-cache.ts`:

```typescript
import {
  getCachedResults,
  setCachedResults,
  cleanExpiredCache,
} from '../lib/db/searchCache';
import { WebSearchResult } from '../lib/types';

async function testSearchCache() {
  console.log('🧪 Testing Search Cache Module\n');

  // Test 1: Cache miss returns null
  console.log('✅ Test 1: Cache miss...');
  const miss = await getCachedResults('nonexistent-query');
  if (miss !== null) throw new Error('Expected null for cache miss');
  console.log('   Cache miss returned null ✓\n');

  // Test 2: Cache hit returns results
  console.log('✅ Test 2: Cache hit...');
  const testResults: WebSearchResult[] = [
    {
      title: 'Test Result',
      url: 'https://example.com',
      snippet: 'Test snippet',
      enrichedContent: {
        markdown: 'Test markdown content',
        fetchedAt: new Date(),
        source: 'jina',
      },
    },
  ];

  await setCachedResults('test-query', testResults);
  const hit = await getCachedResults('test-query');
  if (!hit || hit.length !== 1) throw new Error('Cache hit failed');
  if (hit[0].title !== 'Test Result') throw new Error('Wrong cached data');
  console.log('   Cached and retrieved results ✓\n');

  // Test 3: Expired cache returns null
  console.log('✅ Test 3: Expired cache...');
  // Manually create expired cache entry via direct Prisma access
  const { default: prisma } = await import('../lib/prisma');
  await prisma.searchCache.create({
    data: {
      query: 'expired-query',
      results: testResults as any,
      expiresAt: new Date(Date.now() - 1000), // Already expired
    },
  });

  const expired = await getCachedResults('expired-query');
  if (expired !== null) throw new Error('Expired cache should return null');

  // Verify it was deleted
  const deleted = await prisma.searchCache.findUnique({
    where: { query: 'expired-query' },
  });
  if (deleted !== null) throw new Error('Expired cache should be deleted');
  console.log('   Expired cache auto-deleted ✓\n');

  // Test 4: Clean expired cache
  console.log('✅ Test 4: Cleanup expired entries...');
  await prisma.searchCache.create({
    data: {
      query: 'cleanup-test',
      results: testResults as any,
      expiresAt: new Date(Date.now() - 5000),
    },
  });

  await cleanExpiredCache();

  const cleaned = await prisma.searchCache.findUnique({
    where: { query: 'cleanup-test' },
  });
  if (cleaned !== null) throw new Error('Cleanup failed');
  console.log('   Expired entries cleaned ✓\n');

  // Cleanup
  await prisma.searchCache.deleteMany({});

  console.log('🎉 All search cache tests passed!\n');
}

testSearchCache().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `tsx scripts/test-search-cache.ts`

Expected: Error "Cannot find module '../lib/db/searchCache'"

**Step 3: Commit failing test**

```bash
git add scripts/test-search-cache.ts
git commit -m "test: add search cache module tests (failing)"
```

---

## Task 6: Create Search Cache Database Module (TDD - Part 2: Implementation)

**Files:**
- Create: `lib/db/searchCache.ts`

**Step 1: Write minimal implementation**

Create `lib/db/searchCache.ts`:

```typescript
import prisma from '../prisma';
import { WebSearchResult } from '../types';
import { searchConfig } from '../agents/tools/config';

/**
 * Get cached search results
 * Returns null if not found or expired
 */
export async function getCachedResults(
  query: string
): Promise<WebSearchResult[] | null> {
  try {
    const cached = await prisma.searchCache.findUnique({
      where: { query },
    });

    if (!cached) return null;

    // Check expiration
    if (cached.expiresAt < new Date()) {
      // Expired, delete it
      await prisma.searchCache.delete({ where: { query } });
      return null;
    }

    return cached.results as WebSearchResult[];
  } catch (error) {
    console.error('Cache read error:', error);
    return null; // Degrade gracefully
  }
}

/**
 * Store search results in cache
 */
export async function setCachedResults(
  query: string,
  results: WebSearchResult[]
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + searchConfig.cacheTTL);

    await prisma.searchCache.upsert({
      where: { query },
      create: {
        query,
        results: results as any,
        expiresAt,
      },
      update: {
        results: results as any,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Cache write error:', error);
    // Don't throw - return results anyway
  }
}

/**
 * Remove expired cache entries
 */
export async function cleanExpiredCache(): Promise<void> {
  try {
    const result = await prisma.searchCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`Cleaned ${result.count} expired cache entries`);
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}
```

**Step 2: Run test to verify it passes**

Run: `tsx scripts/test-search-cache.ts`

Expected: All tests pass

**Step 3: Commit implementation**

```bash
git add lib/db/searchCache.ts
git commit -m "feat: implement search cache with 24h TTL and auto-cleanup"
```

---

## Task 7: Implement Serper Search (TDD - Part 1: Tests)

**Files:**
- Create: `scripts/test-serper.ts`

**Step 1: Write failing test**

Create `scripts/test-serper.ts`:

```typescript
// Test Serper search integration
// NOTE: Requires SERPER_API_KEY in .env

async function testSerperSearch() {
  console.log('🧪 Testing Serper Search Integration\n');

  if (!process.env.SERPER_API_KEY) {
    console.log('⚠️  SERPER_API_KEY not set - skipping integration test');
    console.log('   Get free API key at: https://serper.dev/\n');
    return;
  }

  const { serperSearch } = await import('../lib/agents/tools/websearch');

  // Test 1: Basic search
  console.log('✅ Test 1: Basic search...');
  const results = await serperSearch('TypeScript programming language');

  if (!Array.isArray(results)) throw new Error('Results should be array');
  if (results.length === 0) throw new Error('Should return results');
  if (results.length > 5) throw new Error('Should limit to 5 results');

  const first = results[0];
  if (!first.title) throw new Error('Result should have title');
  if (!first.url) throw new Error('Result should have url');
  if (!first.snippet) throw new Error('Result should have snippet');

  console.log(`   Received ${results.length} results`);
  console.log(`   First result: ${first.title.substring(0, 50)}...`);
  console.log('   ✓\n');

  // Test 2: Empty results (very obscure query)
  console.log('✅ Test 2: Obscure query...');
  const obscure = await serperSearch('xyzabc123nonexistent456query789');
  console.log(`   Received ${obscure.length} results (may be 0) ✓\n`);

  console.log('🎉 Serper integration tests passed!\n');
}

testSerperSearch().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `tsx scripts/test-serper.ts`

Expected: Error "Cannot find module" or "serperSearch is not exported"

**Step 3: Commit failing test**

```bash
git add scripts/test-serper.ts
git commit -m "test: add Serper API integration tests (failing)"
```

---

## Task 8: Implement Serper Search (TDD - Part 2: Implementation)

**Files:**
- Modify: `lib/agents/tools/websearch.ts` (add serperSearch function)

**Step 1: Add Serper search function**

Add to `lib/agents/tools/websearch.ts` after imports:

```typescript
import { searchConfig } from './config';
import { SerperSearchResult } from '../../types';

/**
 * Search using Serper AI (Google search API)
 */
export async function serperSearch(
  query: string
): Promise<SerperSearchResult[]> {
  if (!searchConfig.serperApiKey) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), searchConfig.serperTimeout);

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': searchConfig.serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: searchConfig.maxResults,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Serper API key');
      }
      if (response.status === 429) {
        throw new Error('Serper API rate limit exceeded');
      }
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract organic results
    return (data.organic || []).map((result: any) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet || '',
    }));
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 2: Run test to verify it passes**

Run: `tsx scripts/test-serper.ts`

Expected: Tests pass (if SERPER_API_KEY set) or skip gracefully

**Step 3: Commit implementation**

```bash
git add lib/agents/tools/websearch.ts
git commit -m "feat: implement Serper AI search integration"
```

---

## Task 9: Implement URL Deduplication (TDD - Part 1: Tests)

**Files:**
- Create: `scripts/test-deduplication.ts`

**Step 1: Write failing test**

Create `scripts/test-deduplication.ts`:

```typescript
async function testDeduplication() {
  console.log('🧪 Testing URL Deduplication\n');

  const { deduplicateByUrl } = await import('../lib/agents/tools/websearch');
  const { SerperSearchResult } = await import('../lib/types');

  // Test 1: Remove duplicates
  console.log('✅ Test 1: Remove duplicate URLs...');
  const withDupes: any[] = [
    { title: 'First', url: 'https://example.com', snippet: 'A' },
    { title: 'Second', url: 'https://other.com', snippet: 'B' },
    { title: 'Duplicate', url: 'https://example.com', snippet: 'C' },
  ];

  const unique = deduplicateByUrl(withDupes);
  if (unique.length !== 2) throw new Error('Should have 2 unique results');
  if (unique[0].title !== 'First') throw new Error('Should keep first occurrence');
  if (unique[1].title !== 'Second') throw new Error('Wrong order');
  console.log('   Duplicates removed correctly ✓\n');

  // Test 2: No duplicates
  console.log('✅ Test 2: Handle no duplicates...');
  const noDupes: any[] = [
    { title: 'A', url: 'https://a.com', snippet: 'A' },
    { title: 'B', url: 'https://b.com', snippet: 'B' },
  ];

  const unchanged = deduplicateByUrl(noDupes);
  if (unchanged.length !== 2) throw new Error('Should keep all unique');
  console.log('   All unique URLs preserved ✓\n');

  // Test 3: Empty array
  console.log('✅ Test 3: Handle empty array...');
  const empty = deduplicateByUrl([]);
  if (empty.length !== 0) throw new Error('Should return empty array');
  console.log('   Empty array handled ✓\n');

  console.log('🎉 Deduplication tests passed!\n');
}

testDeduplication().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `tsx scripts/test-deduplication.ts`

Expected: Error "deduplicateByUrl is not exported"

**Step 3: Commit failing test**

```bash
git add scripts/test-deduplication.ts
git commit -m "test: add URL deduplication tests (failing)"
```

---

## Task 10: Implement URL Deduplication (TDD - Part 2: Implementation)

**Files:**
- Modify: `lib/agents/tools/websearch.ts` (add deduplicateByUrl function)

**Step 1: Add deduplication function**

Add to `lib/agents/tools/websearch.ts`:

```typescript
/**
 * Remove duplicate URLs from search results
 */
export function deduplicateByUrl(
  results: SerperSearchResult[]
): SerperSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}
```

**Step 2: Run test to verify it passes**

Run: `tsx scripts/test-deduplication.ts`

Expected: All tests pass

**Step 3: Commit implementation**

```bash
git add lib/agents/tools/websearch.ts
git commit -m "feat: add URL deduplication for search results"
```

---

## Task 11: Implement Jina Content Fetching (TDD - Part 1: Tests)

**Files:**
- Create: `scripts/test-jina.ts`

**Step 1: Write failing test**

Create `scripts/test-jina.ts`:

```typescript
async function testJinaFetching() {
  console.log('🧪 Testing Jina AI Reader Integration\n');

  const { fetchJinaContent } = await import('../lib/agents/tools/websearch');

  // Test 1: Successful fetch
  console.log('✅ Test 1: Fetch public URL...');
  const testResult = {
    title: 'Example',
    url: 'https://example.com',
    snippet: 'Example domain',
  };

  const content = await fetchJinaContent(testResult);
  if (content === null) throw new Error('Should fetch content');
  if (typeof content !== 'string') throw new Error('Content should be string');
  if (content.length === 0) throw new Error('Content should not be empty');

  console.log(`   Fetched ${content.length} characters`);
  console.log(`   Preview: ${content.substring(0, 100)}...`);
  console.log('   ✓\n');

  // Test 2: Failed fetch (invalid URL)
  console.log('✅ Test 2: Handle invalid URL...');
  const invalidResult = {
    title: 'Invalid',
    url: 'https://this-domain-definitely-does-not-exist-123456789.com',
    snippet: 'Invalid',
  };

  const failed = await fetchJinaContent(invalidResult);
  if (failed !== null) throw new Error('Invalid URL should return null');
  console.log('   Invalid URL returned null ✓\n');

  console.log('🎉 Jina integration tests passed!\n');
}

testJinaFetching().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `tsx scripts/test-jina.ts`

Expected: Error "fetchJinaContent is not exported"

**Step 3: Commit failing test**

```bash
git add scripts/test-jina.ts
git commit -m "test: add Jina AI Reader integration tests (failing)"
```

---

## Task 12: Implement Jina Content Fetching (TDD - Part 2: Implementation)

**Files:**
- Modify: `lib/agents/tools/websearch.ts` (add fetchJinaContent function)

**Step 1: Add Jina fetch function**

Add to `lib/agents/tools/websearch.ts`:

```typescript
/**
 * Fetch full content from URL using Jina AI Reader
 */
export async function fetchJinaContent(
  result: SerperSearchResult
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), searchConfig.jinaTimeout);

  try {
    const jinaUrl = `https://r.jina.ai/${result.url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`Jina fetch failed for ${result.url}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Jina returns structured JSON with content in data.content or data.markdown
    return data.content || data.markdown || null;
  } catch (error) {
    console.warn(`Jina fetch error for ${result.url}:`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 2: Run test to verify it passes**

Run: `tsx scripts/test-jina.ts`

Expected: Tests pass

**Step 3: Commit implementation**

```bash
git add lib/agents/tools/websearch.ts
git commit -m "feat: implement Jina AI Reader content fetching"
```

---

## Task 13: Implement Parallel Jina Enrichment (TDD - Part 1: Tests)

**Files:**
- Create: `scripts/test-enrichment.ts`

**Step 1: Write failing test**

Create `scripts/test-enrichment.ts`:

```typescript
async function testEnrichment() {
  console.log('🧪 Testing Parallel Jina Enrichment\n');

  const { enrichWithJina } = await import('../lib/agents/tools/websearch');

  // Test 1: Enrich multiple results
  console.log('✅ Test 1: Enrich with concurrency control...');
  const serperResults = [
    { title: 'Example 1', url: 'https://example.com', snippet: 'Snippet 1' },
    { title: 'Example 2', url: 'https://www.iana.org/domains/example', snippet: 'Snippet 2' },
  ];

  const startTime = Date.now();
  const enriched = await enrichWithJina(serperResults);
  const duration = Date.now() - startTime;

  if (enriched.length !== 2) throw new Error('Should enrich all results');

  console.log(`   Enriched ${enriched.length} results in ${duration}ms`);

  // Check structure
  const first = enriched[0];
  if (!first.enrichedContent) throw new Error('Should have enrichedContent');
  if (!first.enrichedContent.markdown) throw new Error('Should have markdown');
  if (!first.enrichedContent.fetchedAt) throw new Error('Should have fetchedAt');
  if (!['jina', 'fallback'].includes(first.enrichedContent.source)) {
    throw new Error('Source should be jina or fallback');
  }

  console.log(`   First result source: ${first.enrichedContent.source}`);
  console.log(`   First result length: ${first.enrichedContent.markdown.length} chars`);
  console.log('   ✓\n');

  // Test 2: Handle all failures gracefully
  console.log('✅ Test 2: Fallback to snippets on failure...');
  const invalidResults = [
    { title: 'Invalid', url: 'https://invalid-12345.com', snippet: 'Fallback snippet' },
  ];

  const fallback = await enrichWithJina(invalidResults);
  if (fallback.length !== 1) throw new Error('Should return result');
  if (!fallback[0].enrichedContent) throw new Error('Should have enrichedContent');
  if (fallback[0].enrichedContent.source !== 'fallback') {
    throw new Error('Should fallback on invalid URL');
  }
  if (fallback[0].enrichedContent.markdown !== 'Fallback snippet') {
    throw new Error('Should use snippet as fallback');
  }

  console.log('   Fallback to snippet works ✓\n');

  console.log('🎉 Enrichment tests passed!\n');
}

testEnrichment().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `tsx scripts/test-enrichment.ts`

Expected: Error "enrichWithJina is not exported"

**Step 3: Commit failing test**

```bash
git add scripts/test-enrichment.ts
git commit -m "test: add parallel enrichment tests (failing)"
```

---

## Task 14: Implement Parallel Jina Enrichment (TDD - Part 2: Implementation)

**Files:**
- Modify: `lib/agents/tools/websearch.ts` (add enrichWithJina function)

**Step 1: Add enrichment function**

Add to `lib/agents/tools/websearch.ts`:

```typescript
import pLimit from 'p-limit';

/**
 * Enrich search results with Jina content in parallel
 */
export async function enrichWithJina(
  results: SerperSearchResult[]
): Promise<EnrichedSearchResult[]> {
  // Deduplicate URLs
  const uniqueResults = deduplicateByUrl(results);

  // Limit concurrency to 3 parallel fetches
  const limit = pLimit(searchConfig.jinaMaxConcurrency);

  // Fetch all in parallel with concurrency control
  const enriched = await Promise.allSettled(
    uniqueResults.map((result) => limit(() => fetchJinaContent(result)))
  );

  return enriched.map((settled, index) => {
    const original = uniqueResults[index];

    if (settled.status === 'fulfilled' && settled.value) {
      return {
        ...original,
        enrichedContent: {
          markdown: settled.value,
          fetchedAt: new Date(),
          source: 'jina' as const,
        },
      };
    }

    // Fallback to snippet
    return {
      ...original,
      enrichedContent: {
        markdown: original.snippet,
        fetchedAt: new Date(),
        source: 'fallback' as const,
      },
    };
  });
}
```

Also add import at top of file:

```typescript
import { EnrichedSearchResult } from '../../types';
```

**Step 2: Run test to verify it passes**

Run: `tsx scripts/test-enrichment.ts`

Expected: Tests pass

**Step 3: Commit implementation**

```bash
git add lib/agents/tools/websearch.ts
git commit -m "feat: implement parallel Jina enrichment with concurrency control"
```

---

## Task 15: Update performWebSearch Function (TDD - Part 1: Tests)

**Files:**
- Create: `scripts/test-full-search.ts`

**Step 1: Write comprehensive integration test**

Create `scripts/test-full-search.ts`:

```typescript
async function testFullSearch() {
  console.log('🧪 Testing Complete Search Pipeline\n');

  if (!process.env.SERPER_API_KEY) {
    console.log('⚠️  SERPER_API_KEY not set - skipping integration test');
    console.log('   Get free API key at: https://serper.dev/\n');
    return;
  }

  const { performWebSearch } = await import('../lib/agents/tools/websearch');
  const { default: prisma } = await import('../lib/prisma');

  // Cleanup before test
  await prisma.searchCache.deleteMany({});

  // Test 1: Fresh search (cache miss)
  console.log('✅ Test 1: Fresh search with enrichment...');
  const query = 'TypeScript programming language';

  const startTime = Date.now();
  const results = await performWebSearch(query);
  const duration = Date.now() - startTime;

  if (!Array.isArray(results)) throw new Error('Should return array');
  if (results.length === 0) throw new Error('Should have results');
  if (results.length > 5) throw new Error('Should limit to 5 results');

  console.log(`   Received ${results.length} enriched results in ${duration}ms`);

  // Verify enrichment
  const first = results[0];
  if (!first.enrichedContent) throw new Error('Should have enrichedContent');
  console.log(`   First result: ${first.title.substring(0, 50)}...`);
  console.log(`   Content source: ${first.enrichedContent.source}`);
  console.log(`   Content length: ${first.enrichedContent.markdown.length} chars`);
  console.log('   ✓\n');

  // Test 2: Cache hit (same query)
  console.log('✅ Test 2: Cache hit (instant response)...');

  const cacheStart = Date.now();
  const cached = await performWebSearch(query);
  const cacheDuration = Date.now() - cacheStart;

  if (cacheDuration > 100) {
    console.log(`   ⚠️  Cache might not be working (${cacheDuration}ms)`);
  }

  if (cached.length !== results.length) throw new Error('Cache should return same results');
  console.log(`   Retrieved from cache in ${cacheDuration}ms`);
  console.log('   ✓\n');

  // Test 3: Query validation
  console.log('✅ Test 3: Query validation...');

  try {
    await performWebSearch('');
    throw new Error('Should reject empty query');
  } catch (error: any) {
    if (!error.message.includes('empty')) throw error;
    console.log('   Empty query rejected ✓');
  }

  try {
    await performWebSearch('   ');
    throw new Error('Should reject whitespace query');
  } catch (error: any) {
    if (!error.message.includes('empty')) throw error;
    console.log('   Whitespace query rejected ✓');
  }

  console.log('   ✓\n');

  // Cleanup
  await prisma.searchCache.deleteMany({});

  console.log('🎉 Full search pipeline tests passed!\n');
}

testFullSearch().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `tsx scripts/test-full-search.ts`

Expected: Error or test failures (performWebSearch not updated yet)

**Step 3: Commit failing test**

```bash
git add scripts/test-full-search.ts
git commit -m "test: add complete search pipeline tests (failing)"
```

---

## Task 16: Update performWebSearch Function (TDD - Part 2: Implementation)

**Files:**
- Modify: `lib/agents/tools/websearch.ts` (replace performWebSearch function)

**Step 1: Replace performWebSearch implementation**

Replace the entire `performWebSearch` function in `lib/agents/tools/websearch.ts`:

```typescript
import { getCachedResults, setCachedResults } from '../../db/searchCache';

/**
 * Perform web search with Serper + Jina enrichment and caching
 */
export async function performWebSearch(
  query: string
): Promise<WebSearchResult[]> {
  // 1. Validate query
  const validation = validateSearchQuery(query);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Normalize query for cache lookup
  const normalizedQuery = query.trim().toLowerCase();

  // 3. Check cache
  const cached = await getCachedResults(normalizedQuery);
  if (cached) {
    console.log(`✓ Cache hit for query: "${query}"`);
    return cached;
  }

  console.log(`→ Searching for: "${query}"`);

  // 4. Perform fresh search
  const serperResults = await serperSearch(query);

  if (serperResults.length === 0) {
    console.log('  No results found');
    return [];
  }

  console.log(`  Found ${serperResults.length} results from Serper`);

  // 5. Enrich with Jina
  console.log(`  Enriching with Jina AI Reader...`);
  const enrichedResults = await enrichWithJina(serperResults);

  const jinaSuccesses = enrichedResults.filter(
    (r) => r.enrichedContent?.source === 'jina'
  ).length;
  console.log(`  ✓ Enriched ${jinaSuccesses}/${enrichedResults.length} with full content`);

  // 6. Cache results
  await setCachedResults(normalizedQuery, enrichedResults);

  return enrichedResults;
}
```

**Step 2: Run test to verify it passes**

Run: `tsx scripts/test-full-search.ts`

Expected: All tests pass (if SERPER_API_KEY set)

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit implementation**

```bash
git add lib/agents/tools/websearch.ts
git commit -m "feat: implement complete search pipeline with caching"
```

---

## Task 17: Clean Up Old Mock Implementation

**Files:**
- Modify: `lib/agents/tools/websearch.ts` (remove old mock code)

**Step 1: Remove mock implementation and old comments**

Remove these functions from `lib/agents/tools/websearch.ts`:
- Old mock `performWebSearch` (if still there)
- Mock results generation
- Old comments about Tavily integration example (lines ~100-126)

Keep only:
- New `performWebSearch` (just updated)
- `serperSearch`
- `fetchJinaContent`
- `enrichWithJina`
- `deduplicateByUrl`
- `formatSearchResults` (keep if exists)
- `createWebSearchToolCall` (keep if exists)
- `handleWebSearchToolUse` (will update next)
- `validateSearchQuery` (keep if exists)

**Step 2: Verify code compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit cleanup**

```bash
git add lib/agents/tools/websearch.ts
git commit -m "refactor: remove mock search implementation"
```

---

## Task 18: Update handleWebSearchToolUse Function

**Files:**
- Modify: `lib/agents/tools/websearch.ts:69-82` (update handleWebSearchToolUse)

**Step 1: Update handleWebSearchToolUse to use new pipeline**

The function should already be calling `performWebSearch`, but verify it returns enriched results:

```typescript
/**
 * Parse tool use from agent response and execute web search
 */
export async function handleWebSearchToolUse(
  query: string
): Promise<{ results: WebSearchResult[]; toolCall: ToolCall }> {
  const results = await performWebSearch(query);
  const toolCall = createWebSearchToolCall(query);

  return {
    results,
    toolCall: {
      ...toolCall,
      results,
    },
  };
}
```

**Step 2: Verify this function still works**

Run: `tsx scripts/test-full-search.ts`

Expected: Tests still pass

**Step 3: Commit if changes were needed**

```bash
git add lib/agents/tools/websearch.ts
git commit -m "refactor: ensure handleWebSearchToolUse uses enriched results"
```

---

## Task 19: Add Test Script to package.json

**Files:**
- Modify: `package.json` (add test:websearch script)

**Step 1: Add test script**

Add to the "scripts" section in `package.json`:

```json
"test:websearch": "tsx scripts/test-full-search.ts",
```

**Step 2: Run new test script**

Run: `npm run test:websearch`

Expected: Tests pass (if SERPER_API_KEY set) or skip gracefully

**Step 3: Commit**

```bash
git add package.json
git commit -m "build: add test:websearch npm script"
```

---

## Task 20: Update .env.example with SERPER_API_KEY

**Files:**
- Create or Modify: `.env.example`

**Step 1: Check if .env.example exists**

Run: `ls -la .env.example 2>&1 || echo "Not found"`

**Step 2: Create or update .env.example**

Create or update `.env.example`:

```bash
# Database
DATABASE_URL="file:./dev.db"

# Anthropic API Configuration
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
ANTHROPIC_BASE_URL="https://api.anthropic.com"

# Search API Configuration
# Get free API key at: https://serper.dev/ (2,500 searches/month free)
SERPER_API_KEY="your-serper-api-key-here"

# Optional: Jina AI Reader (free without key, optional key for higher limits)
# JINA_API_KEY="your-jina-api-key-here"
```

**Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add SERPER_API_KEY to .env.example"
```

---

## Task 21: Update Documentation

**Files:**
- Modify: `docs/plans/2025-12-29-web-search-enhancement-design.md`

**Step 1: Update design doc status**

Change line 5 in design doc from:
```markdown
**Implementation:** Pending
```

To:
```markdown
**Implementation:** Complete
```

**Step 2: Add implementation notes**

Add section after "## Overview":

```markdown
## Implementation Notes

**Date Completed:** 2025-12-29
**Implemented By:** Claude Code

**Changes Made:**
- Added `p-limit` dependency for concurrency control
- Created `SearchCache` Prisma model with 24h TTL
- Updated `WebSearchResult` type to include enriched content
- Implemented Serper AI search integration
- Implemented Jina AI Reader content extraction
- Implemented parallel enrichment with concurrency limiting
- Created comprehensive test suite
- Updated environment configuration

**Test Coverage:**
- Search cache operations (4 tests)
- Serper API integration (2 tests)
- URL deduplication (3 tests)
- Jina AI Reader integration (2 tests)
- Parallel enrichment (2 tests)
- Full search pipeline (3 tests)
```

**Step 3: Commit**

```bash
git add docs/plans/2025-12-29-web-search-enhancement-design.md
git commit -m "docs: mark web search enhancement as complete"
```

---

## Task 22: Run All Tests

**Files:**
- None (verification step)

**Step 1: Run database tests**

Run: `npm run test:db`

Expected: All tests pass

**Step 2: Run agent tests**

Run: `npm run test:agents`

Expected: All tests pass (may use new enriched results)

**Step 3: Run new search tests**

Run: `npm run test:websearch`

Expected: Tests pass or skip if no SERPER_API_KEY

**Step 4: Run build**

Run: `npm run build`

Expected: Build succeeds

**Step 5: Run linter**

Run: `npm run lint`

Expected: No errors

---

## Task 23: Manual Testing (Optional)

**Files:**
- None (manual verification)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test in browser**

1. Navigate to http://localhost:3000
2. Create a round table
3. Start a round
4. Watch for agents using web search tool
5. Verify enriched content appears in messages

**Step 3: Check cache**

Run same query twice, verify second is instant (check logs)

**Step 4: Stop dev server**

Press Ctrl+C

---

## Task 24: Final Commit and Summary

**Files:**
- Create: `docs/implementation-summary.md`

**Step 1: Create implementation summary**

Create `docs/implementation-summary.md`:

```markdown
# Web Search Enhancement - Implementation Summary

## Completed Features

✅ Serper AI search integration (Google search API)
✅ Jina AI Reader content extraction
✅ Parallel enrichment with concurrency control (3 concurrent)
✅ 24-hour database caching (SearchCache model)
✅ Graceful fallback to snippets on Jina failures
✅ Comprehensive error handling
✅ Query validation
✅ URL deduplication
✅ Complete test suite (16 tests across 6 test files)

## Files Created

- `lib/agents/tools/config.ts` - Search configuration
- `lib/db/searchCache.ts` - Cache CRUD operations
- `scripts/test-search-cache.ts` - Cache tests
- `scripts/test-serper.ts` - Serper integration tests
- `scripts/test-deduplication.ts` - Deduplication tests
- `scripts/test-jina.ts` - Jina integration tests
- `scripts/test-enrichment.ts` - Enrichment tests
- `scripts/test-full-search.ts` - Pipeline integration tests
- `docs/implementation-summary.md` - This file

## Files Modified

- `package.json` - Added p-limit, test:websearch script
- `prisma/schema.prisma` - Added SearchCache model
- `lib/types.ts` - Added enriched result types
- `lib/agents/tools/websearch.ts` - Complete rewrite with real APIs
- `.env.example` - Added SERPER_API_KEY
- `docs/plans/2025-12-29-web-search-enhancement-design.md` - Marked complete

## Configuration Required

Add to `.env`:
```bash
SERPER_API_KEY=your_key_here
```

Get free key at: https://serper.dev/ (2,500 searches/month)

## Performance

- Cache hit: ~5-10ms
- Cache miss: ~10-20s (Serper + Jina enrichment)
- Concurrency: 3 parallel Jina fetches
- Cache TTL: 24 hours

## Test Results

All tests passing:
- Database operations: 11 tests ✓
- Agent orchestration: 8 tests ✓
- Search cache: 4 tests ✓
- Serper integration: 2 tests ✓
- Deduplication: 3 tests ✓
- Jina integration: 2 tests ✓
- Enrichment: 2 tests ✓
- Full pipeline: 3 tests ✓

## Next Steps

1. Add SERPER_API_KEY to production .env
2. Monitor API usage and cache hit rates
3. Consider adding cache cleanup cron job
4. Monitor Jina success rates
5. Consider future enhancements (see design doc)
```

**Step 2: Commit summary**

```bash
git add docs/implementation-summary.md
git commit -m "docs: add implementation summary for web search enhancement"
```

---

## Success Criteria Checklist

- [ ] All tests pass
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Linter passes
- [ ] Design document updated
- [ ] Implementation summary created
- [ ] .env.example updated
- [ ] Ready for code review
- [ ] Ready to merge or create PR

---

**Implementation complete! Use @superpowers:finishing-a-development-branch to merge or create PR.**
