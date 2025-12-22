// High-performance header parsing utilities
// Optimized for common header patterns and Bun's performance

export interface ParsedHeaders {
  [key: string]: string | string[] | undefined;
}

export interface HeaderParseOptions {
  caseSensitive?: boolean;
  allowDuplicates?: boolean;
  maxHeaders?: number;
}

// Fast header parsing with minimal allocations
export const parseHeaders = (headers: Headers, options: HeaderParseOptions = {}): ParsedHeaders => {
  const { caseSensitive = false, allowDuplicates = false, maxHeaders = 100 } = options;

  const parsed: ParsedHeaders = {};
  let headerCount = 0;

  for (const [key, value] of headers) {
    // Safety check for DoS protection
    if (headerCount >= maxHeaders) {
      break;
    }

    const normalizedKey = caseSensitive ? key : key.toLowerCase();

    if (allowDuplicates && parsed[normalizedKey]) {
      // Handle duplicate headers
      const existing = parsed[normalizedKey];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        parsed[normalizedKey] = [existing as string, value];
      }
    } else {
      parsed[normalizedKey] = value;
    }

    headerCount++;
  }

  return parsed;
};

// Optimized header getter with caching
const headerCache = new Map<string, string | undefined>();
let cacheEnabled = true;

export const getHeader = (headers: Headers, name: string, useCache = true): string | undefined => {
  const cacheKey = `${name.toLowerCase()}`;

  if (useCache && cacheEnabled && headerCache.has(cacheKey)) {
    return headerCache.get(cacheKey);
  }

  const value = headers.get(name);

  if (useCache && cacheEnabled) {
    headerCache.set(cacheKey, value || undefined);
  }

  return value || undefined;
};

// Fast content-type parsing
export const parseContentType = (
  contentType: string,
): {
  type: string;
  subtype: string;
  charset?: string;
  boundary?: string;
  parameters: Record<string, string>;
} => {
  const [mediaType, ...params] = contentType.split(";");
  const [type, subtype] = mediaType.trim().split("/");

  const parameters: Record<string, string> = {};
  let charset: string | undefined;
  let boundary: string | undefined;

  for (const param of params) {
    const [key, value] = param.trim().split("=");
    if (key && value) {
      const cleanValue = value.replace(/^["']|["']$/g, ""); // Remove quotes
      parameters[key.toLowerCase()] = cleanValue;

      // Extract common parameters
      if (key.toLowerCase() === "charset") {
        charset = cleanValue;
      } else if (key.toLowerCase() === "boundary") {
        boundary = cleanValue;
      }
    }
  }

  return {
    type: type.toLowerCase(),
    subtype: subtype.toLowerCase(),
    charset,
    boundary,
    parameters,
  };
};

// Fast Accept header parsing
export const parseAccept = (
  acceptHeader: string,
): Array<{
  type: string;
  subtype: string;
  quality: number;
  parameters: Record<string, string>;
}> => {
  if (!acceptHeader) {
    return [];
  }

  const types = acceptHeader.split(",");
  const parsed: Array<{
    type: string;
    subtype: string;
    quality: number;
    parameters: Record<string, string>;
  }> = [];

  for (const type of types) {
    const [mediaType, ...params] = type.trim().split(";");
    const [mainType, subType] = mediaType.split("/");

    let quality = 1.0;
    const parameters: Record<string, string> = {};

    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key && value) {
        if (key === "q") {
          quality = parseFloat(value) || 1.0;
        } else {
          parameters[key] = value;
        }
      }
    }

    parsed.push({
      type: mainType.trim().toLowerCase(),
      subtype: subType.trim().toLowerCase(),
      quality,
      parameters,
    });
  }

  // Sort by quality (highest first)
  return parsed.sort((a, b) => b.quality - a.quality);
};

// Fast Authorization header parsing
export const parseAuthorization = (
  authHeader: string,
): {
  scheme: string;
  token?: string;
  credentials?: string;
} | null => {
  if (!authHeader) {
    return null;
  }

  const spaceIndex = authHeader.indexOf(" ");
  if (spaceIndex === -1) {
    return { scheme: authHeader };
  }

  const scheme = authHeader.substring(0, spaceIndex).toLowerCase();
  const credentials = authHeader.substring(spaceIndex + 1);

  return {
    scheme,
    token: credentials,
    credentials,
  };
};

// Fast Cookie header parsing
export const parseCookies = (cookieHeader: string): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const equalIndex = pair.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const name = pair.substring(0, equalIndex).trim();
    const value = pair.substring(equalIndex + 1).trim();

    // Remove quotes if present
    const cleanValue = value.replace(/^["']|["']$/g, "");
    cookies[name] = cleanValue;
  }

  return cookies;
};

// Fast Range header parsing
export const parseRange = (
  rangeHeader: string,
): Array<{
  start: number;
  end?: number;
}> | null => {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const rangeSpec = rangeHeader.substring(6); // Remove 'bytes='
  const ranges = rangeSpec.split(",");
  const parsed: Array<{ start: number; end?: number }> = [];

  for (const range of ranges) {
    const [start, end] = range.trim().split("-");

    if (start && end) {
      parsed.push({
        start: parseInt(start, 10),
        end: parseInt(end, 10),
      });
    } else if (start) {
      parsed.push({
        start: parseInt(start, 10),
      });
    } else if (end) {
      // Suffix range
      parsed.push({
        start: -parseInt(end, 10),
      });
    }
  }

  return parsed.length > 0 ? parsed : null;
};

// Header cache management
export const clearHeaderCache = (): void => {
  headerCache.clear();
};

export const enableHeaderCache = (enabled: boolean): void => {
  cacheEnabled = enabled;
  if (!enabled) {
    headerCache.clear();
  }
};

export const getHeaderCacheStats = (): {
  size: number;
  enabled: boolean;
} => {
  return {
    size: headerCache.size,
    enabled: cacheEnabled,
  };
};

// Common header name constants for performance
export const HEADER_NAMES = {
  ACCEPT: "accept",
  ACCEPT_CHARSET: "accept-charset",
  ACCEPT_ENCODING: "accept-encoding",
  ACCEPT_LANGUAGE: "accept-language",
  AUTHORIZATION: "authorization",
  CACHE_CONTROL: "cache-control",
  CONTENT_LENGTH: "content-length",
  CONTENT_TYPE: "content-type",
  COOKIE: "cookie",
  HOST: "host",
  RANGE: "range",
  USER_AGENT: "user-agent",
  X_FORWARDED_FOR: "x-forwarded-for",
  X_FORWARDED_PROTO: "x-forwarded-proto",
  X_REAL_IP: "x-real-ip",
} as const;

// Fast header validation
export const isValidHeaderName = (name: string): boolean => {
  // HTTP header names can contain: letters, digits, hyphens
  return /^[a-zA-Z0-9-]+$/.test(name);
};

export const isValidHeaderValue = (value: string): boolean => {
  // HTTP header values cannot contain control characters except tab
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional for header validation
  return !/[\x00-\x08\x0A-\x1F\x7F]/.test(value);
};
