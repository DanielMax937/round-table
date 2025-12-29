/**
 * Search cache operations
 * Manages 24-hour TTL cache for web search results
 */

import { prisma } from '../prisma';
import { WebSearchResult } from '../types';
import { searchConfig } from '../agents/tools/config';

/**
 * Retrieve cached search results for a query
 * @param query - Normalized search query (lowercase, trimmed)
 * @returns Cached results or null if not found/expired
 */
export async function getCachedResults(
  query: string
): Promise<WebSearchResult[] | null> {
  try {
    const cached = await prisma.searchCache.findUnique({
      where: { query },
    });

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    if (cached.expiresAt < new Date()) {
      // Delete expired entry
      await prisma.searchCache.delete({ where: { query } });
      return null;
    }

    // Return cached results (parse from JSON string)
    return JSON.parse(cached.results) as WebSearchResult[];
  } catch (error) {
    console.error('Cache read error:', error);
    // Degrade gracefully - return null to trigger fresh search
    return null;
  }
}

/**
 * Store search results in cache with 24-hour TTL
 * @param query - Normalized search query (lowercase, trimmed)
 * @param results - Enriched search results to cache
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
        results: JSON.stringify(results), // Store as JSON string
        expiresAt,
      },
      update: {
        results: JSON.stringify(results), // Store as JSON string
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Cache write error:', error);
    // Don't throw - cache failures should not break search
    // Results will still be returned to the agent
  }
}

/**
 * Clean up expired cache entries
 * Can be called periodically or on-demand
 */
export async function cleanExpiredCache(): Promise<number> {
  try {
    const result = await prisma.searchCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      console.log(`🧹 Cleaned ${result.count} expired cache entries`);
    }

    return result.count;
  } catch (error) {
    console.error('Cache cleanup error:', error);
    return 0;
  }
}
