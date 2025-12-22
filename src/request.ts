import { enhanceRequestWithContentNegotiation } from "./content-negotiation";
import type { VerbRequest } from "./types";

export const parseCookies = (cookieHeader: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  let i = 0;
  const len = cookieHeader.length;

  while (i < len) {
    // skip whitespace
    while (i < len && cookieHeader[i] === " ") {
      i++;
    }

    // find semicolon or end
    let end = i;
    while (end < len && cookieHeader[end] !== ";") {
      end++;
    }

    // find equals
    let eq = i;
    while (eq < end && cookieHeader[eq] !== "=") {
      eq++;
    }

    if (eq > i && eq < end) {
      const name = cookieHeader.slice(i, eq).trim();
      const value = cookieHeader.slice(eq + 1, end).trim();
      if (name) {
        cookies[name] = value;
      }
    }

    i = end + 1;
  }

  return cookies;
};

export const enhanceRequest = (req: Request): VerbRequest => {
  const enhanced = req as VerbRequest;
  const headers = req.headers;

  // batch header lookups - single pass
  const host = headers.get("host");
  const xForwardedFor = headers.get("x-forwarded-for");
  const xForwardedProto = headers.get("x-forwarded-proto");
  const cookieHeader = headers.get("cookie");

  // parse URL once
  let urlPath = "/";
  let urlHostname = "localhost";
  let urlProtocol = "http";

  const url = req.url;
  const qIdx = url.indexOf("?");
  const protoEnd = url.indexOf("://");

  if (protoEnd !== -1) {
    urlProtocol = url.slice(0, protoEnd);
    const hostStart = protoEnd + 3;
    const pathStart = url.indexOf("/", hostStart);
    if (pathStart !== -1) {
      urlHostname = url.slice(hostStart, pathStart);
      urlPath = qIdx === -1 ? url.slice(pathStart) : url.slice(pathStart, qIdx);
    }
  }

  // IP - check proxy headers in order of priority
  enhanced.ip =
    xForwardedFor?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("x-client-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";

  // cookies
  enhanced.cookies = cookieHeader ? parseCookies(cookieHeader) : {};

  // path
  enhanced.path = urlPath;

  // hostname - prefer Host header
  enhanced.hostname = host ? host.split(":")[0] : urlHostname;

  // protocol - prefer x-forwarded-proto
  const protocol = xForwardedProto || urlProtocol;
  enhanced.protocol = protocol;
  enhanced.secure = protocol === "https";

  // XHR check
  enhanced.xhr = headers.get("x-requested-with")?.toLowerCase() === "xmlhttprequest";

  // header getter - inline, no closure allocation
  enhanced.get = (header: string) => headers.get(header) || undefined;

  // content negotiation
  enhanceRequestWithContentNegotiation(enhanced);

  return enhanced;
};

// keep for backward compat
export const getClientIP = (req: Request): string => {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0]?.trim() || "";
  }
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
};

export const getHostname = (req: Request): string => {
  const host = req.headers.get("host");
  if (host) {
    return host.split(":")[0] || "";
  }
  try {
    return new URL(req.url).hostname;
  } catch {
    return "localhost";
  }
};

export const getProtocol = (req: Request): string => {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) {
    return proto;
  }
  try {
    return new URL(req.url).protocol.replace(":", "");
  } catch {
    return "http";
  }
};

export const isSecure = (req: Request): boolean => getProtocol(req) === "https";

export const isXHR = (req: Request): boolean =>
  req.headers.get("x-requested-with")?.toLowerCase() === "xmlhttprequest";

export const getPath = (url: string): string => {
  const protoEnd = url.indexOf("://");
  if (protoEnd === -1) {
    return url;
  }
  const pathStart = url.indexOf("/", protoEnd + 3);
  if (pathStart === -1) {
    return "/";
  }
  const qIdx = url.indexOf("?", pathStart);
  const hashIdx = url.indexOf("#", pathStart);
  const endIdx = qIdx === -1 ? hashIdx : hashIdx === -1 ? qIdx : Math.min(qIdx, hashIdx);
  return endIdx === -1 ? url.slice(pathStart) : url.slice(pathStart, endIdx);
};

export const createHeaderGetter =
  (req: Request) =>
  (header: string): string | undefined =>
    req.headers.get(header) || undefined;
