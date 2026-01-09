/**
 * Read page tool for fetching and converting Tenable documentation pages to Markdown
 */

import { URL } from 'url';
import {
  ReadPageInput,
  ReadPageOutput,
  ValidationError,
  NetworkError,
  ScrapingError,
  ConversionError,
} from '../types.js';
import {
  downloadHTML,
  cleanHTMLPreservingCodeBlocks,
  extractTitle,
  extractMetadata,
} from '../utils/scraper.js';
import {
  htmlToMarkdownWithStats,
  cleanMarkdown,
} from '../utils/converter.js';
import {
  LRUCache,
  createCacheKey,
} from '../utils/cache.js';

/**
 * Allowed domains for the read_page tool
 * This restricts the tool to only fetch from trusted Tenable documentation sites
 */
const ALLOWED_DOMAINS = [
  'developer.tenable.com',
  'tenable.com',
];

/**
 * Page content cache (LRU with 24h TTL, max 100 entries)
 */
const pageCache = new LRUCache<ReadPageOutput>({
  maxSize: 100,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
});

/**
 * Validate URL input
 * @param url - URL to validate
 * @throws ValidationError if URL is invalid
 */
function validateUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL must be a non-empty string');
  }
  
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    throw new ValidationError('URL cannot be empty');
  }
  
  try {
    const parsedUrl = new URL(trimmedUrl);
    
    // Check protocol
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new ValidationError('URL must use HTTP or HTTPS protocol');
    }
    
    // Check domain
    const domain = parsedUrl.hostname.toLowerCase();
    const isAllowed = ALLOWED_DOMAINS.some(allowedDomain => 
      domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
    );
    
    if (!isAllowed) {
      throw new ValidationError(
        `URL domain "${domain}" is not allowed. Only Tenable documentation domains are permitted: ${ALLOWED_DOMAINS.join(', ')}`
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid URL format');
  }
}

/**
 * Read a Tenable documentation page and convert it to Markdown
 * 
 * This function:
 * 1. Validates the URL to ensure it's from a trusted Tenable domain
 * 2. Checks cache for existing content
 * 3. Downloads the HTML content
 * 4. Cleans the HTML by removing navigation, sidebars, etc.
 * 5. Preserves code blocks during cleaning
 * 6. Converts the cleaned HTML to Markdown
 * 7. Returns the Markdown with metadata
 * 
 * @param input - Read page input with URL
 * @returns Read page output with Markdown content and metadata
 * @throws ValidationError if URL is invalid
 * @throws NetworkError if downloading fails
 * @throws ScrapingError if cleaning fails
 * @throws ConversionError if Markdown conversion fails
 */
export async function readPage(input: ReadPageInput): Promise<ReadPageOutput> {
  try {
    // Validate input
    validateUrl(input.url);
    
    const url = input.url.trim();
    const cacheKey = createCacheKey(url);

    // Check cache first
    const cachedResult = pageCache.get(cacheKey);
    if (cachedResult) {
      console.error(`Cache hit for ${url}`);
      return cachedResult;
    }

    // Download HTML
    const htmlContent = await downloadHTML(url);

    // Handle 404 with fallbacks
    if (htmlContent.statusCode === 404) {
      const fallback = await handle404Fallback(url);
      if (fallback) {
        pageCache.set(cacheKey, fallback);
        return fallback;
      }
      throw new NetworkError(
        `Failed to download page: HTTP 404`,
        { url, statusCode: htmlContent.statusCode }
      );
    }

    if (htmlContent.statusCode >= 400) {
      throw new NetworkError(
        `Failed to download page: HTTP ${htmlContent.statusCode}`,
        { url, statusCode: htmlContent.statusCode }
      );
    }

    // Extract title and metadata before cleaning
    const title = extractTitle(htmlContent.html) || 'Untitled Document';

    // Clean HTML while preserving code blocks
    const cleanedHtml = cleanHTMLPreservingCodeBlocks(htmlContent.html);

    // Convert HTML to Markdown
    const { markdown, wordCount } = htmlToMarkdownWithStats(cleanedHtml);

    // Clean up the Markdown
    const finalMarkdown = cleanMarkdown(markdown);

    const result: ReadPageOutput = {
      url: htmlContent.url,
      title,
      content: finalMarkdown,
      wordCount,
    };

    // Cache the result
    pageCache.set(cacheKey, result);

    return result;
  } catch (error) {
    // Re-throw known error types
    if (
      error instanceof ValidationError ||
      error instanceof NetworkError ||
      error instanceof ScrapingError ||
      error instanceof ConversionError
    ) {
      throw error;
    }

    // Wrap unknown errors
    throw new ScrapingError(
      `Failed to read page at ${input.url}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Read a Tenable documentation page with custom options
 * 
 * @param input - Read page input with URL
 * @param options - Optional read options
 * @returns Read page output with Markdown content and metadata
 */
export async function readPageWithOptions(
  input: ReadPageInput,
  options: {
    timeout?: number;
    maxContentLength?: number;
  } = {}
): Promise<ReadPageOutput> {
  const { timeout, maxContentLength } = options;
  
  try {
    // Validate URL
    validateUrl(input.url);
    
    const url = input.url.trim();
    
    // Download HTML with custom options
    const htmlContent = await downloadHTML(url, { timeout });
    
    if (htmlContent.statusCode >= 400) {
      throw new NetworkError(
        `Failed to download page: HTTP ${htmlContent.statusCode}`,
        { url, statusCode: htmlContent.statusCode }
      );
    }
    
    // Check content length if specified
    if (maxContentLength && htmlContent.html.length > maxContentLength) {
      throw new ScrapingError(
        `Page content exceeds maximum length of ${maxContentLength} characters`,
        { url, actualLength: htmlContent.html.length, maxLength: maxContentLength }
      );
    }
    
    // Extract title and metadata
    const title = extractTitle(htmlContent.html) || 'Untitled Document';
    
    // Clean HTML while preserving code blocks
    const cleanedHtml = cleanHTMLPreservingCodeBlocks(htmlContent.html);
    
    // Convert HTML to Markdown
    const { markdown, wordCount } = htmlToMarkdownWithStats(cleanedHtml);
    
    // Clean up the Markdown
    const finalMarkdown = cleanMarkdown(markdown);
    
    return {
      url: htmlContent.url,
      title,
      content: finalMarkdown,
      wordCount,
    };
  } catch (error) {
    // Re-throw known error types
    if (
      error instanceof ValidationError ||
      error instanceof NetworkError ||
      error instanceof ScrapingError ||
      error instanceof ConversionError
    ) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new ScrapingError(
      `Failed to read page at ${input.url}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Read multiple pages in parallel
 * 
 * @param inputs - Array of read page inputs
 * @returns Array of read page outputs
 */
export async function readMultiplePages(
  inputs: ReadPageInput[]
): Promise<ReadPageOutput[]> {
  const promises = inputs.map(input => readPage(input));
  return Promise.all(promises);
}

/**
 * Get a summary of a page without full content
 * 
 * @param input - Read page input with URL
 * @returns Page summary with title and metadata
 */
export async function getPageSummary(input: ReadPageInput): Promise<{
  url: string;
  title: string;
  description: string | null;
}> {
  try {
    // Validate URL
    validateUrl(input.url);
    
    const url = input.url.trim();
    
    // Download HTML
    const htmlContent = await downloadHTML(url);
    
    if (htmlContent.statusCode >= 400) {
      throw new NetworkError(
        `Failed to download page: HTTP ${htmlContent.statusCode}`,
        { url, statusCode: htmlContent.statusCode }
      );
    }
    
    // Extract metadata
    const title = extractTitle(htmlContent.html) || 'Untitled Document';
    const metadata = extractMetadata(htmlContent.html);
    
    return {
      url: htmlContent.url,
      title,
      description: metadata.description,
    };
  } catch (error) {
    // Re-throw known error types
    if (
      error instanceof ValidationError ||
      error instanceof NetworkError
    ) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new ScrapingError(
      `Failed to get page summary for ${input.url}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Handle 404 errors by providing fallback content
 * @param url - URL that returned 404
 * @returns Fallback page content or null if no fallback available
 */
async function handle404Fallback(url: string): Promise<ReadPageOutput | null> {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

    // Try to determine category from URL
    if (pathParts[0] === 'reference') {
      // Try the base reference page
      const fallbackUrl = 'https://developer.tenable.com/reference';

      try {
        const htmlContent = await downloadHTML(fallbackUrl);

        if (htmlContent.statusCode === 200) {
          const title = extractTitle(htmlContent.html) || 'Tenable API Reference';
          const cleanedHtml = cleanHTMLPreservingCodeBlocks(htmlContent.html);
          const { markdown, wordCount } = htmlToMarkdownWithStats(cleanedHtml);
          const finalMarkdown = cleanMarkdown(markdown);

          const note = `\n> **Note**: The requested page (${url}) was not found. Below is the main API reference page. Please search for the specific endpoint or feature you're looking for.\n`;

          return {
            url: fallbackUrl,
            title,
            content: note + finalMarkdown,
            wordCount,
          };
        }
      } catch (error) {
        // Fallback to error message
      }
    }

    // If no specific fallback, return a helpful error page
    return {
      url,
      title: 'Page Not Found',
      content: `# Page Not Found

The requested page could not be found: ${url}

## Suggested Actions:

1. **Browse the API Reference**: Visit [https://developer.tenable.com/reference](https://developer.tenable.com/reference) to find available endpoints
2. **Use the Search**: Use the \`search_docs\` tool to find relevant documentation
3. **Try API Explorer**: Visit [https://developer.tenable.com/api-explorer](https://developer.tenable.com/api-explorer) for interactive API exploration
4. **Check Recipes**: Visit [https://developer.tenable.com/recipes](https://developer.tenable.com/recipes) for integration examples

## Common Endpoints:

- **Users**: \`/users\` - Manage user accounts
- **Scans**: \`/scans\` - Launch and manage vulnerability scans
- **Assets**: \`/assets\` - Manage asset data
- **Policies**: \`/policies\` - Configure scan policies
- **Targets**: \`/target-groups\` - Manage scan targets

If you believe this is an error, please contact Tenable support.`,
      wordCount: 0,
    };
  } catch (error) {
    return null;
  }
}
