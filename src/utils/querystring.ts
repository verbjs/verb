// High-performance query string parsing utilities
// Optimized for common query patterns and Bun's performance

export interface QueryObject {
  [key: string]: string | string[] | undefined;
}

export interface QueryParseOptions {
  arrayFormat?: "brackets" | "comma" | "repeat";
  delimiter?: string;
  maxKeys?: number;
  decodeValues?: boolean;
  allowDots?: boolean;
  parseArrays?: boolean;
  parseNumbers?: boolean;
  parseBooleans?: boolean;
}

// Fast query string parsing with minimal allocations
export const parseQueryString = (query: string, options: QueryParseOptions = {}): QueryObject => {
  const {
    arrayFormat = "brackets",
    delimiter = "&",
    maxKeys = 1000,
    decodeValues = true,
    allowDots = false,
    parseArrays = true,
    parseNumbers = false,
    parseBooleans = false,
  } = options;

  if (!query || query.length === 0) {
    return {};
  }

  // Remove leading ? if present
  const cleanQuery = query.startsWith("?") ? query.slice(1) : query;

  if (cleanQuery.length === 0) {
    return {};
  }

  const result: QueryObject = {};
  const pairs = cleanQuery.split(delimiter);
  let keyCount = 0;

  for (const pair of pairs) {
    // Safety check for DoS protection
    if (keyCount >= maxKeys) {
      break;
    }

    const equalIndex = pair.indexOf("=");
    let key: string;
    let value: string;

    if (equalIndex === -1) {
      key = pair;
      value = "";
    } else {
      key = pair.substring(0, equalIndex);
      value = pair.substring(equalIndex + 1);
    }

    // Skip empty keys
    if (key.length === 0) {
      continue;
    }

    // Decode values if requested
    if (decodeValues) {
      try {
        key = decodeURIComponent(key);
        value = decodeURIComponent(value);
      } catch {
        // Skip malformed URI components
        continue;
      }
    }

    // Handle array notation
    if (parseArrays && arrayFormat === "brackets" && key.endsWith("[]")) {
      const baseKey = key.slice(0, -2);
      if (baseKey.length > 0) {
        const existing = result[baseKey];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else if (existing !== undefined) {
          result[baseKey] = [existing, value];
        } else {
          result[baseKey] = [value];
        }
      }
      keyCount++;
      continue;
    }

    // Handle dot notation (nested objects)
    if (allowDots && key.includes(".")) {
      setNestedValue(result, key.split("."), value, parseBooleans, parseNumbers);
      keyCount++;
      continue;
    }

    // Handle existing keys (array formation)
    const existing = result[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      // Parse value types if requested
      result[key] = parseValue(value, parseBooleans, parseNumbers);
    }

    keyCount++;
  }

  return result;
};

// Parse individual values with type conversion
const parseValue = (
  value: string,
  parseBooleans: boolean,
  parseNumbers: boolean,
): string | number | boolean => {
  if (parseBooleans) {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }

  if (parseNumbers && value.length > 0 && !Number.isNaN(Number(value))) {
    const num = Number(value);
    if (Number.isInteger(num)) {
      return num;
    }
  }

  return value;
};

// Set nested object values using dot notation
const setNestedValue = (
  obj: any,
  path: string[],
  value: string,
  parseBooleans: boolean,
  parseNumbers: boolean,
): void => {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === undefined) {
      current[key] = {};
    } else if (typeof current[key] !== "object") {
      // Convert to object if not already
      current[key] = {};
    }
    current = current[key];
  }

  const finalKey = path[path.length - 1];
  current[finalKey] = parseValue(value, parseBooleans, parseNumbers);
};

// Fast query string building
export const buildQueryString = (params: QueryObject, options: QueryParseOptions = {}): string => {
  const { arrayFormat = "brackets", delimiter = "&", decodeValues = true } = options;

  if (!params || Object.keys(params).length === 0) {
    return "";
  }

  const pairs: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    const encodeKey = decodeValues ? encodeURIComponent(key) : key;

    if (Array.isArray(value)) {
      // Handle array values
      for (const item of value) {
        const encodeValue = decodeValues ? encodeURIComponent(String(item)) : String(item);
        if (arrayFormat === "brackets") {
          pairs.push(`${encodeKey}[]=${encodeValue}`);
        } else {
          pairs.push(`${encodeKey}=${encodeValue}`);
        }
      }
    } else {
      const encodeValue = decodeValues ? encodeURIComponent(String(value)) : String(value);
      pairs.push(`${encodeKey}=${encodeValue}`);
    }
  }

  return pairs.join(delimiter);
};

// Optimized query string cache
const queryCache = new Map<string, QueryObject>();
let queryCacheEnabled = true;
const MAX_CACHE_SIZE = 1000;

export const parseQueryStringCached = (
  query: string,
  options: QueryParseOptions = {},
): QueryObject => {
  if (!queryCacheEnabled) {
    return parseQueryString(query, options);
  }

  const cacheKey = `${query}_${JSON.stringify(options)}`;

  const cached = queryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const result = parseQueryString(query, options);

  // Simple LRU: if cache is full, remove oldest entry
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }

  queryCache.set(cacheKey, result);
  return result;
};

// Common query string patterns for optimization
export const parseCommonPatterns = {
  // Parse simple key=value pairs (most common)
  simple: (query: string): QueryObject => {
    const result: QueryObject = {};
    const pairs = query.split("&");

    for (const pair of pairs) {
      const equalIndex = pair.indexOf("=");
      if (equalIndex === -1) {
        continue;
      }

      const key = pair.substring(0, equalIndex);
      const value = pair.substring(equalIndex + 1);

      if (key.length > 0) {
        try {
          result[decodeURIComponent(key)] = decodeURIComponent(value);
        } catch {
          // Skip malformed pairs
        }
      }
    }

    return result;
  },

  // Parse pagination parameters
  pagination: (query: string): { page?: number; limit?: number; offset?: number } => {
    const params = parseCommonPatterns.simple(query);
    return {
      page: params.page ? parseInt(String(params.page), 10) : undefined,
      limit: params.limit ? parseInt(String(params.limit), 10) : undefined,
      offset: params.offset ? parseInt(String(params.offset), 10) : undefined,
    };
  },

  // Parse search parameters
  search: (query: string): { q?: string; sort?: string; order?: "asc" | "desc" } => {
    const params = parseCommonPatterns.simple(query);
    return {
      q: params.q ? String(params.q) : undefined,
      sort: params.sort ? String(params.sort) : undefined,
      order: params.order === "desc" ? "desc" : "asc",
    };
  },

  // Parse filter parameters
  filters: (query: string): { [key: string]: string | string[] } => {
    const params = parseQueryString(query, { parseArrays: true });
    const filters: { [key: string]: string | string[] } = {};

    for (const [key, value] of Object.entries(params)) {
      if ((key.startsWith("filter_") || key.startsWith("where_")) && value !== undefined) {
        filters[key] = value;
      }
    }

    return filters;
  },
};

// Query string validation
export const validateQueryString = (query: string, maxLength = 8192): boolean => {
  if (query.length > maxLength) {
    return false;
  }

  // Check for potentially dangerous characters
  const dangerousChars = /[<>'"]/;
  if (dangerousChars.test(query)) {
    return false;
  }

  return true;
};

// Query cache management
export const clearQueryCache = (): void => {
  queryCache.clear();
};

export const enableQueryCache = (enabled: boolean): void => {
  queryCacheEnabled = enabled;
  if (!enabled) {
    queryCache.clear();
  }
};

export const getQueryCacheStats = (): {
  size: number;
  enabled: boolean;
  maxSize: number;
} => {
  return {
    size: queryCache.size,
    enabled: queryCacheEnabled,
    maxSize: MAX_CACHE_SIZE,
  };
};

// Fast URL parameter extraction (for req.query)
export const extractQueryFromUrl = (url: string): string => {
  const questionIndex = url.indexOf("?");
  return questionIndex === -1 ? "" : url.substring(questionIndex + 1);
};

// Common query string constants
export const QUERY_CONSTANTS = {
  PAGINATION: {
    PAGE: "page",
    LIMIT: "limit",
    OFFSET: "offset",
    SIZE: "size",
  },
  SEARCH: {
    QUERY: "q",
    SEARCH: "search",
    SORT: "sort",
    ORDER: "order",
  },
  FILTERS: {
    FILTER_PREFIX: "filter_",
    WHERE_PREFIX: "where_",
  },
} as const;

// Performance benchmarking
export const benchmarkQueryParsing = (
  iterations = 10000,
): {
  simpleParseTime: number;
  cachedParseTime: number;
  fullParseTime: number;
  operationsPerSecond: number;
} => {
  const testQuery = "name=John&age=30&city=New York&tags[]=javascript&tags[]=nodejs&active=true";

  // Benchmark simple parsing
  const simpleStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    parseCommonPatterns.simple(testQuery);
  }
  const simpleEnd = performance.now();
  const simpleParseTime = simpleEnd - simpleStart;

  // Benchmark cached parsing
  const cachedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    parseQueryStringCached(testQuery);
  }
  const cachedEnd = performance.now();
  const cachedParseTime = cachedEnd - cachedStart;

  // Benchmark full parsing
  const fullStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    parseQueryString(testQuery, { parseArrays: true, parseBooleans: true });
  }
  const fullEnd = performance.now();
  const fullParseTime = fullEnd - fullStart;

  return {
    simpleParseTime,
    cachedParseTime,
    fullParseTime,
    operationsPerSecond: (iterations / fullParseTime) * 1000,
  };
};
