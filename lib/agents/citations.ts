// Type definitions for URL citations

export interface Citation {
    url: string;
    title: string;
    usedInContext?: boolean;
}

/**
 * Extract URLs mentioned in agent response text
 * Matches both sourceURLs from search results and inline URLs
 */
export function extractCitations(content: string, searchResults?: any[]): Citation[] {
    const citations: Citation[] = [];
    const seenUrls = new Set<string>();

    // Extract from search results if available
    if (searchResults && Array.isArray(searchResults)) {
        for (const result of searchResults) {
            if (result.url && !seenUrls.has(result.url)) {
                citations.push({
                    url: result.url,
                    title: result.title || 'Web Source',
                    usedInContext: true,
                });
                seenUrls.add(result.url);
            }
        }
    }

    // Extract inline URLs from content (basic URL pattern matching)
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const matches = content.match(urlPattern);

    if (matches) {
        for (const url of matches) {
            if (!seenUrls.has(url)) {
                citations.push({
                    url,
                    title: 'Referenced URL',
                    usedInContext: true,
                });
                seenUrls.add(url);
            }
        }
    }

    return citations;
}
