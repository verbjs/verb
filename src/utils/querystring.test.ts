import { test, expect } from "bun:test";
import {
  parseQueryString,
  buildQueryString,
  parseQueryStringCached,
  parseCommonPatterns,
  validateQueryString,
  clearQueryCache,
  enableQueryCache,
  getQueryCacheStats,
  extractQueryFromUrl,
  benchmarkQueryParsing,
  QUERY_CONSTANTS
} from "./querystring";

test("parseQueryString - basic functionality", () => {
  const result = parseQueryString("name=John&age=30&city=New York");
  expect(result).toEqual({
    name: "John",
    age: "30",
    city: "New York"
  });
});

test("parseQueryString - empty and edge cases", () => {
  expect(parseQueryString("")).toEqual({});
  expect(parseQueryString("?")).toEqual({});
  expect(parseQueryString("?name=John")).toEqual({ name: "John" });
  expect(parseQueryString("name=")).toEqual({ name: "" });
  expect(parseQueryString("name")).toEqual({ name: "" });
});

test("parseQueryString - array handling", () => {
  const result = parseQueryString("tags[]=javascript&tags[]=nodejs&tags[]=react", {
    parseArrays: true
  });
  expect(result).toEqual({
    tags: ["javascript", "nodejs", "react"]
  });
});

test("parseQueryString - duplicate keys", () => {
  const result = parseQueryString("color=red&color=blue&color=green");
  expect(result).toEqual({
    color: ["red", "blue", "green"]
  });
});

test("parseQueryString - type parsing", () => {
  const result = parseQueryString("active=true&count=42&name=John", {
    parseBooleans: true,
    parseNumbers: true
  });
  expect(result).toEqual({
    active: true,
    count: 42,
    name: "John"
  });
});

test("parseQueryString - dot notation", () => {
  const result = parseQueryString("user.name=John&user.age=30&user.active=true", {
    allowDots: true,
    parseBooleans: true,
    parseNumbers: true
  });
  expect(result).toEqual({
    user: {
      name: "John",
      age: 30,
      active: true
    }
  });
});

test("parseQueryString - maxKeys limit", () => {
  const result = parseQueryString("a=1&b=2&c=3&d=4&e=5", { maxKeys: 3 });
  expect(Object.keys(result)).toHaveLength(3);
});

test("parseQueryString - URL decoding", () => {
  const result = parseQueryString("message=Hello%20World&special=%21%40%23", {
    decodeValues: true
  });
  expect(result).toEqual({
    message: "Hello World",
    special: "!@#"
  });
});

test("parseQueryString - malformed URI handling", () => {
  const result = parseQueryString("name=John&bad=%ZZ&good=test", {
    decodeValues: true
  });
  expect(result).toEqual({
    name: "John",
    good: "test"
  });
});

test("buildQueryString - basic functionality", () => {
  const params = { name: "John", age: "30", city: "New York" };
  const result = buildQueryString(params);
  expect(result).toBe("name=John&age=30&city=New%20York");
});

test("buildQueryString - array handling", () => {
  const params = { tags: ["javascript", "nodejs", "react"] };
  const result = buildQueryString(params, { arrayFormat: "brackets" });
  expect(result).toBe("tags[]=javascript&tags[]=nodejs&tags[]=react");
});

test("buildQueryString - empty params", () => {
  expect(buildQueryString({})).toBe("");
  expect(buildQueryString({ name: undefined })).toBe("");
});

test("parseQueryStringCached - caching functionality", () => {
  clearQueryCache();
  
  const query = "name=John&age=30";
  const result1 = parseQueryStringCached(query);
  const result2 = parseQueryStringCached(query);
  
  expect(result1).toEqual(result2);
  expect(getQueryCacheStats().size).toBe(1);
});

test("parseQueryStringCached - cache management", () => {
  clearQueryCache();
  enableQueryCache(false);
  
  const query = "name=John&age=30";
  parseQueryStringCached(query);
  
  expect(getQueryCacheStats().size).toBe(0);
  expect(getQueryCacheStats().enabled).toBe(false);
  
  enableQueryCache(true);
});

test("parseCommonPatterns - simple parsing", () => {
  const result = parseCommonPatterns.simple("name=John&age=30&city=New%20York");
  expect(result).toEqual({
    name: "John",
    age: "30",
    city: "New York"
  });
});

test("parseCommonPatterns - pagination", () => {
  const result = parseCommonPatterns.pagination("page=2&limit=10&offset=20");
  expect(result).toEqual({
    page: 2,
    limit: 10,
    offset: 20
  });
});

test("parseCommonPatterns - search", () => {
  const result = parseCommonPatterns.search("q=javascript&sort=date&order=desc");
  expect(result).toEqual({
    q: "javascript",
    sort: "date",
    order: "desc"
  });
});

test("parseCommonPatterns - filters", () => {
  const result = parseCommonPatterns.filters("filter_category=tech&filter_status=active&where_date=2023");
  expect(result).toEqual({
    filter_category: "tech",
    filter_status: "active",
    where_date: "2023"
  });
});

test("validateQueryString - validation", () => {
  expect(validateQueryString("name=John&age=30")).toBe(true);
  expect(validateQueryString("name=<script>alert('xss')</script>")).toBe(false);
  expect(validateQueryString("a".repeat(10000))).toBe(false);
});

test("extractQueryFromUrl - URL extraction", () => {
  expect(extractQueryFromUrl("https://example.com/api?name=John&age=30")).toBe("name=John&age=30");
  expect(extractQueryFromUrl("https://example.com/api")).toBe("");
  expect(extractQueryFromUrl("/path?query=test")).toBe("query=test");
});

test("QUERY_CONSTANTS - constants availability", () => {
  expect(QUERY_CONSTANTS.PAGINATION.PAGE).toBe("page");
  expect(QUERY_CONSTANTS.SEARCH.QUERY).toBe("q");
  expect(QUERY_CONSTANTS.FILTERS.FILTER_PREFIX).toBe("filter_");
});

test("benchmarkQueryParsing - performance testing", () => {
  const results = benchmarkQueryParsing(100); // Small iteration count for tests
  
  expect(results.simpleParseTime).toBeGreaterThan(0);
  expect(results.cachedParseTime).toBeGreaterThan(0);
  expect(results.fullParseTime).toBeGreaterThan(0);
  expect(results.operationsPerSecond).toBeGreaterThan(0);
});

test("parseQueryString - complex real-world example", () => {
  const query = "search=javascript%20tutorial&category=web&tags[]=frontend&tags[]=backend&page=1&limit=20&sort=date&order=desc&filter_difficulty=beginner&active=true";
  const result = parseQueryString(query, {
    parseArrays: true,
    parseBooleans: true,
    parseNumbers: true
  });
  
  expect(result).toEqual({
    search: "javascript tutorial",
    category: "web",
    tags: ["frontend", "backend"],
    page: 1,
    limit: 20,
    sort: "date",
    order: "desc",
    filter_difficulty: "beginner",
    active: true
  });
});

test("parseQueryString - nested objects with dot notation", () => {
  const query = "user.profile.name=John&user.profile.age=30&user.settings.theme=dark&user.settings.notifications.email=true";
  const result = parseQueryString(query, {
    allowDots: true,
    parseBooleans: true,
    parseNumbers: true
  });
  
  expect(result).toEqual({
    user: {
      profile: {
        name: "John",
        age: 30
      },
      settings: {
        theme: "dark",
        notifications: {
          email: true
        }
      }
    }
  });
});

test("parseQueryString - performance with large query strings", () => {
  // Generate a large query string
  const pairs = [];
  for (let i = 0; i < 100; i++) {
    pairs.push(`key${i}=value${i}`);
  }
  const largeQuery = pairs.join('&');
  
  const startTime = performance.now();
  const result = parseQueryString(largeQuery);
  const endTime = performance.now();
  
  expect(Object.keys(result)).toHaveLength(100);
  expect(endTime - startTime).toBeLessThan(10); // Should be fast
});

test("cache management - LRU behavior", () => {
  clearQueryCache();
  
  // Fill cache to near capacity
  for (let i = 0; i < 50; i++) {
    parseQueryStringCached(`key${i}=value${i}`);
  }
  
  const stats = getQueryCacheStats();
  expect(stats.size).toBeGreaterThan(0);
  expect(stats.enabled).toBe(true);
  expect(stats.maxSize).toBe(1000);
});

test("parseQueryString - special characters and encoding", () => {
  const query = "name=John%20Doe&email=john%40example.com&message=Hello%2C%20World%21";
  const result = parseQueryString(query, { decodeValues: true });
  
  expect(result).toEqual({
    name: "John Doe",
    email: "john@example.com",
    message: "Hello, World!"
  });
});

test("buildQueryString - special characters handling", () => {
  const params = {
    name: "John Doe",
    email: "john@example.com",
    message: "Hello, World!"
  };
  const result = buildQueryString(params);
  
  expect(result).toBe("name=John%20Doe&email=john%40example.com&message=Hello%2C%20World!");
});

test("parseQueryString - custom delimiter", () => {
  const result = parseQueryString("name=John;age=30;city=New York", {
    delimiter: ";"
  });
  
  expect(result).toEqual({
    name: "John",
    age: "30",
    city: "New York"
  });
});

test("parseQueryString - mixed array formats", () => {
  const result = parseQueryString("tags[]=javascript&tags[]=nodejs&categories=web&categories=tutorial", {
    parseArrays: true
  });
  
  expect(result).toEqual({
    tags: ["javascript", "nodejs"],
    categories: ["web", "tutorial"]
  });
});