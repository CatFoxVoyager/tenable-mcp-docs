/**
 * Search functionality for Tenable documentation
 */

import {
  SearchResult,
  SearchError,
  ValidationError,
} from '../types.js';

/**
 * Known Tenable documentation base URLs and patterns
 * This maps to the actual documentation structure on developer.tenable.com
 */
const TENABLE_DOC_PATTERNS = [
  {
    category: 'API References',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['api', 'endpoint', 'reference', 'vulnerability management', 'scanning', 'scans', 'assets', 'target groups'],
  },
  {
    category: 'Vulnerability Management',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['vulnerability', 'vm', 'scan', 'asset', 'target', 'plugin', 'family'],
  },
  {
    category: 'Web App Scanning',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['was', 'web app', 'web application', 'wvs', 'dast', 'web scanning'],
  },
  {
    category: 'Attack Surface Management',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['asm', 'attack surface', 'discovery', 'sources', 'assets'],
  },
  {
    category: 'Identity Exposure',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['identity', 'ad', 'active directory', 'exposure', 'identity exposure'],
  },
  {
    category: 'PCI ASV',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['pci', 'asv', 'attestation', 'payment card', 'security standard'],
  },
  {
    category: 'Tenable One',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['tenable one', 'exposure view', 'attack path', 'inventory'],
  },
  {
    category: 'Downloads API',
    baseUrl: 'https://developer.tenable.com/reference',
    patterns: ['download', 'report', 'export', 'file', 'pdf'],
  },
  {
    category: 'Recipes & Examples',
    baseUrl: 'https://developer.tenable.com/recipes',
    patterns: ['recipe', 'example', 'script', 'python', 'automation', 'integration'],
  },
  {
    category: 'API Explorer',
    baseUrl: 'https://developer.tenable.com/api-explorer',
    patterns: ['api explorer', 'interactive', 'test', 'try'],
  },
];

/**
 * Normalize and clean a search query
 * @param query - Raw search query
 * @returns Normalized query string
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-]/g, '');
}

/**
 * Calculate relevance score for a pattern based on query
 * @param query - Normalized search query
 * @param pattern - Pattern string to match against
 * @returns Relevance score (0-1)
 */
function calculateRelevance(query: string, pattern: string): number {
  const queryWords = query.split(' ');
  const patternWords = pattern.toLowerCase().split(' ');
  
  let score = 0;
  let matches = 0;
  
  // Count exact word matches
  for (const queryWord of queryWords) {
    for (const patternWord of patternWords) {
      if (queryWord === patternWord || patternWord.includes(queryWord)) {
        matches++;
        score += 1 / queryWords.length;
        break;
      }
    }
  }
  
  // Bonus for exact query match
  if (pattern.includes(query)) {
    score += 0.3;
  }
  
  return Math.min(score, 1);
}

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
 * Generate a realistic URL for Tenable documentation based on query
 * @param query - Search query
 * @param category - Documentation category
 * @returns Generated URL string
 */
function generateDocumentationUrl(query: string, category: string): string {
  const normalizedQuery = normalizeQuery(query);
  const slug = normalizedQuery.replace(/\s+/g, '-').toLowerCase();
  
  // Generate URLs based on category
  switch (category) {
    case 'API References':
    case 'Vulnerability Management':
      return `https://developer.tenable.com/reference/${slug}`;
    case 'Recipes & Examples':
      return `https://developer.tenable.com/recipes/${slug}`;
    case 'API Explorer':
      return `https://developer.tenable.com/api-explorer`;
    default:
      return `https://developer.tenable.com/reference/${slug}`;
  }
}

/**
 * Generate a realistic description for a search result
 * @param query - Search query
 * @param category - Documentation category
 * @returns Generated description string
 */
function generateDescription(query: string, category: string): string {
  const templates = [
    `Documentation and API references for ${query}`,
    `Learn how to use ${query} in Tenable's ${category}`,
    `Complete guide and examples for ${query} in the ${category}`,
    `API documentation and usage examples for ${query}`,
  ];
  
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
}

/**
 * Search Tenable documentation for relevant pages
 * This implementation simulates search by matching queries against known documentation patterns
 * and generating relevant URLs. In a production environment, this would connect to Tenable's
 * actual search API or scrape search results.
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
    
    const normalizedQuery = normalizeQuery(query);
    const results: SearchResult[] = [];
    
    // Calculate relevance for each documentation pattern
    const scoredPatterns = TENABLE_DOC_PATTERNS.map(pattern => {
      let maxRelevance = 0;
      
      for (const patternStr of pattern.patterns) {
        const relevance = calculateRelevance(normalizedQuery, patternStr);
        if (relevance > maxRelevance) {
          maxRelevance = relevance;
        }
      }
      
      return {
        pattern,
        relevance: maxRelevance,
      };
    });
    
    // Filter and sort by relevance
    const relevantPatterns = scoredPatterns
      .filter(sp => sp.relevance > 0.2) // Minimum relevance threshold
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10); // Return top 10 results
    
    // Generate search results
    for (const { pattern } of relevantPatterns) {
      const url = generateDocumentationUrl(query, pattern.category);
      const title = `${pattern.category}: ${query}`;
      const description = generateDescription(query, pattern.category);
      
      results.push({
        url,
        title,
        description,
      });
    }
    
    // If no results found, return a fallback result
    if (results.length === 0) {
      results.push({
        url: `https://developer.tenable.com/reference`,
        title: 'Tenable API Documentation',
        description: `Browse all Tenable API documentation. Your search for "${query}" may be found in various API sections.`,
      });
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
 * Search Tenable documentation with advanced filtering
 * @param query - Search query string
 * @param options - Optional search options
 * @returns Array of search results
 */
export async function searchDocsAdvanced(
  query: string,
  options: {
    category?: string;
    limit?: number;
    minRelevance?: number;
  } = {}
): Promise<SearchResult[]> {
  const results = await searchDocs(query);
  
  let filteredResults = results;
  
  // Filter by category if specified
  if (options.category) {
    filteredResults = filteredResults.filter(result =>
      result.title.toLowerCase().includes(options.category!.toLowerCase())
    );
  }
  
  // Filter by minimum relevance (note: this requires storing relevance, which we're not doing in SearchResult)
  // For now, we'll just limit the results
  
  // Limit results if specified
  if (options.limit && options.limit > 0) {
    filteredResults = filteredResults.slice(0, options.limit);
  }
  
  return filteredResults;
}

/**
 * Get quick links to popular Tenable documentation sections
 * @returns Array of popular documentation links
 */
export function getPopularDocs(): SearchResult[] {
  return [
    {
      url: 'https://developer.tenable.com/reference/vulnerability-management-api',
      title: 'Vulnerability Management API',
      description: 'Complete API reference for Tenable Vulnerability Management',
    },
    {
      url: 'https://developer.tenable.com/reference/web-app-scanning-api',
      title: 'Web App Scanning API',
      description: 'API documentation for Web Application Scanning',
    },
    {
      url: 'https://developer.tenable.com/recipes',
      title: 'Tenable Recipes',
      description: 'Pre-built integration examples and automation scripts',
    },
    {
      url: 'https://developer.tenable.com/api-explorer',
      title: 'API Explorer',
      description: 'Interactive API testing and exploration tool',
    },
  ];
}
