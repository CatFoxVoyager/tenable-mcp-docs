/**
 * HTML scraping and cleaning utilities for Tenable documentation
 */

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import {
  HTMLContent,
  DownloadOptions,
  CleaningOptions,
  NetworkError,
} from '../types.js';

/**
 * Default timeout for HTTP requests (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Default user agent to use for requests
 */
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Download HTML from a URL
 * @param url - The URL to download HTML from
 * @param options - Optional download options
 * @returns HTML content with metadata
 * @throws NetworkError if the download fails
 */
export async function downloadHTML(
  url: string,
  options: DownloadOptions = {}
): Promise<HTMLContent> {
  const { timeout = DEFAULT_TIMEOUT, headers = {} } = options;

  try {
    const response = await axios.get(url, {
      timeout,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept 4xx errors
    });

    return {
      html: response.data,
      url: response.request.res.responseUrl || url,
      statusCode: response.status,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new NetworkError(
        `Failed to download HTML from ${url}: ${axiosError.message}`,
        {
          url,
          status: axiosError.response?.status,
          code: axiosError.code,
        }
      );
    }
    throw new NetworkError(`Failed to download HTML from ${url}`, { url, error });
  }
}

/**
 * Clean HTML by removing navigation, sidebars, and keeping main content
 * @param html - Raw HTML content
 * @param options - Optional cleaning options
 * @returns Cleaned HTML string
 */
export function cleanHTML(html: string, options: CleaningOptions = {}): string {
  const $ = cheerio.load(html);

  // Default selectors to remove (navigation, sidebars, headers, footers, etc.)
  const removeSelectors = [
    'nav',
    '[role="navigation"]',
    '.nav',
    '#nav',
    'aside',
    '[role="complementary"]',
    '.sidebar',
    '#sidebar',
    'header',
    'header[class*="site-"]',
    '.site-header',
    '#site-header',
    'footer',
    '.footer',
    '#footer',
    '.site-footer',
    '#site-footer',
    '.breadcrumb',
    '[class*="breadcrumb"]',
    '[id*="breadcrumb"]',
    '.menu',
    '[class*="menu"]',
    '.pagination',
    '[class*="pagination"]',
    '.search',
    '[class*="search"]',
    'script',
    'style',
    'noscript',
    'iframe',
    '.ad',
    '[class*="ad-"]',
    '[id*="ad-"]',
    '.cookie-banner',
    '[class*="cookie"]',
    '.newsletter',
    '[class*="newsletter"]',
    '.social-share',
    '[class*="social-share"]',
    'form',
    '.search-form',
    '[class*="search-form"]',
  ];

  // Default selectors to keep (main content areas)
  const keepSelectors = [
    'main',
    '[role="main"]',
    '.main-content',
    '#main-content',
    'article',
    '.content',
    '#content',
    '.documentation',
    '#documentation',
    '.docs',
    '#docs',
    '.api-docs',
    '#api-docs',
    '.article',
    '#article',
    '.kb-article',
    '#kb-article',
    '.doc-content',
    '#doc-content',
  ];

  const selectorsToRemove = options.removeSelectors || removeSelectors;
  const selectorsToKeep = options.keepSelectors || keepSelectors;

  // Remove unwanted elements
  selectorsToRemove.forEach((selector) => {
    $(selector).remove();
  });

  // Try to find and keep only the main content
  let content: cheerio.Cheerio<any> = $.root();

  for (const selector of selectorsToKeep) {
    const mainElement = $(selector).first();
    if (mainElement.length > 0) {
      content = mainElement;
      break;
    }
  }

  // Remove empty elements and clean up whitespace
  const cleanedHtml = content
    .find('*')
    .filter(function () {
      const text = $(this).text().trim();
      return text.length === 0 && $(this).children().length === 0;
    })
    .remove()
    .end()
    .html() || '';

  return cleanedHtml;
}

/**
 * Preserve code blocks during cleaning by extracting them before cleaning
 * and restoring them after
 * @param html - Raw HTML content
 * @returns Object with cleaned HTML and map of code blocks
 */
export function preserveCodeBlocks(html: string): {
  cleanedHtml: string;
  codeBlocks: Map<string, string>;
} {
  const $ = cheerio.load(html);
  const codeBlocks = new Map<string, string>();
  let placeholderIndex = 0;

  // Find all code blocks and pre elements
  const codeElements = $('pre, code[class*="language-"], code[class*="hljs"]');
  codeElements.each((_, element) => {
    const placeholder = `__CODE_BLOCK_${placeholderIndex}__`;
    const originalHtml = $.html(element);
    codeBlocks.set(placeholder, originalHtml);
    $(element).replaceWith(placeholder);
    placeholderIndex++;
  });

  return {
    cleanedHtml: $.html(),
    codeBlocks,
  };
}

/**
 * Restore code blocks by replacing placeholders with original code
 * @param html - HTML with placeholders
 * @param codeBlocks - Map of placeholders to original code blocks
 * @returns HTML with code blocks restored
 */
export function restoreCodeBlocks(
  html: string,
  codeBlocks: Map<string, string>
): string {
  let restoredHtml = html;
  codeBlocks.forEach((originalCode, placeholder) => {
    restoredHtml = restoredHtml.replace(placeholder, originalCode);
  });
  return restoredHtml;
}

/**
 * Clean HTML while preserving code blocks
 * @param html - Raw HTML content
 * @param options - Optional cleaning options
 * @returns Cleaned HTML with code blocks preserved
 */
export function cleanHTMLPreservingCodeBlocks(
  html: string,
  options: CleaningOptions = {}
): string {
  // Extract code blocks
  const { cleanedHtml: htmlWithoutCode, codeBlocks } = preserveCodeBlocks(html);

  // Clean the HTML without code blocks
  const cleanedHtml = cleanHTML(htmlWithoutCode, options);

  // Restore code blocks
  return restoreCodeBlocks(cleanedHtml, codeBlocks);
}

/**
 * Extract title from HTML
 * @param html - HTML content
 * @returns Title string or null if not found
 */
export function extractTitle(html: string): string | null {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  if (title) {
    return title;
  }

  // Try to find h1
  const h1 = $('h1').first().text().trim();
  return h1 || null;
}

/**
 * Extract metadata from HTML (description, keywords, etc.)
 * @param html - HTML content
 * @returns Object with metadata
 */
export function extractMetadata(html: string): {
  description: string | null;
  keywords: string | null;
} {
  const $ = cheerio.load(html);
  const description = $('meta[name="description"]').attr('content') || null;
  const keywords = $('meta[name="keywords"]').attr('content') || null;
  return { description, keywords };
}
