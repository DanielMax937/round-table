/**
 * Configuration for web search tool
 * Manages Serper AI and Jina AI Reader settings
 */

export const searchConfig = {
  // Serper AI - Required for search functionality
  serperApiKey: process.env.SERPER_API_KEY,

  // Jina AI Reader - Optional API key for higher rate limits
  jinaApiKey: process.env.JINA_API_KEY,
  jinaEnabled: true,

  // Search parameters
  maxResults: 5, // Number of search results to fetch

  // Timeout settings (in milliseconds)
  serperTimeout: 15000, // 15 seconds for Serper search
  jinaTimeout: 8000, // 8 seconds per URL for Jina fetch

  // Concurrency control for Jina enrichment
  jinaMaxConcurrency: 3, // Fetch 3 URLs in parallel max

  // Playwright Scraper Configuration
  usePlaywrightScraper: process.env.USE_PLAYWRIGHT_SCRAPER === 'true',
  playwrightMaxConcurrency: 5, // Scrape 5 URLs in parallel

  // Cache TTL (24 hours in milliseconds)
  cacheTTL: 24 * 60 * 60 * 1000,
} as const;

// Validation on module load
if (!searchConfig.serperApiKey) {
  console.warn(
    '⚠️  SERPER_API_KEY not set - web search will fail. Get your key at https://serper.dev/'
  );
}

if (!searchConfig.jinaApiKey) {
  console.warn(
    '⚠️  JINA_API_KEY not set - using free tier (may have limited access). Get your key at https://jina.ai/'
  );
}
