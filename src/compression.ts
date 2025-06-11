import type { Middleware } from "./types.ts";

/**
 * Configuration options for compression middleware
 */
interface CompressionOptions {
  /** Compression level (1-9, where 9 is highest compression) */
  level?: number;
  /** Minimum response size to compress (bytes) */
  threshold?: number;
  /** Compression algorithms to support */
  algorithms?: ("gzip" | "deflate")[];
  /** Content types to compress */
  contentTypes?: string[];
  /** Whether to compress if no Accept-Encoding header is present */
  compressDefault?: boolean;
}

/**
 * Default content types that should be compressed
 */
const DEFAULT_COMPRESSIBLE_TYPES = [
  "text/plain",
  "text/html",
  "text/css",
  "text/xml",
  "text/javascript",
  "application/javascript",
  "application/json",
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
  "image/svg+xml",
];

/**
 * Determines the best compression algorithm based on Accept-Encoding header
 * @param acceptEncoding - Accept-Encoding header value
 * @param algorithms - Supported algorithms
 * @returns Best algorithm or null if none supported
 */
const getBestEncoding = (
  acceptEncoding: string | null,
  algorithms: string[],
): "gzip" | "deflate" | null => {
  if (!acceptEncoding) {
    return null;
  }

  const encodings = acceptEncoding.split(",").map((enc) => enc.trim().toLowerCase());

  // Check for specific algorithms in order of preference
  if (algorithms.includes("gzip") && encodings.some((enc) => enc.includes("gzip"))) {
    return "gzip";
  }
  if (algorithms.includes("deflate") && encodings.some((enc) => enc.includes("deflate"))) {
    return "deflate";
  }

  return null;
};

/**
 * Checks if a content type should be compressed
 * @param contentType - Content-Type header value
 * @param compressibleTypes - Array of compressible types
 * @returns True if content type should be compressed
 */
const shouldCompress = (contentType: string | null, compressibleTypes: string[]): boolean => {
  if (!contentType) {
    return false;
  }

  const type = contentType.split(";")[0].trim().toLowerCase();
  return compressibleTypes.includes(type);
};

/**
 * Compresses data using the specified algorithm
 * @param data - Data to compress
 * @param algorithm - Compression algorithm
 * @param level - Compression level (1-9, where 9 is highest compression)
 * @returns Compressed data
 */
const compressData = async (
  data: ArrayBuffer,
  algorithm: "gzip" | "deflate",
  level = 6,
): Promise<ArrayBuffer> => {
  const uint8Data = new Uint8Array(data);

  // Ensure level is within valid range for Bun's compression
  const validLevel = Math.max(-1, Math.min(9, level)) as -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

  const options = {
    level: validLevel,
  };

  let compressed: Uint8Array;

  if (algorithm === "gzip") {
    compressed = Bun.gzipSync(uint8Data, options);
  } else {
    compressed = Bun.deflateSync(uint8Data, options);
  }

  // Convert to proper ArrayBuffer
  const result = new ArrayBuffer(compressed.byteLength);
  new Uint8Array(result).set(compressed);
  return result;
};

/**
 * Creates compression middleware for automatic response compression
 * @param options - Compression configuration options
 * @returns Middleware function that compresses responses
 * @example
 * ```ts
 * // Basic compression
 * app.use(compression());
 *
 * // With custom options
 * app.use(compression({
 *   level: 9,
 *   threshold: 1024,
 *   algorithms: ["br", "gzip"],
 *   contentTypes: ["text/html", "application/json"]
 * }));
 * ```
 */
export const compression = (options: CompressionOptions = {}): Middleware => {
  const {
    level = 6,
    threshold = 1024,
    algorithms = ["gzip", "deflate"],
    contentTypes = DEFAULT_COMPRESSIBLE_TYPES,
    compressDefault = false,
  } = options;

  return async (req, next) => {
    const response = await next();

    // Skip compression for certain responses
    if (response.status < 200 || response.status >= 300) {
      return response;
    }

    // Check if already compressed
    if (response.headers.get("Content-Encoding")) {
      return response;
    }

    // Check Accept-Encoding header
    const acceptEncoding = req.headers.get("Accept-Encoding");
    if (!acceptEncoding && !compressDefault) {
      return response;
    }

    // Determine best encoding
    const encoding = getBestEncoding(acceptEncoding, algorithms);
    if (!encoding) {
      return response;
    }

    // Check content type
    const contentType = response.headers.get("Content-Type");
    if (!shouldCompress(contentType, contentTypes)) {
      return response;
    }

    // Get response body
    const body = await response.arrayBuffer();

    // Check size threshold
    if (body.byteLength < threshold) {
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    try {
      // Compress the response
      const compressedBody = await compressData(body, encoding, level);

      // Create new headers
      const headers = new Headers(response.headers);
      headers.set("Content-Encoding", encoding);
      headers.set("Content-Length", compressedBody.byteLength.toString());
      headers.set("Vary", "Accept-Encoding");

      // Remove Content-Length if it was set for original body
      if (response.headers.has("Content-Length")) {
        headers.set("Content-Length", compressedBody.byteLength.toString());
      }

      return new Response(compressedBody, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      // Fall back to uncompressed response on error
      console.warn("Compression failed:", error);
      return response;
    }
  };
};

/**
 * Convenience function for gzip-only compression
 * @param level - Compression level (1-9)
 * @param threshold - Minimum size to compress (bytes)
 * @returns Gzip compression middleware
 */
export const gzip = (level = 6, threshold = 1024): Middleware =>
  compression({
    level,
    threshold,
    algorithms: ["gzip"],
  });

/**
 * Convenience function for deflate-only compression
 * @param level - Compression level (1-9)
 * @param threshold - Minimum size to compress (bytes)
 * @returns Deflate compression middleware
 */
export const deflate = (level = 6, threshold = 1024): Middleware =>
  compression({
    level,
    threshold,
    algorithms: ["deflate"],
  });

/**
 * Creates compression middleware with aggressive settings for production
 * @returns High-compression middleware for production use
 */
export const productionCompression = (): Middleware =>
  compression({
    level: 9,
    threshold: 512,
    algorithms: ["gzip", "deflate"],
    contentTypes: [...DEFAULT_COMPRESSIBLE_TYPES, "application/wasm", "font/woff", "font/woff2"],
  });

/**
 * Creates compression middleware with fast settings for development
 * @returns Low-compression middleware for development use
 */
export const developmentCompression = (): Middleware =>
  compression({
    level: 1,
    threshold: 2048,
    algorithms: ["gzip"],
  });
