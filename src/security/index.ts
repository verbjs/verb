import type { VerbRequest, VerbResponse } from "../types";

// Trust proxy configuration
export type TrustProxyOptions = {
  enabled?: boolean;
  trustedProxies?: string[]; // IP addresses or subnets
  trustAll?: boolean; // Trust all proxies (not recommended for production)
};

// Rate limiting configuration
export type RateLimitOptions = {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Maximum requests per window
  message?: string; // Error message
  standardHeaders?: boolean; // Return rate limit info in headers
  legacyHeaders?: boolean; // Return rate limit info in legacy X-RateLimit headers
  keyGenerator?: (req: VerbRequest) => string; // Generate rate limit key
  skipFailedRequests?: boolean; // Don't count failed requests
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  onLimitReached?: (req: VerbRequest, res: VerbResponse) => void; // Callback when limit is reached
};

// CORS configuration
export type CORSOptions = {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number; // Preflight cache time
  optionsSuccessStatus?: number; // Status code for successful OPTIONS requests
};

// Security headers configuration
export type SecurityHeadersOptions = {
  contentSecurityPolicy?: string | false;
  dnsPrefetchControl?: boolean;
  frameguard?: { action: "deny" | "sameorigin" | "allowfrom"; domain?: string } | false;
  hidePoweredBy?: boolean;
  hsts?: { maxAge?: number; includeSubDomains?: boolean; preload?: boolean } | false;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: string | false;
  referrerPolicy?: string | false;
  xssFilter?: boolean;
};

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Trust proxy middleware - Enhanced handling of X-Forwarded headers
 */
export const trustProxy = (options: TrustProxyOptions = {}) => {
  const { enabled = true, trustedProxies = [], trustAll = false } = options;

  return (req: VerbRequest, _res: VerbResponse, next: () => void) => {
    if (!enabled) {
      return next();
    }

    // If not trusting all proxies, validate the proxy
    if (!trustAll && trustedProxies.length > 0) {
      const clientIP = req.ip || "";
      const isProxyTrusted = trustedProxies.some((proxy) => {
        if (proxy.includes("/")) {
          // Handle CIDR notation (basic implementation)
          return clientIP.startsWith(proxy.split("/")[0]);
        }
        return clientIP === proxy;
      });

      if (!isProxyTrusted) {
        return next();
      }
    }

    // Extract protocol from X-Forwarded-Proto
    const forwardedProto = req.headers.get("x-forwarded-proto");
    if (forwardedProto) {
      (req as any).protocol = forwardedProto.split(",")[0].trim();
      (req as any).secure = (req as any).protocol === "https";
    }

    // Extract host from X-Forwarded-Host
    const forwardedHost = req.headers.get("x-forwarded-host");
    if (forwardedHost) {
      (req as any).hostname = forwardedHost.split(",")[0].trim();
    }

    // Extract port from X-Forwarded-Port
    const forwardedPort = req.headers.get("x-forwarded-port");
    if (forwardedPort) {
      (req as any).port = parseInt(forwardedPort.split(",")[0].trim(), 10);
    }

    next();
  };
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (options: RateLimitOptions = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // 100 requests per window
    message = "Too many requests from this IP, please try again later.",
    standardHeaders = true,
    legacyHeaders = false,
    keyGenerator = (req: VerbRequest) => req.ip || "unknown",
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    onLimitReached,
  } = options;

  return (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Clean expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k);
      }
    }

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= max) {
      if (standardHeaders) {
        res.header("RateLimit-Limit", max.toString());
        res.header("RateLimit-Remaining", "0");
        res.header("RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());
      }

      if (legacyHeaders) {
        res.header("X-RateLimit-Limit", max.toString());
        res.header("X-RateLimit-Remaining", "0");
        res.header("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());
      }

      if (onLimitReached) {
        onLimitReached(req, res);
      }

      return res.status(429).json({ error: message });
    }

    // Increment counter
    entry.count++;

    // Set headers
    const remaining = Math.max(0, max - entry.count);
    if (standardHeaders) {
      res.header("RateLimit-Limit", max.toString());
      res.header("RateLimit-Remaining", remaining.toString());
      res.header("RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());
    }

    if (legacyHeaders) {
      res.header("X-RateLimit-Limit", max.toString());
      res.header("X-RateLimit-Remaining", remaining.toString());
      res.header("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());
    }

    // Hook into response to potentially skip counting
    const originalJson = res.json;
    const originalSend = res.send;

    res.json = function (data: any) {
      const statusCode = res.statusCode || 200;
      if (skipSuccessfulRequests && statusCode < 400) {
        entry.count--;
      } else if (skipFailedRequests && statusCode >= 400) {
        entry.count--;
      }
      return originalJson.call(this, data);
    };

    res.send = function (data: any) {
      const statusCode = res.statusCode || 200;
      if (skipSuccessfulRequests && statusCode < 400) {
        entry.count--;
      } else if (skipFailedRequests && statusCode >= 400) {
        entry.count--;
      }
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * CORS middleware
 */
export const cors = (options: CORSOptions = {}) => {
  const {
    origin = "*",
    methods = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400, // 24 hours
    optionsSuccessStatus = 204,
  } = options;

  return (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const requestOrigin = req.headers.get("origin") || "";

    // Determine if origin is allowed
    let allowedOrigin: string | null = null;
    if (origin === true) {
      allowedOrigin = requestOrigin;
    } else if (origin === false) {
      allowedOrigin = null;
    } else if (typeof origin === "string") {
      allowedOrigin = origin;
    } else if (Array.isArray(origin)) {
      allowedOrigin = origin.includes(requestOrigin) ? requestOrigin : null;
    } else if (typeof origin === "function") {
      allowedOrigin = origin(requestOrigin) ? requestOrigin : null;
    }

    // Set CORS headers
    if (allowedOrigin) {
      res.header("Access-Control-Allow-Origin", allowedOrigin);
    }

    if (credentials) {
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (exposedHeaders.length > 0) {
      res.header("Access-Control-Expose-Headers", exposedHeaders.join(", "));
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.header("Access-Control-Allow-Methods", methods.join(", "));
      res.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
      res.header("Access-Control-Max-Age", maxAge.toString());

      return res.status(optionsSuccessStatus).end();
    }

    next();
  };
};

/**
 * Security headers middleware (Helmet-like functionality)
 */
export const securityHeaders = (options: SecurityHeadersOptions = {}) => {
  const {
    contentSecurityPolicy = "default-src 'self'",
    dnsPrefetchControl = true,
    frameguard = { action: "deny" },
    hidePoweredBy = true,
    hsts = { maxAge: 31536000, includeSubDomains: true }, // 1 year
    ieNoOpen = true,
    noSniff = true,
    originAgentCluster = true,
    permittedCrossDomainPolicies = "none",
    referrerPolicy = "no-referrer",
    xssFilter = true,
  } = options;

  return (_req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Content Security Policy
    if (contentSecurityPolicy) {
      res.header("Content-Security-Policy", contentSecurityPolicy);
    }

    // DNS Prefetch Control
    if (dnsPrefetchControl) {
      res.header("X-DNS-Prefetch-Control", "off");
    }

    // Frame Options
    if (frameguard) {
      if (frameguard.action === "deny") {
        res.header("X-Frame-Options", "DENY");
      } else if (frameguard.action === "sameorigin") {
        res.header("X-Frame-Options", "SAMEORIGIN");
      } else if (frameguard.action === "allowfrom" && frameguard.domain) {
        res.header("X-Frame-Options", `ALLOW-FROM ${frameguard.domain}`);
      }
    }

    // Hide Powered By
    if (hidePoweredBy) {
      res.header("X-Powered-By", "");
    }

    // HTTP Strict Transport Security
    if (hsts) {
      let hstsValue = `max-age=${hsts.maxAge || 31536000}`;
      if (hsts.includeSubDomains) {
        hstsValue += "; includeSubDomains";
      }
      if (hsts.preload) {
        hstsValue += "; preload";
      }
      res.header("Strict-Transport-Security", hstsValue);
    }

    // IE No Open
    if (ieNoOpen) {
      res.header("X-Download-Options", "noopen");
    }

    // MIME Type Sniffing
    if (noSniff) {
      res.header("X-Content-Type-Options", "nosniff");
    }

    // Origin Agent Cluster
    if (originAgentCluster) {
      res.header("Origin-Agent-Cluster", "?1");
    }

    // Permitted Cross Domain Policies
    if (permittedCrossDomainPolicies) {
      res.header("X-Permitted-Cross-Domain-Policies", permittedCrossDomainPolicies);
    }

    // Referrer Policy
    if (referrerPolicy) {
      res.header("Referrer-Policy", referrerPolicy);
    }

    // XSS Filter
    if (xssFilter) {
      res.header("X-XSS-Protection", "1; mode=block");
    }

    next();
  };
};

// Utility function to create a comprehensive security middleware stack
export const createSecurityMiddleware = (
  options: {
    trustProxy?: TrustProxyOptions;
    rateLimit?: RateLimitOptions;
    cors?: CORSOptions;
    securityHeaders?: SecurityHeadersOptions;
  } = {},
) => {
  const middlewares = [];

  if (options.trustProxy) {
    middlewares.push(trustProxy(options.trustProxy));
  }

  if (options.securityHeaders) {
    middlewares.push(securityHeaders(options.securityHeaders));
  }

  if (options.cors) {
    middlewares.push(cors(options.cors));
  }

  if (options.rateLimit) {
    middlewares.push(rateLimit(options.rateLimit));
  }

  return middlewares;
};

// Export common presets
export const securityPresets = {
  // Basic security for development
  development: () =>
    createSecurityMiddleware({
      cors: { origin: true, credentials: true },
      securityHeaders: {
        contentSecurityPolicy: "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        hsts: false,
      },
    }),

  // Production security
  production: () =>
    createSecurityMiddleware({
      trustProxy: { enabled: true },
      rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
      cors: { origin: false },
      securityHeaders: {
        contentSecurityPolicy: "default-src 'self'",
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      },
    }),

  // API-focused security
  api: () =>
    createSecurityMiddleware({
      trustProxy: { enabled: true },
      rateLimit: { windowMs: 15 * 60 * 1000, max: 1000 },
      cors: { origin: true, credentials: true },
      securityHeaders: {
        contentSecurityPolicy: false, // Not needed for API
        frameguard: false,
      },
    }),
};
