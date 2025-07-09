import { test, expect } from "bun:test";
import { 
  parseAccept, 
  parseMediaType, 
  matchesMediaType, 
  negotiateContentType,
  negotiateCharset,
  negotiateEncoding,
  negotiateLanguage,
  enhanceRequestWithContentNegotiation,
  respondWithBestFormat,
  respondWithLanguage,
  MIME_TYPES,
  CHARSETS,
  ENCODINGS,
  LANGUAGES
} from "../../src/content-negotiation";
import type { VerbRequest } from "../../src/types";

// Mock helper functions
const createMockRequest = (headers: Record<string, string> = {}): VerbRequest => {
  const mockHeaders = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    mockHeaders.set(key, value);
  });
  
  const baseRequest = {
    method: 'GET',
    url: 'http://localhost:3000/test',
    headers: mockHeaders,
    get: (header: string) => mockHeaders.get(header),
  };
  
  return baseRequest as VerbRequest;
};

// Parse Accept Header Tests
test("parseAccept - parses simple accept header", () => {
  const result = parseAccept("text/html,application/json");
  
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ value: "text/html", quality: 1.0, params: {} });
  expect(result[1]).toEqual({ value: "application/json", quality: 1.0, params: {} });
});

test("parseAccept - parses accept header with quality values", () => {
  const result = parseAccept("text/html,application/json;q=0.9,*/*;q=0.8");
  
  expect(result).toHaveLength(3);
  expect(result[0]).toEqual({ value: "text/html", quality: 1.0, params: {} });
  expect(result[1]).toEqual({ value: "application/json", quality: 0.9, params: {} });
  expect(result[2]).toEqual({ value: "*/*", quality: 0.8, params: {} });
});

test("parseAccept - parses accept header with parameters", () => {
  const result = parseAccept("text/html;level=1;q=0.9,application/json;version=1.0");
  
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ value: "application/json", quality: 1.0, params: { version: "1.0" } });
  expect(result[1]).toEqual({ value: "text/html", quality: 0.9, params: { level: "1" } });
});

test("parseAccept - handles empty header", () => {
  const result = parseAccept("");
  expect(result).toHaveLength(0);
});

test("parseAccept - handles malformed header", () => {
  const result = parseAccept("invalid;;q=abc");
  expect(result).toHaveLength(1);
  expect(result[0].value).toBe("invalid");
  expect(result[0].quality).toBe(1.0);
});

// Parse Media Type Tests
test("parseMediaType - parses simple media type", () => {
  const result = parseMediaType("text/html");
  
  expect(result).toEqual({
    type: "text",
    subtype: "html",
    quality: 1.0,
    params: {}
  });
});

test("parseMediaType - parses media type with parameters", () => {
  const result = parseMediaType("text/html;charset=utf-8;level=1");
  
  expect(result).toEqual({
    type: "text",
    subtype: "html",
    quality: 1.0,
    params: { charset: "utf-8", level: "1" }
  });
});

test("parseMediaType - handles wildcards", () => {
  const result = parseMediaType("*/*");
  
  expect(result).toEqual({
    type: "*",
    subtype: "*",
    quality: 1.0,
    params: {}
  });
});

// Media Type Matching Tests
test("matchesMediaType - exact match", () => {
  expect(matchesMediaType("text/html", "text/html")).toBe(true);
  expect(matchesMediaType("text/html", "text/plain")).toBe(false);
});

test("matchesMediaType - wildcard matching", () => {
  expect(matchesMediaType("text/html", "*/*")).toBe(true);
  expect(matchesMediaType("text/html", "text/*")).toBe(true);
  expect(matchesMediaType("text/html", "application/*")).toBe(false);
});

test("matchesMediaType - case insensitive", () => {
  expect(matchesMediaType("TEXT/HTML", "text/html")).toBe(true);
  expect(matchesMediaType("text/html", "TEXT/HTML")).toBe(true);
});

// Content Type Negotiation Tests
test("negotiateContentType - finds best match", () => {
  const result = negotiateContentType(
    "text/html,application/json;q=0.9,*/*;q=0.8",
    ["application/json", "text/xml"]
  );
  
  expect(result).toBe("application/json");
});

test("negotiateContentType - respects quality values", () => {
  const result = negotiateContentType(
    "application/json;q=0.5,text/html;q=0.9",
    ["text/html", "application/json"]
  );
  
  expect(result).toBe("text/html");
});

test("negotiateContentType - handles no match", () => {
  const result = negotiateContentType(
    "text/html",
    ["application/json", "text/xml"]
  );
  
  expect(result).toBeNull();
});

test("negotiateContentType - handles empty accept header", () => {
  const result = negotiateContentType(
    "",
    ["application/json", "text/html"]
  );
  
  expect(result).toBe("application/json");
});

// Charset Negotiation Tests
test("negotiateCharset - finds exact match", () => {
  const result = negotiateCharset(
    "utf-8,iso-8859-1;q=0.9",
    ["utf-8", "iso-8859-1"]
  );
  
  expect(result).toBe("utf-8");
});

test("negotiateCharset - handles wildcard", () => {
  const result = negotiateCharset(
    "*,utf-8;q=0.9",
    ["iso-8859-1", "utf-8"]
  );
  
  expect(result).toBe("iso-8859-1");
});

test("negotiateCharset - case insensitive", () => {
  const result = negotiateCharset(
    "UTF-8",
    ["utf-8", "iso-8859-1"]
  );
  
  expect(result).toBe("utf-8");
});

// Encoding Negotiation Tests
test("negotiateEncoding - finds best match", () => {
  const result = negotiateEncoding(
    "gzip,deflate;q=0.9",
    ["gzip", "deflate", "br"]
  );
  
  expect(result).toBe("gzip");
});

test("negotiateEncoding - handles identity", () => {
  const result = negotiateEncoding(
    "gzip;q=0.5,identity;q=0.9",
    ["identity", "gzip"]
  );
  
  expect(result).toBe("identity");
});

// Language Negotiation Tests
test("negotiateLanguage - finds exact match", () => {
  const result = negotiateLanguage(
    "en-US,en;q=0.9,fr;q=0.8",
    ["en-US", "fr", "de"]
  );
  
  expect(result).toBe("en-US");
});

test("negotiateLanguage - handles prefix matching", () => {
  const result = negotiateLanguage(
    "en,fr;q=0.9",
    ["en-US", "fr-FR"]
  );
  
  expect(result).toBe("en-US");
});

test("negotiateLanguage - respects quality values", () => {
  const result = negotiateLanguage(
    "en;q=0.5,fr;q=0.9",
    ["en-US", "fr-FR"]
  );
  
  expect(result).toBe("fr-FR");
});

// Request Enhancement Tests
test("enhanceRequestWithContentNegotiation - adds accepts method", () => {
  const req = createMockRequest({
    'accept': 'text/html,application/json;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  expect(req.accepts).toBeDefined();
  expect(req.accepts!(["application/json", "text/xml"])).toBe("application/json");
});

test("enhanceRequestWithContentNegotiation - adds acceptsCharsets method", () => {
  const req = createMockRequest({
    'accept-charset': 'utf-8,iso-8859-1;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  expect(req.acceptsCharsets).toBeDefined();
  expect(req.acceptsCharsets!(["utf-8", "iso-8859-1"])).toBe("utf-8");
});

test("enhanceRequestWithContentNegotiation - adds acceptsEncodings method", () => {
  const req = createMockRequest({
    'accept-encoding': 'gzip,deflate;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  expect(req.acceptsEncodings).toBeDefined();
  expect(req.acceptsEncodings!(["gzip", "deflate"])).toBe("gzip");
});

test("enhanceRequestWithContentNegotiation - adds acceptsLanguages method", () => {
  const req = createMockRequest({
    'accept-language': 'en-US,en;q=0.9,fr;q=0.8'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  expect(req.acceptsLanguages).toBeDefined();
  expect(req.acceptsLanguages!(["en-US", "fr"])).toBe("en-US");
});

// Request Methods Without Parameters Tests
test("req.accepts() - returns all accepted types", () => {
  const req = createMockRequest({
    'accept': 'text/html,application/json;q=0.9,*/*;q=0.8'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  const result = req.accepts!();
  expect(Array.isArray(result)).toBe(true);
  expect(result).toEqual(["text/html", "application/json", "*/*"]);
});

test("req.acceptsCharsets() - returns all accepted charsets", () => {
  const req = createMockRequest({
    'accept-charset': 'utf-8,iso-8859-1;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  const result = req.acceptsCharsets!();
  expect(Array.isArray(result)).toBe(true);
  expect(result).toEqual(["utf-8", "iso-8859-1"]);
});

test("req.acceptsEncodings() - returns all accepted encodings", () => {
  const req = createMockRequest({
    'accept-encoding': 'gzip,deflate;q=0.9,br;q=0.8'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  const result = req.acceptsEncodings!();
  expect(Array.isArray(result)).toBe(true);
  expect(result).toEqual(["gzip", "deflate", "br"]);
});

test("req.acceptsLanguages() - returns all accepted languages", () => {
  const req = createMockRequest({
    'accept-language': 'en-US,en;q=0.9,fr;q=0.8'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  const result = req.acceptsLanguages!();
  expect(Array.isArray(result)).toBe(true);
  expect(result).toEqual(["en-US", "en", "fr"]);
});

// String Parameter Tests
test("req.accepts() - handles string parameter", () => {
  const req = createMockRequest({
    'accept': 'text/html,application/json;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  expect(req.accepts!("text/html")).toBe("text/html");
  expect(req.accepts!("application/xml")).toBeNull();
});

test("req.acceptsCharsets() - handles string parameter", () => {
  const req = createMockRequest({
    'accept-charset': 'utf-8,iso-8859-1;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  expect(req.acceptsCharsets!("utf-8")).toBe("utf-8");
  expect(req.acceptsCharsets!("ascii")).toBeNull();
});

// Utility Functions Tests
test("respondWithBestFormat - chooses best format", () => {
  const req = createMockRequest({
    'accept': 'application/json,text/html;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  const data = { message: "Hello" };
  const formats = {
    'application/json': (data: any) => JSON.stringify(data),
    'text/html': (data: any) => `<h1>${data.message}</h1>`
  };
  
  const result = respondWithBestFormat(req, data, formats);
  
  expect(result.contentType).toBe("application/json");
  expect(result.content).toBe('{"message":"Hello"}');
});

test("respondWithLanguage - chooses best language", () => {
  const req = createMockRequest({
    'accept-language': 'fr,en;q=0.9'
  });
  
  enhanceRequestWithContentNegotiation(req);
  
  const translations = {
    'en': { message: "Hello" },
    'fr': { message: "Bonjour" },
    'es': { message: "Hola" }
  };
  
  const result = respondWithLanguage(req, translations);
  
  expect(result.language).toBe("fr");
  expect(result.content).toEqual({ message: "Bonjour" });
});

// Constants Tests
test("MIME_TYPES - contains common types", () => {
  expect(MIME_TYPES.HTML).toBe("text/html");
  expect(MIME_TYPES.JSON).toBe("application/json");
  expect(MIME_TYPES.XML).toBe("application/xml");
  expect(MIME_TYPES.PDF).toBe("application/pdf");
});

test("CHARSETS - contains common charsets", () => {
  expect(CHARSETS.UTF8).toBe("utf-8");
  expect(CHARSETS.UTF16).toBe("utf-16");
  expect(CHARSETS.ISO_8859_1).toBe("iso-8859-1");
});

test("ENCODINGS - contains common encodings", () => {
  expect(ENCODINGS.GZIP).toBe("gzip");
  expect(ENCODINGS.DEFLATE).toBe("deflate");
  expect(ENCODINGS.BROTLI).toBe("br");
});

test("LANGUAGES - contains common languages", () => {
  expect(LANGUAGES.EN).toBe("en");
  expect(LANGUAGES.EN_US).toBe("en-US");
  expect(LANGUAGES.FR).toBe("fr");
  expect(LANGUAGES.ES).toBe("es");
});

// Edge Cases Tests
test("parseAccept - handles quoted parameters", () => {
  const result = parseAccept('text/html;charset="utf-8";q=0.9');
  
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({ 
    value: "text/html", 
    quality: 0.9, 
    params: { charset: "utf-8" } 
  });
});

test("negotiateContentType - handles complex accept header", () => {
  const result = negotiateContentType(
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    ["application/json", "text/plain", "image/webp"]
  );
  
  expect(result).toBe("image/webp");
});

test("negotiateLanguage - handles complex language preferences", () => {
  const result = negotiateLanguage(
    "en-US,en;q=0.9,fr-CA;q=0.8,fr;q=0.7",
    ["en-GB", "fr-FR", "de-DE"]
  );
  
  expect(result).toBe("en-GB"); // Should match en prefix
});

test("enhanceRequestWithContentNegotiation - handles missing headers", () => {
  const req = createMockRequest({});
  
  enhanceRequestWithContentNegotiation(req);
  
  expect(req.accepts!(["text/html"])).toBe("text/html");
  expect(req.acceptsCharsets!(["utf-8"])).toBe("utf-8");
  expect(req.acceptsEncodings!(["gzip"])).toBe("gzip");
  expect(req.acceptsLanguages!(["en"])).toBe("en");
});