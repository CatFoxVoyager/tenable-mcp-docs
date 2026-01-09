/**
 * Search functionality for Tenable documentation
 */

import {
  SearchResult,
  SearchError,
  ValidationError,
} from '../types.js';
import {
  search,
} from '../utils/indexer.js';

/**
 * Validate search query input
 * @param query - Search query to validate
 * @throws ValidationError if query is invalid
 */
function validateSearchQuery(query: string): void {
  if (!query || typeof query !== 'string') {
    throw new ValidationError('Search query must be a non-empty string');
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    throw new ValidationError('Search query cannot be empty');
  }

  if (trimmedQuery.length < 2) {
    throw new ValidationError('Search query must be at least 2 characters long');
  }

  if (trimmedQuery.length > 200) {
    throw new ValidationError('Search query is too long (max 200 characters)');
  }
}

/**
 * Search Tenable documentation for relevant pages
 * This implementation uses a pre-built index of Tenable documentation
 * to provide real, working search results.
 *
 * @param query - Search query string
 * @returns Array of search results with URLs, titles, and descriptions
 * @throws ValidationError if query is invalid
 * @throws SearchError if search fails
 */
export async function searchDocs(query: string): Promise<SearchResult[]> {
  try {
    // Validate input
    validateSearchQuery(query);

    // Search index
    const indexedResults = search(query);

    // Convert to search results
    const results: SearchResult[] = indexedResults.map(entry => ({
      url: entry.url,
      title: entry.title,
      description: entry.description,
    }));

    // If no results found, provide fallback
    if (results.length === 0) {
      return getFallbackResults();
    }

    return results;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new SearchError(
      `Failed to search documentation for query: "${query}"`,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get fallback results when no search results are found
 * @returns Array of fallback search results
 */
function getFallbackResults(): SearchResult[] {
  return [
    {
      url: 'https://developer.tenable.com/reference',
      title: 'Tenable API Documentation',
      description: 'Browse all Tenable API documentation. Your search may be found in various API sections.',
    },
    {
      url: 'https://developer.tenable.com/recipes',
      title: 'Tenable Recipes',
      description: 'Pre-built integration examples and automation scripts that may help with your query.',
    },
    {
      url: 'https://developer.tenable.com/api-explorer',
      title: 'API Explorer',
      description: 'Interactive tool to explore Tenable APIs and test endpoints.',
    },
  ];
}
