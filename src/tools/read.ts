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

/**
 * Allowed domains for the read_page tool
 * This restricts the tool to only fetch from trusted Tenable documentation sites
 */
const ALLOWED_DOMAINS = [
  'developer.tenable.com',
  'tenable.com',
];

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
 * 2. Downloads the HTML content
 * 3. Cleans the HTML by removing navigation, sidebars, etc.
 * 4. Preserves code blocks during cleaning
 * 5. Converts the cleaned HTML to Markdown
 * 6. Returns the Markdown with metadata
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
    
    // Download HTML
    const htmlContent = await downloadHTML(url);
    
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
