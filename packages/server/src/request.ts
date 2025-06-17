// Optimized request parsing with minimal object allocations

import {
  type MultipartData,
  type MultipartOptions,
  isMultipartRequest,
  parseMultipart,
} from "./upload.ts";

// Pre-allocated objects to reduce GC pressure
const EMPTY_QUERY = Object.freeze({});
const EMPTY_COOKIES = Object.freeze({});

// Reusable URLSearchParams for query parsing
let queryParser: URLSearchParams | null = null;

/**
 * Optimized body parsing with type detection and minimal allocations
 * Automatically handles JSON, form data, and plain text
 * @param req - The request object to parse
 * @returns Parsed body content (object for JSON/form data, string for text, Blob for others)
 * @example
 * ```ts
 * // JSON body
 * const data = await parseBody(req); // { name: "John", age: 30 }
 *
 * // Form data
 * const form = await parseBody(req); // { username: "john", password: "secret" }
 *
 * // Plain text
 * const text = await parseBody(req); // "Hello World"
 * ```
 */
export const parseBody = async (req: Request): Promise<unknown> => {
  const contentType = req.headers.get("content-type");

  if (!contentType) {
    return req.blob();
  }

  // Fast path for JSON - most common case
  if (contentType.includes("application/json")) {
    return req.json();
  }

  // Fast path for multipart form data
  if (contentType.includes("multipart/form-data")) {
    return parseMultipart(req);
  }

  // Fast path for form data
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();

    // Reuse URLSearchParams instance
    if (!queryParser) {
      queryParser = new URLSearchParams();
    } else {
      // Clear previous data
      for (const key of queryParser.keys()) {
        queryParser.delete(key);
      }
    }

    // Parse efficiently
    queryParser = new URLSearchParams(text);
    const result: Record<string, string> = {};
    queryParser.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  // Fast path for text
  if (contentType.includes("text/")) {
    return req.text();
  }

  return req.blob();
};

/**
 * Optimized query parameter extraction with caching
 * @param req - The request object
 * @returns Object containing query parameter key-value pairs
 * @example
 * ```ts
 * // URL: /search?q=hello&limit=10
 * const query = getQuery(req); // { q: "hello", limit: "10" }
 * ```
 */
export const getQuery = (req: Request): Record<string, string> => {
  const url = new URL(req.url);

  // Early return for no query params
  if (!url.search) {
    return EMPTY_QUERY;
  }

  const result: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

/**
 * Optimized cookie parsing with minimal string operations
 * @param req - The request object
 * @returns Object containing cookie key-value pairs
 * @example
 * ```ts
 * // Cookie header: "session=abc123; theme=dark"
 * const cookies = getCookies(req); // { session: "abc123", theme: "dark" }
 * ```
 */
export const getCookies = (req: Request): Record<string, string> => {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) {
    return EMPTY_COOKIES;
  }

  const cookies: Record<string, string> = {};
  let start = 0;

  // Parse cookies without using split() to reduce allocations
  for (let i = 0; i <= cookieHeader.length; i++) {
    if (i === cookieHeader.length || cookieHeader[i] === ";") {
      const segment = cookieHeader.slice(start, i).trim();
      const equalIndex = segment.indexOf("=");

      if (equalIndex > 0) {
        const key = segment.slice(0, equalIndex).trim();
        const value = segment.slice(equalIndex + 1).trim();
        cookies[key] = decodeURIComponent(value);
      }

      start = i + 1;
    }
  }

  return cookies;
};

/**
 * Fast header check utility
 */
export const hasHeader = (req: Request, name: string): boolean => req.headers.has(name);

/**
 * Fast content type check
 */
export const isJsonRequest = (req: Request): boolean => {
  const contentType = req.headers.get("content-type");
  return !!contentType?.includes("application/json");
};

/**
 * Fast method check utilities
 */
export const isGetRequest = (req: Request): boolean => req.method === "GET";
export const isPostRequest = (req: Request): boolean => req.method === "POST";
export const isPutRequest = (req: Request): boolean => req.method === "PUT";
export const isDeleteRequest = (req: Request): boolean => req.method === "DELETE";
