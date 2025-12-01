import { test, expect } from "bun:test";
import { createServer } from "../../src/index";
import type { VerbRequest, VerbResponse } from "../../src/types";

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

// Test complex middleware chain execution order
test("Complex middleware chain executes in correct order", async () => {
  const app = createServer();
  const executionOrder: string[] = [];

  // Global middleware
  app.use((req, res, next) => {
    executionOrder.push("global1");
    next();
  });

  app.use((req, res, next) => {
    executionOrder.push("global2");
    next();
  });

  // Path-specific middleware
  app.use("/api", (req, res, next) => {
    executionOrder.push("path-api");
    next();
  });

  app.use("/api/users", (req, res, next) => {
    executionOrder.push("path-api-users");
    next();
  });

  // Route with multiple middleware
  app.get("/api/users/:id",
    (req, res, next) => {
      executionOrder.push("route-middleware1");
      next();
    },
    (req, res, next) => {
      executionOrder.push("route-middleware2");
      next();
    },
    (req, res) => {
      executionOrder.push("handler");
      res.json({ order: executionOrder });
    }
  );

  // Create fetch handler and test
  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/api/users/123");
  
  const response = await fetchHandler(mockRequest);
  const data = await response.json();

  expect(data.order).toEqual([
    "global1",
    "global2", 
    "path-api",
    "path-api-users",
    "route-middleware1",
    "route-middleware2",
    "handler"
  ]);
});

test("Middleware can modify request and pass data", async () => {
  const app = createServer();

  // Middleware that adds user info
  app.use((req, res, next) => {
    (req as any).user = { id: 1, name: "John" };
    next();
  });

  // Middleware that adds timestamp
  app.use((req, res, next) => {
    (req as any).timestamp = Date.now();
    next();
  });

  // Route that uses the added data
  app.get("/test", (req, res) => {
    res.json({
      user: (req as any).user,
      hasTimestamp: typeof (req as any).timestamp === "number"
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/test");
  
  const response = await fetchHandler(mockRequest);
  const data = await response.json();

  expect(data.user).toEqual({ id: 1, name: "John" });
  expect(data.hasTimestamp).toBe(true);
});

test("Middleware can stop execution by not calling next()", async () => {
  const app = createServer();
  let handlerCalled = false;

  // Middleware that blocks execution
  app.use((req, res, next) => {
    if (req.headers.get("authorization") !== "Bearer valid-token") {
      res.status(401).json({ error: "Unauthorized" });
      return; // Don't call next()
    }
    next();
  });

  app.get("/protected", (req, res) => {
    handlerCalled = true;
    res.json({ secret: "data" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test without authorization
  const unauthorizedRequest = createMockRequest("GET", "http://localhost:3000/protected");
  const unauthorizedResponse = await fetchHandler(unauthorizedRequest);
  
  expect(unauthorizedResponse.status).toBe(401);
  expect(handlerCalled).toBe(false);
  
  // Test with authorization
  handlerCalled = false;
  const authorizedRequest = createMockRequest("GET", "http://localhost:3000/protected", {
    "authorization": "Bearer valid-token"
  });
  const authorizedResponse = await fetchHandler(authorizedRequest);
  
  expect(authorizedResponse.status).toBe(200);
  expect(handlerCalled).toBe(true);
});

test("Async middleware works correctly", async () => {
  const app = createServer();
  const results: string[] = [];

  // Async middleware with delay
  app.use(async (req, res, next) => {
    results.push("async-start");
    await new Promise(resolve => setTimeout(resolve, 10));
    results.push("async-complete");
    next();
  });

  // Regular middleware
  app.use((req, res, next) => {
    results.push("sync-middleware");
    next();
  });

  app.get("/async", (req, res) => {
    results.push("handler");
    res.json({ results });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/async");
  
  const response = await fetchHandler(mockRequest);
  const data = await response.json();

  expect(data.results).toEqual([
    "async-start",
    "async-complete", 
    "sync-middleware",
    "handler"
  ]);
});

test("Path-specific middleware only runs for matching paths", async () => {
  const app = createServer();
  const executions: string[] = [];

  app.use("/api", (req, res, next) => {
    executions.push("api-middleware");
    next();
  });

  app.use("/admin", (req, res, next) => {
    executions.push("admin-middleware");
    next();
  });

  app.get("/api/test", (req, res) => {
    executions.push("api-handler");
    res.json({ path: "api", executions: [...executions] });
  });

  app.get("/admin/test", (req, res) => {
    executions.push("admin-handler");
    res.json({ path: "admin", executions: [...executions] });
  });

  app.get("/public/test", (req, res) => {
    executions.push("public-handler");
    res.json({ path: "public", executions: [...executions] });
  });

  const fetchHandler = (app as any).createFetchHandler();

  // Test /api path
  executions.length = 0;
  const apiRequest = createMockRequest("GET", "http://localhost:3000/api/test");
  const apiResponse = await fetchHandler(apiRequest);
  const apiData = await apiResponse.json();
  expect(apiData.executions).toEqual(["api-middleware", "api-handler"]);

  // Test /admin path
  executions.length = 0;
  const adminRequest = createMockRequest("GET", "http://localhost:3000/admin/test");
  const adminResponse = await fetchHandler(adminRequest);
  const adminData = await adminResponse.json();
  expect(adminData.executions).toEqual(["admin-middleware", "admin-handler"]);

  // Test /public path (no specific middleware)
  executions.length = 0;
  const publicRequest = createMockRequest("GET", "http://localhost:3000/public/test");
  const publicResponse = await fetchHandler(publicRequest);
  const publicData = await publicResponse.json();
  expect(publicData.executions).toEqual(["public-handler"]);
});

test("Built-in middleware integrates with custom middleware", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");

  // Custom auth middleware
  app.use((req, res, next) => {
    (req as any).authenticated = req.headers.get("x-api-key") === "secret";
    next();
  });

  // Built-in JSON middleware
  app.use(middleware.json());

  // Route that uses both
  app.post("/api/data", (req, res) => {
    if (!(req as any).authenticated) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({ 
      received: req.body,
      authenticated: (req as any).authenticated 
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test with valid auth and JSON body
  const validRequest = createMockRequest("POST", "http://localhost:3000/api/data", {
    "x-api-key": "secret",
    "content-type": "application/json"
  }, { message: "test data" });
  
  const validResponse = await fetchHandler(validRequest);
  const validData = await validResponse.json();
  
  expect(validResponse.status).toBe(200);
  expect(validData.received).toEqual({ message: "test data" });
  expect(validData.authenticated).toBe(true);

  // Test with invalid auth
  const invalidRequest = createMockRequest("POST", "http://localhost:3000/api/data", {
    "x-api-key": "wrong",
    "content-type": "application/json"
  }, { message: "test data" });
  
  const invalidResponse = await fetchHandler(invalidRequest);
  expect(invalidResponse.status).toBe(401);
});

test("Error in middleware stops execution", async () => {
  const app = createServer();
  let handlerExecuted = false;

  app.use((req, res, next) => {
    throw new Error("Middleware error");
  });

  app.get("/test", (req, res) => {
    handlerExecuted = true;
    res.json({ success: true });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/test");
  
  const response = await fetchHandler(mockRequest);
  
  expect(response.status).toBe(500);
  expect(handlerExecuted).toBe(false);
});

test("Route-specific middleware chains with path middleware", async () => {
  const app = createServer();
  const order: string[] = [];

  // Path middleware for /api
  app.use("/api", (req, res, next) => {
    order.push("path-middleware");
    next();
  });

  // Route with its own middleware chain
  app.get("/api/users", 
    (req, res, next) => {
      order.push("route-middleware-1");
      next();
    },
    (req, res, next) => {
      order.push("route-middleware-2");
      next();
    },
    (req, res) => {
      order.push("handler");
      res.json({ order: [...order] });
    }
  );

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/api/users");
  
  const response = await fetchHandler(mockRequest);
  const data = await response.json();

  expect(data.order).toEqual([
    "path-middleware",
    "route-middleware-1", 
    "route-middleware-2",
    "handler"
  ]);
});

test("Middleware modifying response headers works", async () => {
  const app = createServer();

  // Middleware that adds CORS headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
    next();
  });

  // Middleware that adds cache headers
  app.use((req, res, next) => {
    res.header("Cache-Control", "no-cache");
    next();
  });

  app.get("/test", (req, res) => {
    res.json({ message: "test" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/test");
  
  const response = await fetchHandler(mockRequest);

  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,POST,PUT,DELETE");
  expect(response.headers.get("Cache-Control")).toBe("no-cache");
});

test("Multiple middleware can use same next() function safely", async () => {
  const app = createServer();
  let nextCallCount = 0;

  app.use((req, res, next) => {
    nextCallCount++;
    next();
  });

  app.use((req, res, next) => {
    nextCallCount++;
    next();
  });

  app.use((req, res, next) => {
    nextCallCount++;
    next();
  });

  app.get("/test", (req, res) => {
    res.json({ nextCallCount });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const mockRequest = createMockRequest("GET", "http://localhost:3000/test");
  
  const response = await fetchHandler(mockRequest);
  const data = await response.json();

  expect(data.nextCallCount).toBe(3);
});

test("Conditional middleware execution", async () => {
  const app = createServer();
  const executions: string[] = [];

  // Conditional middleware based on user agent
  app.use((req, res, next) => {
    if (req.headers.get("user-agent")?.includes("Bot")) {
      executions.push("bot-detected");
      res.status(403).json({ error: "Bots not allowed" });
      return;
    }
    executions.push("human-user");
    next();
  });

  app.get("/test", (req, res) => {
    executions.push("handler");
    res.json({ message: "success" });
  });

  const fetchHandler = (app as any).createFetchHandler();

  // Test with bot user agent
  executions.length = 0;
  const botRequest = createMockRequest("GET", "http://localhost:3000/test", {
    "user-agent": "GoogleBot/1.0"
  });
  const botResponse = await fetchHandler(botRequest);
  expect(botResponse.status).toBe(403);
  expect(executions).toEqual(["bot-detected"]);

  // Test with normal user agent
  executions.length = 0;
  const humanRequest = createMockRequest("GET", "http://localhost:3000/test", {
    "user-agent": "Mozilla/5.0"
  });
  const humanResponse = await fetchHandler(humanRequest);
  expect(humanResponse.status).toBe(200);
  expect(executions).toEqual(["human-user", "handler"]);
});