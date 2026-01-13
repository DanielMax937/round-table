/**
 * Web search tool for agents
 * Integrates Serper AI (search discovery) and Jina AI Reader (content enrichment)
 */

import pLimit from 'p-limit';
import {
  WebSearchResult,
  SerperSearchResult,
  EnrichedSearchResult,
  ToolCall,
} from '../../types';
import { searchConfig } from './config';
import { getCachedResults, setCachedResults } from '../../db/searchCache';
import { scrapeUrls } from './scraper';

/**
 * Perform a web search with enrichment
 * Main entry point for agent web search tool
 */
export async function performWebSearch(
  query: string
): Promise<WebSearchResult[]> {
  // 1. Validate query
  const validation = validateSearchQuery(query);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Normalize query for cache lookup (lowercase, trimmed)
  const normalizedQuery = query.trim().toLowerCase();

  // 3. Check cache first (24-hour TTL)
  const cached = await getCachedResults(normalizedQuery);
  if (cached) {
    console.log(`✅ Cache hit for query: "${query}"`);
    return cached;
  }

  console.log(`🔍 Cache miss, performing fresh search for: "${query}"`);

  // 4. Perform Serper search
  const serperResults = await serperSearch(query);

  if (serperResults.length === 0) {
    console.log(`⚠️  No results found for query: "${query}"`);
    return [];
  }

  let enrichedResults: EnrichedSearchResult[];

  // CHECK: Use Playwright Scraper if enabled
  if (searchConfig.usePlaywrightScraper) {
    console.log('🎭 Using Playwright Scraper for enrichment (Top 20 max)');
    // Take top 20
    const topResults = serperResults.slice(0, 20);
    const topUrls = topResults.map(r => r.url);

    // Scrape URLs in parallel
    const scrapedData = await scrapeUrls(topUrls);

    // Map back to EnrichedSearchResult
    enrichedResults = topResults.map(result => {
      const scraped = scrapedData.find(s => s.url === result.url);
      if (scraped) {
        return {
          ...result,
          enrichedContent: {
            markdown: scraped.markdown,
            fetchedAt: new Date(),
            source: 'scraper'
          }
        };
      }
      return {
        ...result,
        enrichedContent: {
          markdown: result.snippet, // Fallback to snippet
          fetchedAt: new Date(),
          source: 'fallback'
        }
      };
    });

  } else {
    // 5. Enrich results with Jina AI Reader (Default)
    enrichedResults = await enrichWithJina(serperResults);
  }

  // 6. Cache results for future use
  await setCachedResults(normalizedQuery, enrichedResults);

  return enrichedResults;
}

/**
 * Search using Serper AI (Google Search API)
 */
async function serperSearch(query: string): Promise<SerperSearchResult[]> {
  if (!searchConfig.serperApiKey) {
    console.warn('⚠️  SERPER_API_KEY not configured. No search results available.');
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    searchConfig.serperTimeout
  );

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
        throw new Error(
          'Invalid Serper API key. Check your SERPER_API_KEY environment variable.'
        );
      }
      if (response.status === 429) {
        throw new Error(
          'Serper API rate limit exceeded. Please try again later.'
        );
      }
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract organic search results
    const organic = data.organic || [];
    return organic.map((result: any) => ({
      title: result.title || 'Untitled',
      url: result.link || '',
      snippet: result.snippet || '',
    }));
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Search request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Enrich search results with Jina AI Reader
 * Fetches full content for each URL in parallel with concurrency control
 */
async function enrichWithJina(
  results: SerperSearchResult[]
): Promise<EnrichedSearchResult[]> {
  // Deduplicate URLs to avoid fetching the same page multiple times
  const uniqueResults = deduplicateByUrl(results);

  console.log(
    `📚 Enriching ${uniqueResults.length} results with Jina AI Reader...`
  );

  // Limit concurrency to avoid overwhelming Jina API
  const limit = pLimit(searchConfig.jinaMaxConcurrency);

  // Fetch all URLs in parallel with concurrency control
  const enriched = await Promise.allSettled(
    uniqueResults.map((result) => limit(() => fetchJinaContent(result)))
  );

  // Combine results with enriched content
  return enriched.map((settled, index) => {
    const original = uniqueResults[index];

    if (settled.status === 'fulfilled' && settled.value) {
      // Successfully enriched
      return {
        ...original,
        enrichedContent: {
          markdown: settled.value,
          fetchedAt: new Date(),
          source: 'jina' as const,
        },
      };
    }

    // Failed to enrich - fallback to Serper snippet
    console.warn(`⚠️  Jina enrichment failed for ${original.url}, using snippet`);
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

/**
 * Fetch full content for a URL using Jina AI Reader
 */
async function fetchJinaContent(
  result: SerperSearchResult
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), searchConfig.jinaTimeout);

  try {
    // Jina Reader API: prefix URL with r.jina.ai/
    const jinaUrl = `https://r.jina.ai/${result.url}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    // Add optional features if API key is available
    if (searchConfig.jinaApiKey) {
      headers['Authorization'] = `Bearer ${searchConfig.jinaApiKey}`;
      headers['X-With-Generated-Alt'] = 'true'; // Request alt text for images (requires auth)
    }

    const response = await fetch(jinaUrl, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `Jina fetch failed for ${result.url}: HTTP ${response.status}`
      );
      return null;
    }

    const data = await response.json();

    // Jina returns content in data.content or data.data
    const content = data.content || data.data || null;

    if (!content) {
      console.warn(`Jina returned empty content for ${result.url}`);
      return null;
    }

    return content;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`Jina fetch timed out for ${result.url}`);
    } else {
      console.warn(`Jina fetch error for ${result.url}:`, error.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Deduplicate search results by URL
 */
function deduplicateByUrl(
  results: SerperSearchResult[]
): SerperSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.url)) {
      return false;
    }
    seen.add(result.url);
    return true;
  });
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string): {
  valid: boolean;
  error?: string;
} {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'Search query cannot be empty' };
  }

  if (query.length > 500) {
    // Truncate instead of rejecting
    console.warn('Search query truncated to 500 characters');
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Format search results for display in agent response
 */
export function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return 'No related URLs found. The web search returned no results. Please proceed with your existing knowledge or ask the user for more specific information.';
  }

  const formatted = results.map((result, index) => {
    let output = `**[${index + 1}] ${result.title}**\n`;

    // Show enriched content if available, otherwise snippet
    if (result.enrichedContent && (result.enrichedContent.source === 'jina' || result.enrichedContent.source === 'scraper')) {
      // Truncate very long content for readability
      const maxLength = 500;
      const content =
        result.enrichedContent.markdown.length > maxLength
          ? result.enrichedContent.markdown.substring(0, maxLength) + '...'
          : result.enrichedContent.markdown;
      output += `${content}\n`;
    } else {
      output += `${result.snippet}\n`;
    }

    output += `Source: ${result.url}\n`;

    return output;
  });

  return formatted.join('\n');
}

/**
 * Create a tool call object for web search
 */
export function createWebSearchToolCall(query: string): ToolCall {
  return {
    type: 'web_search',
    query,
    timestamp: new Date(),
  };
}

/**
 * Agent SDK compatible tool definition
 */
export const webSearchTool = {
  name: "web_search",
  description: "Search the web for current information, facts, or recent events. Use key terms only.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query terms"
      }
    },
    required: ["query"]
  },
  execute: async (args: any) => {
    console.log(`🔍 Executing web_search tool with query: "${args.query}"`);
    try {
      const results = await performWebSearch(args.query);
      return {
        content: formatSearchResults(results),
        rawResults: results // Keeping raw results for potential use
      };
    } catch (error: any) {
      console.error("Web search failed:", error);
      return { error: `Search failed: ${error.message}` };
    }
  }
};

/**
 * Execute web search and return formatted results
 * Used by the direct Anthropic SDK integration
 */
export async function executeWebSearch(query: string): Promise<{
  content: string;
  results: WebSearchResult[];
}> {
  console.log(`🔍 Executing web search: "${query}"`);
  try {
    const results = await performWebSearch(query);
    return {
      content: formatSearchResults(results),
      results,
    };
  } catch (error: any) {
    console.error("Web search failed:", error);
    return {
      content: `Search failed: ${error.message}`,
      results: [],
    };
  }
}
