import { test, expect } from "bun:test";
import { createResponse } from "../../src/response";

// Response Creation Tests
test("createResponse returns response and getResponse function", () => {
  const { res, getResponse } = createResponse();
  expect(res).toBeDefined();
  expect(typeof getResponse).toBe("function");
  expect(typeof res.send).toBe("function");
  expect(typeof res.json).toBe("function");
  expect(typeof res.status).toBe("function");
});

// Send Method Tests
test("res.send() handles string data", async () => {
  const { res, getResponse } = createResponse();
  res.send("Hello, World!");
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(await response.text()).toBe("Hello, World!");
});

test("res.send() handles number data", async () => {
  const { res, getResponse } = createResponse();
  res.send(42);
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(await response.text()).toBe("42");
});

test("res.send() handles boolean data", async () => {
  const { res, getResponse } = createResponse();
  res.send(true);
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(await response.text()).toBe("true");
});

test("res.send() handles object data as JSON", async () => {
  const { res, getResponse } = createResponse();
  const data = { message: "Hello", count: 42 };
  res.send(data);
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(await response.json()).toEqual(data);
});

test("res.send() handles array data as JSON", async () => {
  const { res, getResponse } = createResponse();
  const data = [1, 2, 3, "test"];
  res.send(data);
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(await response.json()).toEqual(data);
});

// JSON Method Tests
test("res.json() sets correct content type", async () => {
  const { res, getResponse } = createResponse();
  const data = { test: "value", number: 123 };
  res.json(data);
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(await response.json()).toEqual(data);
});

test("res.json() handles null values", async () => {
  const { res, getResponse } = createResponse();
  res.json(null);
  
  const response = await getResponse();
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(await response.text()).toBe("null");
});

test("res.json() handles undefined values", async () => {
  const { res, getResponse } = createResponse();
  res.json(undefined);
  
  const response = await getResponse();
  expect(response.headers.get("Content-Type")).toBe("application/json");
  // undefined becomes null in JSON
  expect(await response.text()).toBe("");
});

// Status Method Tests
test("res.status() sets status code and returns chainable response", async () => {
  const { res, getResponse } = createResponse();
  const result = res.status(404);
  
  expect(result).toBe(res); // Should be chainable
  res.send("Not Found");
  
  const response = await getResponse();
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("Not Found");
});

test("res.status() chains with other methods", async () => {
  const { res, getResponse } = createResponse();
  res.status(201).json({ created: true });
  
  const response = await getResponse();
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ created: true });
});

test("res.status() accepts various HTTP status codes", async () => {
  const statusCodes = [200, 201, 301, 400, 401, 403, 404, 500, 502];
  
  for (const code of statusCodes) {
    const { res, getResponse } = createResponse();
    res.status(code).send(`Status ${code}`);
    
    const response = await getResponse();
    expect(response.status).toBe(code);
  }
});

// Redirect Method Tests
test("res.redirect() sets location header with default 302 status", async () => {
  const { res, getResponse } = createResponse();
  res.redirect("/new-path");
  
  const response = await getResponse();
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/new-path");
  expect(await response.text()).toBe("Redirecting to /new-path");
});

test("res.redirect() accepts custom status code", async () => {
  const { res, getResponse } = createResponse();
  res.redirect("/new-path", 301);
  
  const response = await getResponse();
  expect(response.status).toBe(301);
  expect(response.headers.get("Location")).toBe("/new-path");
});

test("res.redirect() handles various redirect codes", async () => {
  const redirectCodes = [301, 302, 303, 307, 308];
  
  for (const code of redirectCodes) {
    const { res, getResponse } = createResponse();
    res.redirect("/path", code);
    
    const response = await getResponse();
    expect(response.status).toBe(code);
    expect(response.headers.get("Location")).toBe("/path");
  }
});

test("res.redirect() handles absolute URLs", async () => {
  const { res, getResponse } = createResponse();
  res.redirect("https://example.com/path");
  
  const response = await getResponse();
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("https://example.com/path");
});

// HTML Method Tests
test("res.html() sets HTML content type", async () => {
  const { res, getResponse } = createResponse();
  const htmlContent = "<html><body><h1>Hello</h1></body></html>";
  res.html(htmlContent);
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/html");
  expect(await response.text()).toBe(htmlContent);
});

test("res.html() handles empty HTML", async () => {
  const { res, getResponse } = createResponse();
  res.html("");
  
  const response = await getResponse();
  expect(response.headers.get("Content-Type")).toBe("text/html");
  expect(await response.text()).toBe("");
});

// Text Method Tests
test("res.text() sets plain text content type", async () => {
  const { res, getResponse } = createResponse();
  const textContent = "Plain text response";
  res.text(textContent);
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(await response.text()).toBe(textContent);
});

// Header Method Tests
test("res.header() sets individual header and returns chainable response", async () => {
  const { res, getResponse } = createResponse();
  const result = res.header("X-Custom-Header", "custom-value");
  
  expect(result).toBe(res); // Should be chainable
  res.send("test");
  
  const response = await getResponse();
  expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
});

test("res.header() chains with other methods", async () => {
  const { res, getResponse } = createResponse();
  res.header("Authorization", "Bearer token123")
    .status(201)
    .json({ success: true });
  
  const response = await getResponse();
  expect(response.status).toBe(201);
  expect(response.headers.get("Authorization")).toBe("Bearer token123");
  expect(await response.json()).toEqual({ success: true });
});

test("res.header() overwrites existing headers", async () => {
  const { res, getResponse } = createResponse();
  res.header("X-Test", "first-value")
    .header("X-Test", "second-value")
    .send("test");
  
  const response = await getResponse();
  expect(response.headers.get("X-Test")).toBe("second-value");
});

// Headers Method Tests
test("res.headers() sets multiple headers and returns chainable response", async () => {
  const { res, getResponse } = createResponse();
  const headers = {
    "X-API-Version": "v1",
    "X-Rate-Limit": "100",
    "Cache-Control": "no-cache"
  };
  
  const result = res.headers(headers);
  expect(result).toBe(res); // Should be chainable
  res.send("test");
  
  const response = await getResponse();
  expect(response.headers.get("X-API-Version")).toBe("v1");
  expect(response.headers.get("X-Rate-Limit")).toBe("100");
  expect(response.headers.get("Cache-Control")).toBe("no-cache");
});

test("res.headers() chains with other methods", async () => {
  const { res, getResponse } = createResponse();
  res.headers({ "X-Test": "value" })
    .status(200)
    .json({ data: "test" });
  
  const response = await getResponse();
  expect(response.headers.get("X-Test")).toBe("value");
  expect(await response.json()).toEqual({ data: "test" });
});

// Cookie Method Tests
test("res.cookie() sets basic cookie", async () => {
  const { res, getResponse } = createResponse();
  res.cookie("session", "abc123").send("test");
  
  const response = await getResponse();
  expect(response.headers.get("Set-Cookie")).toBe("session=abc123");
});

test("res.cookie() sets cookie with options", async () => {
  const { res, getResponse } = createResponse();
  res.cookie("token", "xyz789", {
    maxAge: 3600,
    path: "/api",
    domain: "example.com",
    secure: true,
    httpOnly: true,
    sameSite: "Strict"
  }).send("test");
  
  const response = await getResponse();
  const cookieHeader = response.headers.get("Set-Cookie");
  expect(cookieHeader).toContain("token=xyz789");
  expect(cookieHeader).toContain("Max-Age=3600");
  expect(cookieHeader).toContain("Path=/api");
  expect(cookieHeader).toContain("Domain=example.com");
  expect(cookieHeader).toContain("Secure");
  expect(cookieHeader).toContain("HttpOnly");
  expect(cookieHeader).toContain("SameSite=Strict");
});

test("res.cookie() sets cookie with expires option", async () => {
  const { res, getResponse } = createResponse();
  const expires = "Wed, 09 Jun 2025 10:18:14 GMT";
  res.cookie("test", "value", { expires }).send("test");
  
  const response = await getResponse();
  expect(response.headers.get("Set-Cookie")).toContain(`Expires=${expires}`);
});

test("res.cookie() sets multiple cookies", async () => {
  const { res, getResponse } = createResponse();
  res.cookie("first", "value1")
    .cookie("second", "value2")
    .send("test");
  
  const response = await getResponse();
  const cookies = response.headers.getSetCookie?.() || [response.headers.get("Set-Cookie")];
  expect(cookies.some(c => c?.includes("first=value1"))).toBe(true);
  expect(cookies.some(c => c?.includes("second=value2"))).toBe(true);
});

// Clear Cookie Method Tests
test("res.clearCookie() clears cookie", async () => {
  const { res, getResponse } = createResponse();
  res.clearCookie("session").send("test");
  
  const response = await getResponse();
  const cookieHeader = response.headers.get("Set-Cookie");
  expect(cookieHeader).toContain("session=");
  expect(cookieHeader).toContain("Max-Age=0");
  expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
});

test("res.clearCookie() chains with other methods", async () => {
  const { res, getResponse } = createResponse();
  res.clearCookie("old-session")
    .cookie("new-session", "fresh-token")
    .json({ refreshed: true });
  
  const response = await getResponse();
  const cookies = response.headers.getSetCookie?.() || [response.headers.get("Set-Cookie")];
  expect(cookies.some(c => c?.includes("old-session=") && c?.includes("Max-Age=0"))).toBe(true);
  expect(cookies.some(c => c?.includes("new-session=fresh-token"))).toBe(true);
});

// End Method Tests
test("res.end() finishes response with empty body", async () => {
  const { res, getResponse } = createResponse();
  res.status(204).end();
  
  const response = await getResponse();
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
});

test("res.end() finishes response and prevents further modifications", async () => {
  const { res, getResponse } = createResponse();
  res.end();
  
  expect(() => res.send("test")).toThrow("Cannot set response after it has been sent");
  expect(() => res.json({})).toThrow("Cannot set response after it has been sent");
  expect(() => res.status(200)).toThrow("Cannot set response after it has been sent");
});

// Error Handling Tests
test("Multiple response method calls throw error", async () => {
  const { res } = createResponse();
  res.send("first");
  
  expect(() => res.send("second")).toThrow("Cannot set response after it has been sent");
  expect(() => res.json({})).toThrow("Cannot set response after it has been sent");
  expect(() => res.html("<html></html>")).toThrow("Cannot set response after it has been sent");
  expect(() => res.text("text")).toThrow("Cannot set response after it has been sent");
  expect(() => res.redirect("/path")).toThrow("Cannot set response after it has been sent");
});

test("Header modification after response sent throws error", async () => {
  const { res } = createResponse();
  res.send("test");
  
  expect(() => res.header("X-Test", "value")).toThrow("Cannot set response after it has been sent");
  expect(() => res.headers({ "X-Test": "value" })).toThrow("Cannot set response after it has been sent");
  expect(() => res.cookie("test", "value")).toThrow("Cannot set response after it has been sent");
  expect(() => res.clearCookie("test")).toThrow("Cannot set response after it has been sent");
});

// Auto-finish Tests
test("getResponse() auto-finishes with empty body if no response method called", async () => {
  const { res, getResponse } = createResponse();
  res.status(200); // Only set status, no body
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("");
});

test("Default response is 200 with empty body", async () => {
  const { res, getResponse } = createResponse();
  // Don't call any response methods
  
  const response = await getResponse();
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("");
});

// Complex Integration Tests
test("Complex response chain works correctly", async () => {
  const { res, getResponse } = createResponse();
  
  res.status(201)
    .header("X-API-Version", "v2")
    .headers({
      "X-Request-ID": "req-123",
      "Cache-Control": "no-cache"
    })
    .cookie("session", "new-session", { 
      maxAge: 3600, 
      httpOnly: true 
    })
    .json({ 
      id: 1, 
      created: true, 
      message: "Resource created successfully" 
    });
  
  const response = await getResponse();
  expect(response.status).toBe(201);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(response.headers.get("X-API-Version")).toBe("v2");
  expect(response.headers.get("X-Request-ID")).toBe("req-123");
  expect(response.headers.get("Cache-Control")).toBe("no-cache");
  
  const cookieHeader = response.headers.get("Set-Cookie");
  expect(cookieHeader).toContain("session=new-session");
  expect(cookieHeader).toContain("Max-Age=3600");
  expect(cookieHeader).toContain("HttpOnly");
  
  const data = await response.json();
  expect(data).toEqual({
    id: 1,
    created: true,
    message: "Resource created successfully"
  });
});