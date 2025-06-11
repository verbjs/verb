import { notFound } from "./response.ts";
import type { Handler } from "./types.ts";

/**
 * Configuration options for static file serving
 */
interface StaticOptions {
  /** Root directory to serve files from */
  root: string;
  /** Index file(s) to serve for directory requests (default: ["index.html"]) */
  index?: string | string[];
  /** How to handle dotfiles (default: "deny") */
  dotfiles?: "allow" | "deny";
  /** Extensions to try if file not found (e.g., [".html"]) */
  extensions?: string[];
  /** Cache max-age in seconds (default: 0) */
  maxAge?: number;
  /** Add immutable directive to Cache-Control */
  immutable?: boolean;
  /** Enable ETag generation (default: true) */
  etag?: boolean;
}

/**
 * MIME type mappings for common file extensions
 * @private
 */
const MIME_TYPES: Record<string, string> = {
  // Text
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",

  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",

  // Fonts
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",

  // Media
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",

  // Documents
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
};

/**
 * Gets MIME type for a file path based on extension
 * @param path - File path
 * @returns MIME type string
 * @private
 */
const getMimeType = (path: string): string => {
  const ext = path.match(/\.[^.]+$/)?.[0];
  return ext ? MIME_TYPES[ext] || "application/octet-stream" : "application/octet-stream";
};

/**
 * Normalizes a file path by removing extra slashes
 * @param path - Path to normalize
 * @returns Normalized path
 * @private
 */
const normalizePath = (path: string): string => {
  // Remove leading slash and normalize
  return path.replace(/^\/+/, "").replace(/\/+/g, "/");
};

/**
 * Checks if a path is safe (no directory traversal)
 * @param path - Path to check
 * @returns true if path is safe
 * @private
 */
const isPathSafe = (path: string): boolean => {
  // Prevent directory traversal
  const normalized = normalizePath(path);
  return !normalized.includes("..") && !normalized.includes("./");
};

/**
 * Creates a static file serving handler with comprehensive options
 * @param options - Static file serving configuration
 * @returns Handler function for serving static files
 * @example
 * ```ts
 * // Serve files from ./public directory
 * app.get("/static/*", serveStatic({
 *   root: "./public",
 *   index: ["index.html", "index.htm"],
 *   maxAge: 3600, // 1 hour cache
 *   etag: true
 * }));
 * ```
 */
export const serveStatic = (options: StaticOptions): Handler => {
  const {
    root,
    index = ["index.html"],
    dotfiles = "deny",
    extensions = [],
    maxAge = 0,
    immutable = false,
    etag = true,
  } = options;

  const indexFiles = Array.isArray(index) ? index : [index];

  return async (req, params) => {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Get the path from wildcard or direct path
    if (params["*"]) {
      pathname = params["*"];
    }

    // Security check
    if (!isPathSafe(pathname)) {
      return notFound();
    }

    // Check dotfiles
    if (dotfiles === "deny" && pathname.split("/").some((part) => part.startsWith("."))) {
      return notFound();
    }

    const normalizedPath = normalizePath(pathname);
    let filePath = `${root}/${normalizedPath}`;

    try {
      let file = Bun.file(filePath);
      let exists = await file.exists();

      // Try index files for directories
      if (!exists && !filePath.match(/\.[^.]+$/)) {
        for (const indexFile of indexFiles) {
          const indexPath = `${filePath}/${indexFile}`.replace(/\/+/g, "/");
          const indexFileObj = Bun.file(indexPath);
          if (await indexFileObj.exists()) {
            file = indexFileObj;
            filePath = indexPath;
            exists = true;
            break;
          }
        }
      }

      // Try extensions
      if (!exists && extensions.length > 0) {
        for (const ext of extensions) {
          const extPath = `${filePath}${ext}`;
          const extFile = Bun.file(extPath);
          if (await extFile.exists()) {
            file = extFile;
            filePath = extPath;
            exists = true;
            break;
          }
        }
      }

      if (!exists) {
        return notFound();
      }

      // Handle conditional requests
      if (etag && req.headers.get("if-none-match")) {
        const fileEtag = `"${file.size}-${file.lastModified}"`;
        if (req.headers.get("if-none-match") === fileEtag) {
          return new Response(null, { status: 304 });
        }
      }

      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": getMimeType(filePath),
        "Content-Length": file.size.toString(),
      };

      // Cache control
      if (maxAge > 0) {
        const cacheControl = immutable
          ? `public, max-age=${maxAge}, immutable`
          : `public, max-age=${maxAge}`;
        headers["Cache-Control"] = cacheControl;
      }

      // ETag
      if (etag) {
        headers.ETag = `"${file.size}-${file.lastModified}"`;
      }

      // Last-Modified
      headers["Last-Modified"] = new Date(file.lastModified).toUTCString();

      return new Response(file, { headers });
    } catch (_err) {
      return notFound();
    }
  };
};

/**
 * Convenience function for serving static files with minimal configuration
 * @param root - Root directory to serve files from
 * @param options - Additional options (optional)
 * @returns Handler function for serving static files
 * @example
 * ```ts
 * // Simple usage
 * app.get("/*", staticFiles("./public"));
 *
 * // With options
 * app.get("/assets/*", staticFiles("./assets", {
 *   maxAge: 86400, // 1 day
 *   immutable: true
 * }));
 * ```
 */
export const staticFiles = (root: string, options?: Partial<StaticOptions>): Handler =>
  serveStatic({ root, ...options });
