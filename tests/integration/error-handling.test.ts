import { test, expect } from "bun:test";
import { createServer } from "../../src/index";

// Mock request helper
const createMockRequest = (
  method: string = "GET", 
  url: string = "http://localhost:3000/",
  headers: Record<string, string> = {},
  body?: any
): Request => {
  const requestInit: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    if (typeof body === "object") {
      requestInit.body = JSON.stringify(body);
      headers["content-type"] = "application/json";
    } else {
      requestInit.body = body;
    }
  }
  
  return new Request(url, requestInit);
};

test("404 error for non-existent routes", async () => {
  const app = createServer();
  
  app.get("/existing", (req, res) => {
    res.json({ message: "exists" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/non-existent");
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("Not Found");
});

test("Method not allowed when route exists but method doesn't match", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.json({ method: "GET" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Try POST on a GET-only route
  const mockRequest = createMockRequest("POST", "http://localhost:3000/test");
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(404); // Current implementation returns 404 for method mismatch
});

test("500 error when handler throws exception", async () => {
  const app = createServer();
  
  app.get("/error", (req, res) => {
    throw new Error("Something went wrong");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/error");
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("Internal Server Error");
});

test("500 error when async handler rejects", async () => {
  const app = createServer();
  
  app.get("/async-error", async (req, res) => {
    await new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Async error")), 10);
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/async-error");
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("Internal Server Error");
});

test("Error in middleware stops execution and returns 500", async () => {
  const app = createServer();
  let handlerCalled = false;
  
  app.use((req, res, next) => {
    throw new Error("Middleware error");
  });
  
  app.get("/test", (req, res) => {
    handlerCalled = true;
    res.json({ success: true });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/test");
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(500);
  expect(handlerCalled).toBe(false);
});

test("Error in async middleware stops execution", async () => {
  const app = createServer();
  let handlerCalled = false;
  
  app.use(async (req, res, next) => {
    await new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Async middleware error")), 10);
    });
  });
  
  app.get("/test", (req, res) => {
    handlerCalled = true;
    res.json({ success: true });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/test");
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(500);
  expect(handlerCalled).toBe(false);
});

test("Error in route-specific middleware stops handler execution", async () => {
  const app = createServer();
  let handlerCalled = false;
  
  app.get("/test", 
    (req, res, next) => {
      throw new Error("Route middleware error");
    },
    (req, res) => {
      handlerCalled = true;
      res.json({ success: true });
    }
  );

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/test");
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(500);
  expect(handlerCalled).toBe(false);
});

test("JSON parsing error in built-in middleware", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  app.use(middleware.json());
  
  app.post("/test", (req, res) => {
    res.json({ received: req.body });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Send malformed JSON
  const mockRequest = createMockRequest("POST", "http://localhost:3000/test", {
    "content-type": "application/json"
  }, '{"invalid": json}'); // Invalid JSON
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain("Invalid JSON");
});

test("Body too large error in middleware", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  app.use(middleware.json({ limit: 10 })); // Very small limit
  
  app.post("/test", (req, res) => {
    res.json({ received: req.body });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const largeBody = { data: "x".repeat(1000) }; // Large body
  const mockRequest = createMockRequest("POST", "http://localhost:3000/test", {
    "content-type": "application/json"
  }, largeBody);
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(413);
  const data = await response.json();
  expect(data.error).toContain("too large");
});

test("Custom error responses work correctly", async () => {
  const app = createServer();
  
  app.get("/custom-error", (req, res) => {
    res.status(422).json({ 
      error: "Validation failed",
      details: ["Field 'name' is required", "Field 'email' must be valid"]
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/custom-error");
  
  const response = await fetchHandler(mockRequest);
  const data = await response.json();
  
  expect(response.status).toBe(422);
  expect(data.error).toBe("Validation failed");
  expect(data.details).toHaveLength(2);
});

test("Multiple error scenarios in complex app", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  // Auth middleware that can fail
  app.use("/protected", (req, res, next) => {
    const auth = req.headers.get("authorization");
    if (!auth) {
      return res.status(401).json({ error: "No authorization header" });
    }
    if (auth !== "Bearer valid-token") {
      return res.status(403).json({ error: "Invalid token" });
    }
    next();
  });
  
  app.use(middleware.json());
  
  // Protected route that can have various errors
  app.post("/protected/data", (req, res) => {
    if (!req.body.name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (req.body.name === "forbidden") {
      return res.status(403).json({ error: "Forbidden name" });
    }
    if (req.body.name === "crash") {
      throw new Error("Intentional crash");
    }
    res.json({ message: "Success", name: req.body.name });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test 401 - No auth
  const noAuthRequest = createMockRequest("POST", "http://localhost:3000/protected/data", {
    "content-type": "application/json"
  }, { name: "test" });
  const noAuthResponse = await fetchHandler(noAuthRequest);
  expect(noAuthResponse.status).toBe(401);
  
  // Test 403 - Invalid token
  const invalidTokenRequest = createMockRequest("POST", "http://localhost:3000/protected/data", {
    "authorization": "Bearer invalid-token",
    "content-type": "application/json"
  }, { name: "test" });
  const invalidTokenResponse = await fetchHandler(invalidTokenRequest);
  expect(invalidTokenResponse.status).toBe(403);
  
  // Test 400 - Missing required field
  const missingFieldRequest = createMockRequest("POST", "http://localhost:3000/protected/data", {
    "authorization": "Bearer valid-token",
    "content-type": "application/json"
  }, {});
  const missingFieldResponse = await fetchHandler(missingFieldRequest);
  expect(missingFieldResponse.status).toBe(400);
  
  // Test 403 - Forbidden name
  const forbiddenRequest = createMockRequest("POST", "http://localhost:3000/protected/data", {
    "authorization": "Bearer valid-token",
    "content-type": "application/json"
  }, { name: "forbidden" });
  const forbiddenResponse = await fetchHandler(forbiddenRequest);
  expect(forbiddenResponse.status).toBe(403);
  
  // Test 500 - Handler crash
  const crashRequest = createMockRequest("POST", "http://localhost:3000/protected/data", {
    "authorization": "Bearer valid-token",
    "content-type": "application/json"
  }, { name: "crash" });
  const crashResponse = await fetchHandler(crashRequest);
  expect(crashResponse.status).toBe(500);
  
  // Test 200 - Success case
  const successRequest = createMockRequest("POST", "http://localhost:3000/protected/data", {
    "authorization": "Bearer valid-token",
    "content-type": "application/json"
  }, { name: "valid" });
  const successResponse = await fetchHandler(successRequest);
  expect(successResponse.status).toBe(200);
});

test("Error after response has been sent throws correctly", () => {
  const { createResponse } = require("../../src/response");
  const { res } = createResponse();
  
  res.json({ test: true });
  
  expect(() => res.status(500)).toThrow("Cannot set response after it has been sent");
  expect(() => res.send("error")).toThrow("Cannot set response after it has been sent");
  expect(() => res.json({ error: true })).toThrow("Cannot set response after it has been sent");
});

test("Router-level error handling", async () => {
  const app = createServer();
  const { Router } = await import("../../src/index");
  const router = Router();
  
  router.get("/test", (req, res) => {
    res.json({ message: "Router success" });
  });
  
  app.use("/api", router as any);

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test router success (router middleware not fully implemented yet)
  const successRequest = createMockRequest("GET", "http://localhost:3000/api/test");
  const successResponse = await fetchHandler(successRequest);
  expect(successResponse.status).toBe(200);
});

test("Nested error scenarios with static files", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  // Static middleware (will return 404 for non-existent files)
  app.use("/static", middleware.static("./non-existent-directory"));
  
  // Regular route
  app.get("/api/test", (req, res) => {
    res.json({ message: "API works" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test static file 404
  const staticRequest = createMockRequest("GET", "http://localhost:3000/static/non-existent.txt");
  const staticResponse = await fetchHandler(staticRequest);
  expect(staticResponse.status).toBe(404);
  
  // Test API still works
  const apiRequest = createMockRequest("GET", "http://localhost:3000/api/test");
  const apiResponse = await fetchHandler(apiRequest);
  expect(apiResponse.status).toBe(200);
});

test("Parameter validation errors", async () => {
  const app = createServer();
  
  app.get("/users/:id", (req, res) => {
    const id = parseInt(req.params!.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID, must be a number" });
    }
    if (id < 1) {
      return res.status(400).json({ error: "User ID must be positive" });
    }
    res.json({ userId: id });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test invalid ID
  const invalidRequest = createMockRequest("GET", "http://localhost:3000/users/abc");
  const invalidResponse = await fetchHandler(invalidRequest);
  expect(invalidResponse.status).toBe(400);
  
  // Test negative ID
  const negativeRequest = createMockRequest("GET", "http://localhost:3000/users/-1");
  const negativeResponse = await fetchHandler(negativeRequest);
  expect(negativeResponse.status).toBe(400);
  
  // Test valid ID
  const validRequest = createMockRequest("GET", "http://localhost:3000/users/123");
  const validResponse = await fetchHandler(validRequest);
  expect(validResponse.status).toBe(200);
});

test("Content-Type validation errors", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  app.use(middleware.json({ type: "application/json", strict: true }));
  
  app.post("/api/data", (req, res) => {
    res.json({ received: req.body });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test wrong content type
  const wrongTypeRequest = createMockRequest("POST", "http://localhost:3000/api/data", {
    "content-type": "text/plain"
  }, '{"test": "data"}');
  const wrongTypeResponse = await fetchHandler(wrongTypeRequest);
  
  // Should pass through without parsing
  expect(wrongTypeResponse.status).toBe(200);
  const data = await wrongTypeResponse.json();
  expect(data.received).toEqual({}); // Body is empty object when not parsed
});