/**
 * Documentation indexer for Tenable documentation
 * This module scrapes and indexes Tenable documentation to enable real search
 */

import * as cheerio from 'cheerio';
import { downloadHTML } from './scraper.js';

/**
 * Indexed documentation entry
 */
export interface IndexedDoc {
  url: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
}

/**
 * Search index with fast lookup
 */
interface SearchIndex {
  entries: IndexedDoc[];
  keywordMap: Map<string, number[]>;
  categoryMap: Map<string, number[]>;
}

/**
 * Global index instance
 */
let _searchIndex: SearchIndex | null = null;

/**
 * Main documentation pages to index
 */
const MAIN_PAGES = [
  { url: 'https://developer.tenable.com/reference', category: 'API References' },
  { url: 'https://developer.tenable.com/recipes', category: 'Recipes' },
];

/**
 * Extract documentation links from a page
 * @param html - HTML content
 * @param category - Documentation category
 * @returns Array of indexed documentation entries
 */
function extractDocLinks(html: string, category: string): IndexedDoc[] {
  const $ = cheerio.load(html);
  const entries: IndexedDoc[] = [];

  // Find all links that appear to be documentation
  $('a[href]').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href');
    const text = $link.text().trim();

    if (!href || !text) return;

    // Build full URL
    let fullUrl: string;
    if (href.startsWith('http')) {
      fullUrl = href;
    } else if (href.startsWith('/')) {
      const baseUrl = 'https://developer.tenable.com';
      fullUrl = `${baseUrl}${href}`;
    } else {
      return; // Skip relative links without leading /
    }

    // Only include Tenable documentation URLs
    if (!fullUrl.includes('developer.tenable.com')) return;

    // Extract title from link text or nearby elements
    const title = text || $link.closest('h1, h2, h3, h4, h5, h6').first().text().trim();

    // Extract description from nearby paragraph or parent
    let description = '';
    const $parent = $link.parent();
    const $next = $link.next('p');
    if ($next.length > 0) {
      description = $next.text().trim().substring(0, 200);
    } else if ($parent.text().length > 100) {
      description = $parent.text().trim().substring(0, 200);
    }

    // Extract keywords from URL and title
    const urlKeywords = extractKeywordsFromUrl(fullUrl);
    const titleKeywords = extractKeywordsFromText(title);
    const keywords = [...new Set([...urlKeywords, ...titleKeywords])];

    entries.push({
      url: fullUrl,
      title: title || extractTitleFromUrl(fullUrl),
      description: description || 'Tenable documentation page',
      category,
      keywords,
    });
  });

  return entries;
}

/**
 * Extract keywords from URL path
 * @param url - URL string
 * @returns Array of keywords
 */
function extractKeywordsFromUrl(url: string): string[] {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname
      .replace(/\/+/g, ' ')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!path) return [];

    return path
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 2);
  } catch {
    return [];
  }
}

/**
 * Extract keywords from text
 * @param text - Text string
 * @returns Array of keywords
 */
function extractKeywordsFromText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !['and', 'the', 'for', 'with', 'api'].includes(word));
}

/**
 * Extract title from URL path
 * @param url - URL string
 * @returns Title string
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname
      .split('/')
      .filter(part => part.length > 0);

    if (pathParts.length === 0) return 'Documentation';

    const lastPart = pathParts[pathParts.length - 1];
    return lastPart
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return 'Documentation';
  }
}

/**
 * Build keyword map for fast searching
 * @param entries - Indexed documentation entries
 * @returns Map of keywords to entry indices
 */
function buildKeywordMap(entries: IndexedDoc[]): Map<string, number[]> {
  const keywordMap = new Map<string, number[]>();

  entries.forEach((entry, index) => {
    entry.keywords.forEach(keyword => {
      if (!keywordMap.has(keyword)) {
        keywordMap.set(keyword, []);
      }
      keywordMap.get(keyword)!.push(index);
    });
  });

  return keywordMap;
}

/**
 * Build category map for filtering
 * @param entries - Indexed documentation entries
 * @returns Map of categories to entry indices
 */
function buildCategoryMap(entries: IndexedDoc[]): Map<string, number[]> {
  const categoryMap = new Map<string, number[]>();

  entries.forEach((entry, index) => {
    if (!categoryMap.has(entry.category)) {
      categoryMap.set(entry.category, []);
    }
    categoryMap.get(entry.category)!.push(index);
  });

  return categoryMap;
}

/**
 * Search the index by keywords
 * @param query - Search query
 * @returns Array of search results
 */
function searchIndexInternal(query: string): IndexedDoc[] {
  if (!_searchIndex) return [];

  const keywords = extractKeywordsFromText(query);
  if (keywords.length === 0) return [];

  const scores = new Map<number, number>();

  keywords.forEach(keyword => {
    const indices = _searchIndex!.keywordMap.get(keyword);
    if (indices) {
      indices.forEach((index: number) => {
        scores.set(index, (scores.get(index) || 0) + 1);
      });
    }
  });

  // Sort by relevance score and return top results
  const results = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([index]) => _searchIndex!.entries[index]);

  return results;
}

/**
 * Build the search index by scraping documentation pages
 * @returns Search index
 */
export async function buildIndex(): Promise<SearchIndex> {
  const allEntries: IndexedDoc[] = [];

  for (const page of MAIN_PAGES) {
    try {
      const htmlContent = await downloadHTML(page.url);

      if (htmlContent.statusCode >= 400) {
        console.error(`Failed to download ${page.url}: HTTP ${htmlContent.statusCode}`);
        continue;
      }

      const entries = extractDocLinks(htmlContent.html, page.category);
      allEntries.push(...entries);

      console.error(`Indexed ${entries.length} entries from ${page.url}`);
    } catch (error) {
      console.error(`Error indexing ${page.url}:`, error);
    }
  }

  // Remove duplicates based on URL
  const uniqueEntries = Array.from(
    new Map(allEntries.map(entry => [entry.url, entry])).values()
  );

  const index: SearchIndex = {
    entries: uniqueEntries,
    keywordMap: buildKeywordMap(uniqueEntries),
    categoryMap: buildCategoryMap(uniqueEntries),
  };

  console.error(`Built index with ${uniqueEntries.length} unique entries`);

  return index;
}

/**
 * Initialize the search index
 * Should be called once at server startup
 */
export async function initializeIndex(): Promise<void> {
  if (_searchIndex) {
    return; // Already initialized
  }

  try {
    _searchIndex = await buildIndex();
  } catch (error) {
    console.error('Failed to initialize search index:', error);
    // Create empty index as fallback
    _searchIndex = {
      entries: [],
      keywordMap: new Map(),
      categoryMap: new Map(),
    };
  }
}

/**
 * Search documentation using the built index
 * @param query - Search query
 * @returns Array of search results
 */
export function search(query: string): IndexedDoc[] {
  if (!_searchIndex) {
    console.warn('Search index not initialized, returning empty results');
    return [];
  }

  return searchIndexInternal(query);
}

/**
 * Get all indexed entries
 * @returns All indexed documentation entries
 */
export function getAllEntries(): IndexedDoc[] {
  return _searchIndex?.entries || [];
}

/**
 * Get entries by category
 * @param category - Category name
 * @returns Array of entries in category
 */
export function getEntriesByCategory(category: string): IndexedDoc[] {
  if (!_searchIndex) return [];

  const indices = _searchIndex.categoryMap.get(category);
  if (!indices) return [];

  return indices.map((index: number) => _searchIndex!.entries[index]);
}

/**
 * Get all available categories
 * @returns Array of category names
 */
export function getCategories(): string[] {
  return _searchIndex ? Array.from(_searchIndex.categoryMap.keys()) : [];
}
