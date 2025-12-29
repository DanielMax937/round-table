# Web Search Tool Enhancement Design

**Date:** 2025-12-29
**Status:** Design Approved
**Implementation:** Pending

## Overview

Upgrade the web search tool from mock implementation to production-ready search using Serper AI for discovery and Jina AI Reader for deep content extraction. Results will be cached in the database for 24 hours to reduce API costs and improve response times.

## Goals

1. **Real Search**: Replace mock implementation with Serper AI (Google search API)
2. **Deep Content**: Enrich search results with full markdown content via Jina AI Reader
3. **Resilience**: Graceful fallback when content extraction fails
4. **Performance**: Cache results persistently for 24 hours
5. **Cost Efficiency**: Minimize API calls through intelligent caching

## Architecture

### Two-Tier Enhancement Pipeline

```
User Query
  ↓
Check Cache (24h TTL)
  ↓ (cache miss)
Serper Search (5 results, 15s timeout)
  ↓
Parallel Jina Enrichment (concurrency: 3, 8s timeout each)
  ↓
  For each URL:
    Success → Full markdown content
    Failure → Fallback to Serper snippet
  ↓
Store in Database Cache
  ↓
Return Enriched Results
```

### Components

1. **Discovery Layer** - Serper AI provides fast Google search results (titles, URLs, snippets)
2. **Content Layer** - Jina AI Reader extracts full page content as clean markdown
3. **Cache Layer** - SQLite database stores enriched results for 24 hours
4. **Fallback Strategy** - Individual URL failures don't break the entire search

## Data Structures

### Type Definitions

**lib/types.ts:**

```typescript
// Basic result from Serper
interface SerperSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Enriched result with Jina content
interface EnrichedSearchResult {
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
export type WebSearchResult = EnrichedSearchResult;
```

### Database Schema

**prisma/schema.prisma:**

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

### Configuration

**lib/agents/tools/config.ts:**

```typescript
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
  console.warn('SERPER_API_KEY not set - web search will fail');
}
```

## Implementation Functions

### Main Entry Point

**lib/agents/tools/websearch.ts:**

```typescript
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
    return cached;
  }

  // 4. Perform fresh search
  const serperResults = await serperSearch(query);

  // 5. Enrich with Jina
  const enrichedResults = await enrichWithJina(serperResults);

  // 6. Cache results
  await setCachedResults(normalizedQuery, enrichedResults);

  return enrichedResults;
}
```

### Serper Integration

```typescript
async function serperSearch(
  query: string
): Promise<SerperSearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), searchConfig.serperTimeout);

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': searchConfig.serperApiKey!,
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

### Jina Enrichment

```typescript
import pLimit from 'p-limit';

async function enrichWithJina(
  results: SerperSearchResult[]
): Promise<EnrichedSearchResult[]> {
  // Deduplicate URLs
  const uniqueResults = deduplicateByUrl(results);

  // Limit concurrency to 3 parallel fetches
  const limit = pLimit(searchConfig.jinaMaxConcurrency);

  // Fetch all in parallel with concurrency control
  const enriched = await Promise.allSettled(
    uniqueResults.map(result =>
      limit(() => fetchJinaContent(result))
    )
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

async function fetchJinaContent(result: SerperSearchResult): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), searchConfig.jinaTimeout);

  try {
    const jinaUrl = `https://r.jina.ai/${result.url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
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

function deduplicateByUrl(results: SerperSearchResult[]): SerperSearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}
```

### Cache Operations

**lib/db/searchCache.ts:**

```typescript
import prisma from '../prisma';
import { WebSearchResult } from '../types';
import { searchConfig } from '../agents/tools/config';

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

## Error Handling

### Serper API Failures

| Error | Response |
|-------|----------|
| Network errors | Retry once with 1s backoff, then throw error |
| Rate limiting (429) | Throw error: "Search rate limit exceeded. Please try again later." |
| Invalid API key (401) | Throw error: "Invalid Serper API key configuration" |
| No results | Return empty array (valid response) |
| Timeout | Throw error: "Search request timed out" |

### Jina Fetch Failures (Per URL)

| Error | Response |
|-------|----------|
| Timeout (8s) | Fallback to Serper snippet, mark source='fallback' |
| 404/403/5xx | Fallback to snippet, log warning |
| Network errors | Fallback to snippet |
| Invalid response | Fallback to snippet |
| All 5 fetches fail | Return results with snippets only |

**Critical:** Individual URL failures never fail the entire search.

### Cache Failures

| Error | Response |
|-------|----------|
| Database connection error | Log warning, continue without cache |
| Cache read fails | Perform fresh search |
| Cache write fails | Log error, return results anyway |

### Query Validation

| Issue | Response |
|-------|---------|
| Empty/whitespace | Throw error: "Search query cannot be empty" |
| Query > 500 chars | Truncate to 500, log warning |
| Special characters | URL-encode properly for both APIs |

## Environment Variables

**.env:**

```bash
# Required for search functionality
SERPER_API_KEY=your_serper_api_key_here

# Optional - Jina Reader is free without key
# Higher rate limits available with key if needed
# JINA_API_KEY=your_jina_api_key_here
```

**Getting API Keys:**

- **Serper AI**: https://serper.dev/ (Free tier: 2,500 searches/month)
- **Jina AI**: https://jina.ai/ (Free without key, optional key for higher limits)

## Integration Points

### No Changes Needed

1. **lib/agents/executor.ts** - Already calls `handleWebSearchToolUse()`
2. **API routes** - SSE streaming already handles tool calls
3. **Agent system** - Tool is already integrated

### New Files

1. **lib/db/searchCache.ts** - Cache CRUD operations
2. **lib/agents/tools/config.ts** - Search configuration

### Modified Files

1. **lib/agents/tools/websearch.ts** - Replace entire implementation
2. **lib/types.ts** - Update WebSearchResult type
3. **prisma/schema.prisma** - Add SearchCache model

### Dependencies to Add

```bash
npm install p-limit
```

**Note:** No SDKs needed - both APIs use simple fetch() calls

## Testing Strategy

### Unit Tests

**scripts/test-websearch.ts:**

```typescript
// Test with mocked fetch
- validateSearchQuery()
- deduplicateByUrl()
- Cache expiration logic
- Fallback behavior
```

### Integration Tests

```typescript
// Requires SERPER_API_KEY
- Real Serper search
- Real Jina enrichment
- Cache hit/miss scenarios
- Concurrency limiting
- Error scenarios (with mock failures)
```

### Manual Testing

```bash
# Test search with enrichment
npm run test:agents

# Verify cache behavior
# Run same query twice, second should be instant

# Test fallback
# Use URLs that fail to load, verify snippet fallback
```

## Performance Characteristics

### Timing

- **Cache hit**: ~5-10ms (database read)
- **Cache miss**:
  - Serper search: ~500-1500ms
  - Jina enrichment (3 parallel batches): ~8-16s
  - **Total**: ~10-20s for fresh search

### Cost

**With 24h cache:**
- 100 unique queries/day = 100 Serper calls
- Cache hit rate ~30-50% on day 2+
- Monthly: ~2,000-3,000 Serper calls (within free tier)

**Without cache:**
- Same 100 queries repeated 5x/day = 500 Serper calls
- Would exceed free tier quickly

## Migration Steps

1. **Add dependency**: `npm install p-limit`
2. **Update Prisma schema**: Add SearchCache model
3. **Run migration**: `npx prisma migrate dev --name add-search-cache`
4. **Add SERPER_API_KEY** to .env
5. **Create new files**: searchCache.ts, config.ts
6. **Update existing files**: websearch.ts, types.ts
7. **Test**: Run integration tests
8. **Deploy**: Restart with new env vars

## Future Enhancements

**Not in initial scope, consider later:**

- Image search results
- News-specific search mode
- Custom cache TTL per query type
- Search result analytics
- Retry queue for failed Jina fetches
- Streaming enrichment (show Serper results, then enrich)

## Success Criteria

- [ ] Agents receive real search results from Serper
- [ ] 5 results enriched with full markdown content
- [ ] Individual URL failures don't break search
- [ ] Cache reduces duplicate API calls
- [ ] 24-hour TTL reduces costs
- [ ] All tests pass
- [ ] Error messages are clear and actionable
- [ ] Performance acceptable (<20s for fresh search)
