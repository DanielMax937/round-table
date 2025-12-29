# Web Search Enhancement Testing

## Prerequisites

Before running tests, you need a Serper API key.

### Get Your Serper API Key

1. Go to [https://serper.dev/](https://serper.dev/)
2. Sign up for a free account
3. Copy your API key from the dashboard
4. Free tier includes **2,500 searches/month**

### Configure Environment

Add your API key to `.env`:

```bash
SERPER_API_KEY="your-actual-api-key-here"
```

Or copy from template:

```bash
cp .env.example .env
# Then edit .env and add your real API keys
```

## Running Tests

### Basic Test Suite

```bash
npm run test:websearch-enhanced
```

Or directly:

```bash
npx tsx scripts/test-websearch-enhanced.ts
```

### What Gets Tested

1. **Fresh Search** - Serper + Jina enrichment (cache miss)
2. **Cached Search** - Same query retrieves from cache (<100ms)
3. **Different Query** - Another fresh search
4. **Edge Cases** - Empty query, short query validation
5. **Cache Cleanup** - Expired entry removal

### Expected Output

```
🧪 Testing Web Search Enhancement

============================================================

📝 Test 1: Basic Search (Cache Miss)
------------------------------------------------------------
Query: "Claude AI Anthropic 2024"

🔍 Cache miss, performing fresh search for: "Claude AI Anthropic 2024"
📚 Enriching 5 results with Jina AI Reader...

✅ Search completed in ~10000-20000ms
Found 5 results

First Result:
  Title: ...
  URL: ...
  Enriched: jina
  Content Length: ~2000 chars

📝 Test 2: Same Query (Cache Hit)
------------------------------------------------------------
Query: "Claude AI Anthropic 2024"

✅ Cache hit for query: "Claude AI Anthropic 2024"

✅ Search completed in <100ms (should be <100ms)
Found 5 results
✅ Cache is working! Sub-100ms response.

...
```

### Performance Expectations

- **Fresh search**: 10-20 seconds (Serper ~1s + Jina enrichment 8-16s)
- **Cached search**: <100ms (database read)
- **Jina success rate**: 80-100% (depends on URL accessibility)

## Troubleshooting

### "SERPER_API_KEY not configured"

Add your API key to `.env` file.

### "Serper API error: 401"

Your API key is invalid. Check:
1. Copied correctly (no extra spaces)
2. Not expired
3. Account is active

### "Serper API rate limit exceeded"

You've exceeded the free tier limit (2,500 searches/month). Options:
1. Wait until next month
2. Upgrade your Serper plan
3. Cache will reduce duplicate queries

### Some Jina fetches fail

This is expected! Some websites:
- Block scrapers
- Have slow servers
- Return errors

The system gracefully falls back to Serper snippets for failed URLs.

### Cache not working

Check:
1. Database is accessible (`./dev.db`)
2. Migration has run (`npx prisma migrate dev`)
3. No database connection errors in console

## Manual Testing

You can also test manually in Node REPL:

```bash
npx tsx
```

```typescript
import { performWebSearch } from './lib/agents/tools/websearch';

// Test a search
const results = await performWebSearch('your query');
console.log(results);

// Test cache
const cached = await performWebSearch('your query'); // Should be instant
```

## Verifying Cache

Check cached queries in database:

```bash
npx prisma studio
```

Navigate to `SearchCache` table to see:
- Cached queries
- Result count
- Expiration times (24h from creation)

## Next Steps

Once tests pass:
1. Integration testing with agents
2. End-to-end testing in full round table
3. Monitor API usage in production
