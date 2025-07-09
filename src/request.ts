import type { VerbRequest } from "./types";
import { enhanceRequestWithContentNegotiation } from "./content-negotiation";

/**
 * Parse cookies from the Cookie header
 * @param cookieHeader - The value of the Cookie header
 * @returns Object with cookie name-value pairs
 */
export const parseCookies = (cookieHeader: string): Record<string, string> => {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      const trimmedName = name.trim();
      const value = rest.join("=").trim();
      cookies[trimmedName] = value;
    }
  });

  return cookies;
};

/**
 * Extract client IP address from request headers
 * @param req - The request object
 * @returns Client IP address
 */
export const getClientIP = (req: Request): string => {
  // Check common proxy headers first
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const firstIP = xForwardedFor.split(",")[0];
    return firstIP ? firstIP.trim() : "";
  }

  const xRealIP = req.headers.get("x-real-ip");
  if (xRealIP) {
    return xRealIP;
  }

  const xClientIP = req.headers.get("x-client-ip");
  if (xClientIP) {
    return xClientIP;
  }

  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback - this might not be available in all environments
  return "unknown";
};

/**
 * Get hostname from request headers
 * @param req - The request object
 * @returns Hostname
 */
export const getHostname = (req: Request): string => {
  const host = req.headers.get("host");
  if (host) {
    // Remove port if present
    return host.split(":")[0] || "";
  }

  // Fallback to extracting from URL
  try {
    const url = new URL(req.url);
    return url.hostname;
  } catch {
    return "localhost";
  }
};

/**
 * Get protocol from request
 * @param req - The request object
 * @returns Protocol (http or https)
 */
export const getProtocol = (req: Request): string => {
  // Check x-forwarded-proto header (common with proxies)
  const xForwardedProto = req.headers.get("x-forwarded-proto");
  if (xForwardedProto) {
    return xForwardedProto;
  }

  // Check if the connection is secure
  const url = new URL(req.url);
  return url.protocol.replace(":", "");
};

/**
 * Check if request is secure (HTTPS)
 * @param req - The request object
 * @returns True if HTTPS, false otherwise
 */
export const isSecure = (req: Request): boolean => {
  return getProtocol(req) === "https";
};

/**
 * Check if request is XMLHttpRequest (AJAX)
 * @param req - The request object
 * @returns True if XHR, false otherwise
 */
export const isXHR = (req: Request): boolean => {
  const xRequestedWith = req.headers.get("x-requested-with");
  return xRequestedWith?.toLowerCase() === "xmlhttprequest";
};

/**
 * Get request path without query string
 * @param url - The full URL
 * @returns Path without query string
 */
export const getPath = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // Fallback parsing
    const queryIndex = url.indexOf("?");
    const protocolEnd = url.indexOf("://") + 3;
    const hostEnd = url.indexOf("/", protocolEnd);
    return queryIndex === -1 ? url.slice(hostEnd) : url.slice(hostEnd, queryIndex);
  }
};

/**
 * Create a header getter function for the request
 * @param req - The request object
 * @returns Function to get header values
 */
export const createHeaderGetter = (req: Request) => {
  return (header: string): string | undefined => {
    return req.headers.get(header) || undefined;
  };
};

/**
 * Enhance request object with all additional properties
 * @param req - The base request object
 * @returns Enhanced VerbRequest object
 */
export const enhanceRequest = (req: Request): VerbRequest => {
  const enhanced = req as VerbRequest;

  // Parse and add cookies
  const cookieHeader = req.headers.get("cookie") || "";
  enhanced.cookies = parseCookies(cookieHeader);

  // Add IP address
  enhanced.ip = getClientIP(req);

  // Add path
  enhanced.path = getPath(req.url);

  // Add hostname
  enhanced.hostname = getHostname(req);

  // Add protocol
  enhanced.protocol = getProtocol(req);

  // Add secure flag
  enhanced.secure = isSecure(req);

  // Add XHR flag
  enhanced.xhr = isXHR(req);

  // Add header getter function
  enhanced.get = createHeaderGetter(req);

  // Add content negotiation methods
  enhanceRequestWithContentNegotiation(enhanced);

  return enhanced;
};
