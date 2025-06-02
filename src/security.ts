import type { Middleware } from "./types.ts";
import { error } from "./response.ts";

/**
 * Security configuration options
 */
export interface SecurityOptions {
	/** Content Security Policy configuration */
	contentSecurityPolicy?: {
		enabled?: boolean;
		directives?: Record<string, string[]>;
	};
	/** Cross-Origin Embedder Policy */
	crossOriginEmbedderPolicy?: boolean;
	/** Cross-Origin Opener Policy */
	crossOriginOpenerPolicy?: boolean;
	/** Cross-Origin Resource Policy */
	crossOriginResourcePolicy?: "same-origin" | "same-site" | "cross-origin";
	/** Disable DNS prefetching */
	dnsPrefetchControl?: boolean;
	/** Frameguard (X-Frame-Options) */
	frameguard?: "deny" | "sameorigin" | false;
	/** Hide X-Powered-By header */
	hidePoweredBy?: boolean;
	/** HTTP Strict Transport Security */
	hsts?: {
		enabled?: boolean;
		maxAge?: number;
		includeSubDomains?: boolean;
		preload?: boolean;
	};
	/** IE No Open */
	ieNoOpen?: boolean;
	/** Don't sniff MIME types */
	noSniff?: boolean;
	/** Origin Agent Cluster */
	originAgentCluster?: boolean;
	/** Permittied Cross-Domain Policies */
	permittedCrossDomainPolicies?: boolean;
	/** Referrer Policy */
	referrerPolicy?:
		| "no-referrer"
		| "no-referrer-when-downgrade"
		| "origin"
		| "origin-when-cross-origin"
		| "same-origin"
		| "strict-origin"
		| "strict-origin-when-cross-origin"
		| "unsafe-url";
	/** X-XSS-Protection */
	xssFilter?: boolean;
}

/**
 * CSRF protection options
 */
export interface CSRFOptions {
	/** Token header name */
	tokenHeader?: string;
	/** Token query parameter name */
	tokenQuery?: string;
	/** Token body field name */
	tokenBody?: string;
	/** Session key for storing token */
	sessionKey?: string;
	/** Secret for token generation */
	secret?: string;
	/** Ignore GET, HEAD, OPTIONS methods */
	ignoreMethods?: string[];
	/** Custom token validator */
	validator?: (token: string, secret: string) => boolean;
}

/**
 * Input sanitization options
 */
export interface SanitizationOptions {
	/** Remove HTML tags */
	stripHtml?: boolean;
	/** Remove script tags */
	stripScripts?: boolean;
	/** Trim whitespace */
	trim?: boolean;
	/** Remove null bytes */
	removeNullBytes?: boolean;
	/** Convert to lowercase */
	toLowerCase?: boolean;
	/** Custom sanitizer function */
	custom?: (input: string) => string;
}

/**
 * Default security configuration
 */
const defaultSecurityOptions: SecurityOptions = {
	contentSecurityPolicy: {
		enabled: true,
		directives: {
			"default-src": ["'self'"],
			"base-uri": ["'self'"],
			"font-src": ["'self'", "https:", "data:"],
			"form-action": ["'self'"],
			"frame-ancestors": ["'self'"],
			"img-src": ["'self'", "data:"],
			"object-src": ["'none'"],
			"script-src": ["'self'"],
			"script-src-attr": ["'none'"],
			"style-src": ["'self'", "https:", "'unsafe-inline'"],
			"upgrade-insecure-requests": [],
		},
	},
	crossOriginEmbedderPolicy: true,
	crossOriginOpenerPolicy: true,
	crossOriginResourcePolicy: "same-origin",
	dnsPrefetchControl: true,
	frameguard: "deny",
	hidePoweredBy: true,
	hsts: {
		enabled: true,
		maxAge: 31536000, // 1 year
		includeSubDomains: true,
		preload: false,
	},
	ieNoOpen: true,
	noSniff: true,
	originAgentCluster: true,
	permittedCrossDomainPolicies: false,
	referrerPolicy: "no-referrer",
	xssFilter: true,
};

/**
 * Creates security headers middleware (helmet-style)
 */
export function securityHeaders(options: SecurityOptions = {}): Middleware {
	const config = { ...defaultSecurityOptions, ...options };

	return async (req: Request, next) => {
		const response = await next();
		const headers = new Headers(response.headers);

		// Content Security Policy
		if (config.contentSecurityPolicy?.enabled) {
			const directives = config.contentSecurityPolicy.directives!;
			const cspValue = Object.entries(directives)
				.map(([key, values]) => `${key} ${values.join(" ")}`)
				.join("; ");
			headers.set("Content-Security-Policy", cspValue);
		}

		// Cross-Origin Embedder Policy
		if (config.crossOriginEmbedderPolicy) {
			headers.set("Cross-Origin-Embedder-Policy", "require-corp");
		}

		// Cross-Origin Opener Policy
		if (config.crossOriginOpenerPolicy) {
			headers.set("Cross-Origin-Opener-Policy", "same-origin");
		}

		// Cross-Origin Resource Policy
		if (config.crossOriginResourcePolicy) {
			headers.set(
				"Cross-Origin-Resource-Policy",
				config.crossOriginResourcePolicy,
			);
		}

		// DNS Prefetch Control
		if (config.dnsPrefetchControl) {
			headers.set("X-DNS-Prefetch-Control", "off");
		}

		// Frameguard
		if (config.frameguard) {
			headers.set("X-Frame-Options", config.frameguard.toUpperCase());
		}

		// Hide X-Powered-By
		if (config.hidePoweredBy) {
			headers.delete("X-Powered-By");
			headers.delete("Server");
		}

		// HTTP Strict Transport Security
		if (config.hsts?.enabled) {
			let hstsValue = `max-age=${config.hsts.maxAge}`;
			if (config.hsts.includeSubDomains) hstsValue += "; includeSubDomains";
			if (config.hsts.preload) hstsValue += "; preload";
			headers.set("Strict-Transport-Security", hstsValue);
		}

		// IE No Open
		if (config.ieNoOpen) {
			headers.set("X-Download-Options", "noopen");
		}

		// No Sniff
		if (config.noSniff) {
			headers.set("X-Content-Type-Options", "nosniff");
		}

		// Origin Agent Cluster
		if (config.originAgentCluster) {
			headers.set("Origin-Agent-Cluster", "?1");
		}

		// Permitted Cross Domain Policies
		if (!config.permittedCrossDomainPolicies) {
			headers.set("X-Permitted-Cross-Domain-Policies", "none");
		}

		// Referrer Policy
		if (config.referrerPolicy) {
			headers.set("Referrer-Policy", config.referrerPolicy);
		}

		// XSS Filter
		if (config.xssFilter) {
			headers.set("X-XSS-Protection", "0"); // Modern approach: disable legacy XSS filter
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * CSRF token storage (in-memory for simplicity, should use Redis in production)
 */
const csrfTokens = new Map<string, { token: string; timestamp: number }>();

/**
 * Generates a secure random token
 */
function generateToken(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Validates CSRF token
 */
function validateCSRFToken(token: string, sessionId: string): boolean {
	const stored = csrfTokens.get(sessionId);
	if (!stored) return false;

	// Check if token is expired (1 hour)
	if (Date.now() - stored.timestamp > 3600000) {
		csrfTokens.delete(sessionId);
		return false;
	}

	return stored.token === token;
}

/**
 * Creates CSRF protection middleware
 */
export function csrfProtection(options: CSRFOptions = {}): Middleware {
	const config = {
		tokenHeader: "x-csrf-token",
		tokenQuery: "_csrf",
		tokenBody: "_csrf",
		sessionKey: "sessionId",
		ignoreMethods: ["GET", "HEAD", "OPTIONS"],
		...options,
	};

	return async (req: Request, next) => {
		const method = req.method.toUpperCase();

		// Skip CSRF for safe methods
		if (config.ignoreMethods.includes(method)) {
			return next();
		}

		// Get session ID (simplified - in production, use proper session management)
		const sessionId = req.headers.get("x-session-id") || "default";

		// Get CSRF token from various sources
		let token = req.headers.get(config.tokenHeader);

		if (!token) {
			const url = new URL(req.url);
			token = url.searchParams.get(config.tokenQuery);
		}

		if (
			!token &&
			req.headers.get("content-type")?.includes("application/json")
		) {
			try {
				const body = await req.json();
				token = body[config.tokenBody];
				// Re-create request with parsed body for downstream handlers
				(req as any).parsedBody = body;
			} catch {
				// Invalid JSON
			}
		}

		// Validate token
		if (!token || !validateCSRFToken(token, sessionId)) {
			return error("CSRF token validation failed", 403);
		}

		return next();
	};
}

/**
 * Generates and sets CSRF token for a session
 */
export function generateCSRFToken(sessionId: string): string {
	const token = generateToken();
	csrfTokens.set(sessionId, {
		token,
		timestamp: Date.now(),
	});
	return token;
}

/**
 * Removes HTML tags from input
 */
export const stripHtml = (input: string): string => {
	return input.replace(/<[^>]*>/g, "");
};

/**
 * Removes script tags and javascript: URLs
 */
export const stripScripts = (input: string): string => {
	return input
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
		.replace(/javascript:/gi, "")
		.replace(/on\w+\s*=/gi, "");
};

/**
 * Removes null bytes
 */
export const removeNullBytes = (input: string): string => {
	return input.replace(/\0/g, "");
};

/**
 * Sanitizes string input based on options
 */
export const sanitizeString = (
	input: string,
	options: SanitizationOptions = {},
): string => {
	let result = input;

	if (options.removeNullBytes !== false) {
		result = removeNullBytes(result);
	}

	if (options.stripScripts) {
		result = stripScripts(result);
	}

	if (options.stripHtml) {
		result = stripHtml(result);
	}

	if (options.trim) {
		result = result.trim();
	}

	if (options.toLowerCase) {
		result = result.toLowerCase();
	}

	if (options.custom) {
		result = options.custom(result);
	}

	return result;
};

/**
 * Sanitizes object recursively
 */
export const sanitizeObject = (
	obj: any,
	options: SanitizationOptions = {},
): any => {
	if (typeof obj === "string") {
		return sanitizeString(obj, options);
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => sanitizeObject(item, options));
	}

	if (obj && typeof obj === "object") {
		const sanitized: any = {};
		for (const [key, value] of Object.entries(obj)) {
			sanitized[key] = sanitizeObject(value, options);
		}
		return sanitized;
	}

	return obj;
};

/**
 * Input sanitization utilities (legacy class for backward compatibility)
 */
export class InputSanitizer {
	static stripHtml = stripHtml;
	static stripScripts = stripScripts;
	static removeNullBytes = removeNullBytes;
	static sanitize = sanitizeString;
	static sanitizeObject = sanitizeObject;
}

/**
 * Creates input sanitization middleware
 */
export function inputSanitization(
	options: SanitizationOptions = {},
): Middleware {
	return async (req: Request, next) => {
		// Sanitize request body if present
		if (req.method !== "GET" && req.method !== "HEAD") {
			const contentType = req.headers.get("content-type");

			if (contentType?.includes("application/json")) {
				try {
					const body = await req.json();
					const sanitized = sanitizeObject(body, options);

					// Attach sanitized body to request
					(req as any).sanitizedBody = sanitized;
				} catch {
					// Invalid JSON, skip sanitization
				}
			}
		}

		return next();
	};
}

/**
 * Default security middleware stack
 */
export function defaultSecurity(): Middleware {
	return async (req: Request, next) => {
		// Apply security headers
		const securityMiddleware = securityHeaders();

		// Apply input sanitization
		const sanitizationMiddleware = inputSanitization({
			stripScripts: true,
			removeNullBytes: true,
			trim: true,
		});

		// Chain middlewares
		return securityMiddleware(req, async () => {
			return sanitizationMiddleware(req, next);
		});
	};
}
