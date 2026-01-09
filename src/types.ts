/**
 * MCP Tool input/output types for Tenable documentation server
 */

/**
 * Input parameters for the search_docs tool
 */
export interface SearchDocsInput {
  query: string;
}

/**
 * Search result item returned by search_docs tool
 */
export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

/**
 * Input parameters for the read_page tool
 */
export interface ReadPageInput {
  url: string;
}

/**
 * Output from read_page tool containing the markdown content
 */
export interface ReadPageOutput {
  url: string;
  title: string;
  content: string;
  wordCount: number;
}

/**
 * Scraping utility types
 */

/**
 * Download options for HTML downloader
 */
export interface DownloadOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * HTML content with metadata
 */
export interface HTMLContent {
  html: string;
  url: string;
  statusCode: number;
}

/**
 * Cleaning options for HTML cleaner
 */
export interface CleaningOptions {
  removeSelectors?: string[];
  keepSelectors?: string[];
}

/**
 * Converter types for HTML to Markdown conversion
 */

/**
 * Conversion options for turndown
 */
export interface ConversionOptions {
  headingStyle?: 'setext' | 'atx';
  codeBlockStyle?: 'fenced' | 'indented';
  bulletListMarker?: '-' | '*' | '+';
}

/**
 * Error types for robust error handling
 */

/**
 * Base error class for Tenable MCP server errors
 */
export class TenableMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TenableMCPError';
  }
}

/**
 * Network error when HTTP requests fail
 */
export class NetworkError extends TenableMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/**
 * Parsing error when HTML or JSON parsing fails
 */
export class ParseError extends TenableMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends TenableMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Scraping error when scraping fails
 */
export class ScrapingError extends TenableMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'SCRAPING_ERROR', details);
    this.name = 'ScrapingError';
  }
}

/**
 * Conversion error when HTML to Markdown conversion fails
 */
export class ConversionError extends TenableMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONVERSION_ERROR', details);
    this.name = 'ConversionError';
  }
}

/**
 * Search error when search functionality fails
 */
export class SearchError extends TenableMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'SEARCH_ERROR', details);
    this.name = 'SearchError';
  }
}

/**
 * Rate limit error when too many requests are made
 */
export class RateLimitError extends TenableMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

/**
 * Result wrapper that can contain either success data or error
 */
export type Result<T, E extends TenableMCPError = TenableMCPError> =
  | { success: true; data: T }
  | { success: false; error: E };
