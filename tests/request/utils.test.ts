import { test, expect } from "bun:test";
import { 
  parseCookies, 
  getClientIP, 
  getHostname, 
  getProtocol, 
  isSecure, 
  isXHR, 
  getPath, 
  createHeaderGetter,
  enhanceRequest 
} from "../../src/request";

// Cookie Parsing Tests
test("parseCookies handles empty string", () => {
  expect(parseCookies("")).toEqual({});
});

test("parseCookies parses single cookie", () => {
  expect(parseCookies("session=abc123")).toEqual({ session: "abc123" });
});

test("parseCookies parses multiple cookies", () => {
  const result = parseCookies("session=abc123; user=john; theme=dark");
  expect(result).toEqual({
    session: "abc123",
    user: "john", 
    theme: "dark"
  });
});

test("parseCookies handles cookies with equals in value", () => {
  expect(parseCookies("token=key=value=test")).toEqual({ token: "key=value=test" });
});

test("parseCookies handles cookies with spaces", () => {
  const result = parseCookies(" session = abc123 ; user = john ");
  expect(result).toEqual({
    session: "abc123",
    user: "john"
  });
});

test("parseCookies ignores malformed cookies", () => {
  expect(parseCookies("validcookie=value; invalidcookie; anothergood=test")).toEqual({
    validcookie: "value",
    anothergood: "test"
  });
});

// IP Extraction Tests
test("getClientIP extracts from x-forwarded-for", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" }
  });
  expect(getClientIP(mockRequest)).toBe("203.0.113.195");
});

test("getClientIP extracts from x-real-ip", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "x-real-ip": "192.168.1.100" }
  });
  expect(getClientIP(mockRequest)).toBe("192.168.1.100");
});

test("getClientIP extracts from x-client-ip", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "x-client-ip": "10.0.0.1" }
  });
  expect(getClientIP(mockRequest)).toBe("10.0.0.1");
});

test("getClientIP extracts from cf-connecting-ip", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "cf-connecting-ip": "172.16.0.1" }
  });
  expect(getClientIP(mockRequest)).toBe("172.16.0.1");
});

test("getClientIP falls back to unknown", () => {
  const mockRequest = new Request("http://localhost/");
  expect(getClientIP(mockRequest)).toBe("unknown");
});

test("getClientIP prioritizes x-forwarded-for over other headers", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { 
      "x-forwarded-for": "203.0.113.195",
      "x-real-ip": "192.168.1.100",
      "x-client-ip": "10.0.0.1"
    }
  });
  expect(getClientIP(mockRequest)).toBe("203.0.113.195");
});

// Hostname Tests
test("getHostname extracts from host header", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "host": "example.com" }
  });
  expect(getHostname(mockRequest)).toBe("example.com");
});

test("getHostname removes port from host header", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "host": "example.com:8080" }
  });
  expect(getHostname(mockRequest)).toBe("example.com");
});

test("getHostname falls back to URL hostname", () => {
  const mockRequest = new Request("http://api.example.com/test");
  expect(getHostname(mockRequest)).toBe("api.example.com");
});

test("getHostname defaults to localhost", () => {
  const mockRequest = new Request("http://localhost/");
  expect(getHostname(mockRequest)).toBe("localhost");
});

// Protocol Tests
test("getProtocol detects https from x-forwarded-proto", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "x-forwarded-proto": "https" }
  });
  expect(getProtocol(mockRequest)).toBe("https");
});

test("getProtocol extracts from URL", () => {
  const mockRequest = new Request("https://example.com/");
  expect(getProtocol(mockRequest)).toBe("https");
});

test("getProtocol defaults to http", () => {
  const mockRequest = new Request("http://localhost/");
  expect(getProtocol(mockRequest)).toBe("http");
});

// Secure Tests
test("isSecure returns true for https", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "x-forwarded-proto": "https" }
  });
  expect(isSecure(mockRequest)).toBe(true);
});

test("isSecure returns false for http", () => {
  const mockRequest = new Request("http://localhost/");
  expect(isSecure(mockRequest)).toBe(false);
});

// XHR Tests
test("isXHR detects XMLHttpRequest", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "x-requested-with": "XMLHttpRequest" }
  });
  expect(isXHR(mockRequest)).toBe(true);
});

test("isXHR is case insensitive", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "x-requested-with": "xmlhttprequest" }
  });
  expect(isXHR(mockRequest)).toBe(true);
});

test("isXHR returns false for non-XHR requests", () => {
  const mockRequest = new Request("http://localhost/");
  expect(isXHR(mockRequest)).toBe(false);
});

// Path Tests
test("getPath extracts path from URL", () => {
  expect(getPath("http://localhost:3000/api/users")).toBe("/api/users");
});

test("getPath extracts path without query string", () => {
  expect(getPath("http://localhost:3000/api/users?page=1&limit=10")).toBe("/api/users");
});

test("getPath handles root path", () => {
  expect(getPath("http://localhost:3000/")).toBe("/");
});

test("getPath handles complex paths", () => {
  expect(getPath("http://localhost:3000/api/v1/users/123/posts?filter=recent")).toBe("/api/v1/users/123/posts");
});

test("getPath handles paths with fragments", () => {
  expect(getPath("http://localhost:3000/page#section")).toBe("/page");
});

// Header Getter Tests
test("createHeaderGetter returns function that gets headers", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { 
      "content-type": "application/json",
      "authorization": "Bearer token123"
    }
  });
  
  const getter = createHeaderGetter(mockRequest);
  expect(getter("content-type")).toBe("application/json");
  expect(getter("authorization")).toBe("Bearer token123");
  expect(getter("non-existent")).toBeUndefined();
});

test("createHeaderGetter is case insensitive", () => {
  const mockRequest = new Request("http://localhost/", {
    headers: { "Content-Type": "application/json" }
  });
  
  const getter = createHeaderGetter(mockRequest);
  expect(getter("content-type")).toBe("application/json");
  expect(getter("Content-Type")).toBe("application/json");
});

// Full Enhancement Tests
test("enhanceRequest adds all properties", () => {
  const mockRequest = new Request("http://example.com:8080/api/users?page=1", {
    headers: {
      "cookie": "session=abc123; user=john",
      "x-forwarded-for": "203.0.113.195",
      "x-forwarded-proto": "https",
      "host": "api.example.com:3000",
      "x-requested-with": "XMLHttpRequest",
      "user-agent": "Test-Browser/1.0"
    }
  });
  
  const enhanced = enhanceRequest(mockRequest);
  
  expect(enhanced.cookies).toEqual({ session: "abc123", user: "john" });
  expect(enhanced.ip).toBe("203.0.113.195");
  expect(enhanced.path).toBe("/api/users");
  expect(enhanced.hostname).toBe("api.example.com");
  expect(enhanced.protocol).toBe("https");
  expect(enhanced.secure).toBe(true);
  expect(enhanced.xhr).toBe(true);
  expect(typeof enhanced.get).toBe("function");
  expect(enhanced.get?.("user-agent")).toBe("Test-Browser/1.0");
});

test("enhanceRequest handles minimal request", () => {
  const mockRequest = new Request("http://localhost/");
  const enhanced = enhanceRequest(mockRequest);
  
  expect(enhanced.cookies).toEqual({});
  expect(enhanced.ip).toBe("unknown");
  expect(enhanced.path).toBe("/");
  expect(enhanced.hostname).toBe("localhost");
  expect(enhanced.protocol).toBe("http");
  expect(enhanced.secure).toBe(false);
  expect(enhanced.xhr).toBe(false);
  expect(typeof enhanced.get).toBe("function");
});