/**
 * Simple LRU cache implementation for caching HTTP responses and pages
 */

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

/**
 * LRU cache options
 */
export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
}

/**
 * LRU cache implementation
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;
  private accessOrder: string[];

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours default
    this.accessOrder = [];
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.delete(key);
      return undefined;
    }

    // Update access order (move to end)
    this.updateAccessOrder(key);
    entry.hits++;

    return entry.data;
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    // If key already exists, delete it first
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // If cache is full, evict least recently used
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      hits: 0,
    });

    this.accessOrder.push(key);
  }

  /**
   * Delete entry from cache
   * @param key - Cache key to delete
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Check if key exists in cache
   * @param key - Cache key
   * @returns True if key exists and not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   * @returns Object with cache stats
   */
  getStats(): {
    size: number;
    maxSize: number;
    keys: string[];
    totalHits: number;
  } {
    let totalHits = 0;
    this.cache.forEach(entry => {
      totalHits += entry.hits;
    });

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
      totalHits,
    };
  }

  /**
   * Update access order when an entry is accessed
   * @param key - Cache key
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.delete(key));

    return expiredKeys.length;
  }
}

/**
 * Create a cache key from URL and optional parameters
 * @param url - URL
 * @param params - Optional parameters
 * @returns Cache key string
 */
export function createCacheKey(url: string, params: Record<string, any> = {}): string {
  const paramStr = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');

  return paramStr ? `${url}:${paramStr}` : url;
}
