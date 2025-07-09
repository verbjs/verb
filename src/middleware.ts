import type { Middleware, VerbRequest, VerbResponse } from "./types";
import {
  trustProxy,
  rateLimit,
  cors,
  securityHeaders,
  createSecurityMiddleware,
  securityPresets,
  type TrustProxyOptions,
  type RateLimitOptions,
  type CORSOptions,
  type SecurityHeadersOptions,
} from "./security";

// Static file serving middleware - similar to express.static()
export const staticFiles = (
  root: string,
  options: {
    maxAge?: number;
    dotfiles?: "allow" | "deny" | "ignore";
    etag?: boolean;
    extensions?: string[];
    fallthrough?: boolean;
    immutable?: boolean;
    index?: string | false;
    lastModified?: boolean;
    redirect?: boolean;
  } = {},
): Middleware => {
  const {
    maxAge = 0,
    dotfiles = "ignore",
    etag = true,
    extensions = [],
    fallthrough = true,
    immutable = false,
    index = "index.html",
    lastModified = true,
    redirect: _redirect = true,
  } = options;

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Only handle GET and HEAD requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    try {
      const url = new URL(req.url);
      const pathname = decodeURIComponent(url.pathname);

      // Handle dotfiles
      if (dotfiles === "deny" && pathname.includes("/.")) {
        res.status(403).text("Forbidden");
        return;
      }
      if (dotfiles === "ignore" && pathname.includes("/.")) {
        return next();
      }

      // For mounted middleware, we need to determine the mount path by checking
      // what prefix should be stripped. Since we don't have direct access to mount path,
      // we'll try to determine it by checking if the root is a subdirectory name
      // that matches part of the path
      let fileSubPath = pathname;

      // Try to guess the mount point by looking for common patterns
      const pathParts = pathname.split("/").filter((p) => p);
      if (pathParts.length > 0) {
        // If the first part of the path might be a mount point, try removing it
        const _possibleMount = `/${pathParts[0]}`;
        const withoutMount = `/${pathParts.slice(1).join("/")}`;

        // Try the path with the first part removed first
        fileSubPath = withoutMount || "/";
      }

      // Remove leading slash and construct file path
      const relativePath = fileSubPath.startsWith("/") ? fileSubPath.slice(1) : fileSubPath;
      let filePath = `${root}/${relativePath}`;

      // Handle directory requests
      if (filePath.endsWith("/") || !filePath.includes(".")) {
        if (index) {
          filePath = filePath.endsWith("/") ? `${filePath}${index}` : `${filePath}/${index}`;
        } else {
          return next();
        }
      }

      // Try file extensions if not found
      let file = Bun.file(filePath);
      if (!(await file.exists()) && extensions.length > 0) {
        for (const ext of extensions) {
          const tryPath = `${filePath}.${ext}`;
          const tryFile = Bun.file(tryPath);
          if (await tryFile.exists()) {
            file = tryFile;
            filePath = tryPath;
            break;
          }
        }
      }

      // Check if file exists
      if (!(await file.exists())) {
        if (fallthrough) {
          return next();
        } else {
          res.status(404).text("Not Found");
          return;
        }
      }

      // Get file stats
      const stats = await file.stat();

      // Handle conditional requests (If-Modified-Since)
      const ifModifiedSince = req.headers.get("if-modified-since");
      if (ifModifiedSince && lastModified) {
        const modifiedSince = new Date(ifModifiedSince);
        const fileModified = new Date(stats.mtime);
        if (fileModified <= modifiedSince) {
          res.status(304).end();
          return;
        }
      }

      // Set headers
      const mimeType = getMimeType(filePath);
      res.header("Content-Type", mimeType);
      res.header("Content-Length", stats.size.toString());

      if (lastModified) {
        res.header("Last-Modified", new Date(stats.mtime).toUTCString());
      }

      if (etag) {
        // Simple ETag based on size and mtime
        const etagValue = `"${stats.size}-${stats.mtime.getTime()}"`;
        res.header("ETag", etagValue);

        // Handle If-None-Match
        const ifNoneMatch = req.headers.get("if-none-match");
        if (ifNoneMatch === etagValue) {
          res.status(304).end();
          return;
        }
      }

      if (maxAge > 0) {
        res.header("Cache-Control", `public, max-age=${maxAge}${immutable ? ", immutable" : ""}`);
      }

      // For HEAD requests, don't send body
      if (req.method === "HEAD") {
        res.end();
        return;
      }

      // Stream the file
      const arrayBuffer = await file.arrayBuffer();

      // We need to send raw data, so we'll use a special property
      (res as any)._rawData = arrayBuffer;
      (res as any)._isFile = true;
      (res as any)._finished = true;
    } catch (error) {
      console.error("Static file error:", error);
      if (fallthrough) {
        next();
      } else {
        res.status(500).text("Internal Server Error");
      }
    }
  };
};

// JSON body parsing middleware - similar to express.json()
export const json = (
  options: {
    limit?: string | number;
    strict?: boolean;
    type?: string | string[] | ((req: VerbRequest) => boolean);
    verify?: (req: VerbRequest, res: VerbResponse, buf: Buffer, encoding: string) => void;
  } = {},
): Middleware => {
  const { limit = "100kb", strict = true, type = "application/json", verify } = options;

  const sizeLimit = typeof limit === "string" ? parseSize(limit) : limit;

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Check content type
    const contentType = req.headers.get("content-type") || "";
    const shouldParse =
      typeof type === "function"
        ? type(req)
        : Array.isArray(type)
          ? type.some((t) => contentType.includes(t))
          : contentType.includes(type);

    if (!shouldParse) {
      return next();
    }

    try {
      const body = await req.text();

      // Check size limit
      if (sizeLimit && Buffer.byteLength(body, "utf8") > sizeLimit) {
        res.status(413).json({ error: "Payload too large" });
        return;
      }

      // Verify if provided
      if (verify) {
        const buf = Buffer.from(body, "utf8");
        verify(req, res, buf, "utf8");
      }

      // Parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch (_parseError) {
        res.status(400).json({ error: "Invalid JSON" });
        return;
      }

      // Strict mode check
      if (strict && typeof parsed !== "object") {
        res.status(400).json({ error: "JSON must be an object or array" });
        return;
      }

      // Add to request
      Object.defineProperty(req, "body", { value: parsed, writable: true, configurable: true });
      Object.defineProperty(req, "_bodyParsed", {
        value: true,
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      console.error("JSON parsing error:", error);
      res.status(400).json({ error: "Bad Request" });
    }
  };
};

// URL-encoded form data parsing middleware - similar to express.urlencoded()
export const urlencoded = (
  options: {
    extended?: boolean;
    limit?: string | number;
    parameterLimit?: number;
    type?: string | string[] | ((req: VerbRequest) => boolean);
    verify?: (req: VerbRequest, res: VerbResponse, buf: Buffer, encoding: string) => void;
  } = {},
): Middleware => {
  const {
    extended = true,
    limit = "100kb",
    parameterLimit = 1000,
    type = "application/x-www-form-urlencoded",
    verify,
  } = options;

  const sizeLimit = typeof limit === "string" ? parseSize(limit) : limit;

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Check content type
    const contentType = req.headers.get("content-type") || "";
    const shouldParse =
      typeof type === "function"
        ? type(req)
        : Array.isArray(type)
          ? type.some((t) => contentType.includes(t))
          : contentType.includes(type);

    if (!shouldParse) {
      return next();
    }

    try {
      const body = await req.text();

      // Check size limit
      if (sizeLimit && Buffer.byteLength(body, "utf8") > sizeLimit) {
        res.status(413).json({ error: "Payload too large" });
        return;
      }

      // Verify if provided
      if (verify) {
        const buf = Buffer.from(body, "utf8");
        verify(req, res, buf, "utf8");
      }

      // Parse URL-encoded data
      const parsed = parseUrlEncoded(body, extended, parameterLimit);

      // Add to request
      Object.defineProperty(req, "body", { value: parsed, writable: true, configurable: true });
      Object.defineProperty(req, "_bodyParsed", {
        value: true,
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      console.error("URL-encoded parsing error:", error);
      res.status(400).json({ error: "Bad Request" });
    }
  };
};

// Raw body parsing middleware - similar to express.raw()
export const raw = (
  options: {
    limit?: string | number;
    type?: string | string[] | ((req: VerbRequest) => boolean);
    verify?: (req: VerbRequest, res: VerbResponse, buf: Buffer, encoding: string) => void;
  } = {},
): Middleware => {
  const { limit = "100kb", type = "application/octet-stream", verify } = options;

  const sizeLimit = typeof limit === "string" ? parseSize(limit) : limit;

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Check content type
    const contentType = req.headers.get("content-type") || "";
    const shouldParse =
      typeof type === "function"
        ? type(req)
        : Array.isArray(type)
          ? type.some((t) => contentType.includes(t))
          : contentType.includes(type);

    if (!shouldParse) {
      return next();
    }

    try {
      const arrayBuffer = await req.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);

      // Check size limit
      if (sizeLimit && buf.length > sizeLimit) {
        res.status(413).json({ error: "Payload too large" });
        return;
      }

      // Verify if provided
      if (verify) {
        verify(req, res, buf, "binary");
      }

      // Add to request
      Object.defineProperty(req, "body", { value: buf, writable: true, configurable: true });
      Object.defineProperty(req, "_bodyParsed", {
        value: true,
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      console.error("Raw parsing error:", error);
      res.status(400).json({ error: "Bad Request" });
    }
  };
};

// Text body parsing middleware - similar to express.text()
export const text = (
  options: {
    limit?: string | number;
    type?: string | string[] | ((req: VerbRequest) => boolean);
    defaultCharset?: string;
    verify?: (req: VerbRequest, res: VerbResponse, buf: Buffer, encoding: string) => void;
  } = {},
): Middleware => {
  const {
    limit = "100kb",
    type = "text/plain",
    defaultCharset: _defaultCharset = "utf-8",
    verify,
  } = options;

  const sizeLimit = typeof limit === "string" ? parseSize(limit) : limit;

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Check content type
    const contentType = req.headers.get("content-type") || "";
    const shouldParse =
      typeof type === "function"
        ? type(req)
        : Array.isArray(type)
          ? type.some((t) => contentType.includes(t))
          : contentType.includes(type);

    if (!shouldParse) {
      return next();
    }

    try {
      const body = await req.text();

      // Check size limit
      if (sizeLimit && Buffer.byteLength(body, "utf8") > sizeLimit) {
        res.status(413).json({ error: "Payload too large" });
        return;
      }

      // Verify if provided
      if (verify) {
        const buf = Buffer.from(body, "utf8");
        verify(req, res, buf, "utf8");
      }

      // Add to request
      Object.defineProperty(req, "body", { value: body, writable: true, configurable: true });
      Object.defineProperty(req, "_bodyParsed", {
        value: true,
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      console.error("Text parsing error:", error);
      res.status(400).json({ error: "Bad Request" });
    }
  };
};

// Utility functions
function parseSize(size: string): number {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size: ${size}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2] || "b";

  return Math.floor(value * units[unit as keyof typeof units]);
}

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    mjs: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    txt: "text/plain",
    md: "text/markdown",
    xml: "application/xml",
    pdf: "application/pdf",
    zip: "application/zip",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
}

function parseUrlEncoded(body: string, extended: boolean, parameterLimit: number): any {
  const params = new URLSearchParams(body);
  const result: any = {};
  let paramCount = 0;

  for (const [key, value] of Array.from(params)) {
    if (++paramCount > parameterLimit) {
      throw new Error("Too many parameters");
    }

    if (extended) {
      // Extended mode supports nested objects and arrays
      setNestedValue(result, key, value);
    } else {
      // Simple mode - just key/value pairs
      if (result[key] !== undefined) {
        // Handle multiple values for same key
        if (Array.isArray(result[key])) {
          result[key].push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

function setNestedValue(obj: any, key: string, value: string) {
  // Handle array notation: key[0], key[1], etc.
  const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
  if (arrayMatch) {
    const [, baseKey, index] = arrayMatch;
    if (baseKey && index) {
      if (!obj[baseKey]) {
        obj[baseKey] = [];
      }
      obj[baseKey][parseInt(index)] = value;
    }
    return;
  }

  // Handle object notation: key[subkey]
  const objectMatch = key.match(/^(.+)\[(.+)\]$/);
  if (objectMatch) {
    const [, baseKey, subKey] = objectMatch;
    if (baseKey && subKey) {
      if (!obj[baseKey]) {
        obj[baseKey] = {};
      }
      setNestedValue(obj[baseKey], subKey, value);
    }
    return;
  }

  // Simple key
  obj[key] = value;
}

// Express.js compatibility aliases
export { staticFiles as static };

// Security middleware exports
export { trustProxy, rateLimit, cors, securityHeaders, createSecurityMiddleware, securityPresets };

// Security middleware types
export type { TrustProxyOptions, RateLimitOptions, CORSOptions, SecurityHeadersOptions };
