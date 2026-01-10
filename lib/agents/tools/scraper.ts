
import { chromium } from 'playwright';
import pLimit from 'p-limit';
import { searchConfig } from './config';

interface ScrapedContent {
    url: string;
    markdown: string;
    title: string;
}

/**
 * Scrape multiple URLs in parallel using Playwright
 */
export async function scrapeUrls(urls: string[]): Promise<ScrapedContent[]> {
    console.log(`🌐 Starting Playwright scrape for ${urls.length} URLs...`);

    // Launch browser
    const browser = await chromium.launch({ headless: true });

    const limit = pLimit(searchConfig.playwrightMaxConcurrency);

    try {
        const results = await Promise.allSettled(
            urls.map((url) => limit(async () => {
                const page = await browser.newPage();
                try {
                    // Set timeouts
                    page.setDefaultTimeout(15000); // 15s timeout
                    page.setDefaultNavigationTimeout(15000);

                    await page.goto(url, { waitUntil: 'domcontentloaded' });

                    // Extract basic content mainly text
                    // Using a simple extraction script for reliability
                    const data = await page.evaluate(() => {
                        // Very simple text extraction
                        // Removing scripts, styles to clean up
                        const clone = document.body.cloneNode(true) as HTMLElement;
                        const scripts = clone.querySelectorAll('script, style, noscript, iframe, link, svg');
                        scripts.forEach(s => s.remove());

                        // Get text
                        let text = clone.innerText || '';
                        // Basic cleanup of multiple newlines
                        text = text.replace(/\n\s*\n/g, '\n\n').trim();

                        return {
                            title: document.title,
                            text: text
                        };
                    });

                    return {
                        url,
                        title: data.title,
                        markdown: data.text // It's plain text, but treating as markdown context
                    };
                } catch (err: any) {
                    console.warn(`Failed to scrape ${url}: ${err.message}`);
                    throw err;
                } finally {
                    await page.close();
                }
            }))
        );

        // Filter successful results
        const ScrapedContent: ScrapedContent[] = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                ScrapedContent.push(result.value);
            } else {
                // Fallback for failed scrapes? 
                // We just omit them or could return null content
            }
        });

        return ScrapedContent;

    } finally {
        await browser.close();
    }
}
