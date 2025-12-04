const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');
const url = require('url');

const BASE_URL = 'https://developers.cloudflare.com/containers/';
const OUTPUT_DIR = 'docs/en';

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

// Helper to delay requests
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Set of visited URLs to avoid loops
const visited = new Set();

async function scrapePage(pageUrl) {
    if (visited.has(pageUrl)) return;
    visited.add(pageUrl);

    console.log(`Scraping: ${pageUrl}`);

    try {
        const response = await axios.get(pageUrl);
        const $ = cheerio.load(response.data);

        // Remove unwanted elements
        $('script').remove();
        $('style').remove();
        $('noscript').remove();
        $('[class*="breadcrumbs"]').remove(); // Remove breadcrumbs if they contain JS
        $('astro-breadcrumbs').remove(); // Specific removal based on user feedback
        $('starlight-tabs-restore').remove(); // Another one seen in the output

        // Extract main content - adjust selector based on actual site structure
        let content = $('main').html() || $('article').html() || $('.DocsContent').html();

        if (!content) {
            console.warn(`No content found for ${pageUrl}`);
            return;
        }

        // Convert to Markdown
        const markdown = turndownService.turndown(content);

        // Determine file path
        const parsedUrl = url.parse(pageUrl);
        let relativePath = parsedUrl.pathname.replace('/containers/', '');
        if (relativePath === '' || relativePath.endsWith('/')) {
            relativePath += 'index';
        }

        // Ensure extension is .md
        if (!relativePath.endsWith('.md')) {
            relativePath += '.md';
        }

        const filePath = path.join(OUTPUT_DIR, relativePath);
        const dirPath = path.dirname(filePath);

        // Create directory
        fs.mkdirSync(dirPath, { recursive: true });

        // Write file
        fs.writeFileSync(filePath, markdown);
        console.log(`Saved: ${filePath}`);

        // Find links to subpages
        const links = [];
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                // Resolve relative URLs
                const absoluteUrl = url.resolve(pageUrl, href);

                // Only follow links within the same base path
                if (absoluteUrl.startsWith(BASE_URL) && !absoluteUrl.includes('#')) {
                    links.push(absoluteUrl);
                }
            }
        });

        // Recursively scrape links
        for (const link of links) {
            await delay(500); // Be polite
            await scrapePage(link);
        }

    } catch (error) {
        console.error(`Error scraping ${pageUrl}: ${error.message}`);
    }
}

// Start scraping
(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    await scrapePage(BASE_URL);
})();
