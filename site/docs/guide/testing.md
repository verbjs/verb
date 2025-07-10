# Testing

Comprehensive testing strategies for Verb applications including unit tests, integration tests, and performance testing.

## Overview

Testing approaches:
- **Unit Testing**: Test individual functions and components
- **Integration Testing**: Test server endpoints and middleware
- **Performance Testing**: Load testing and benchmarking
- **Security Testing**: Vulnerability and penetration testing
- **End-to-End Testing**: Full application workflow testing

## Unit Testing

### Basic Test Setup

```typescript
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { createServer } from "verb";

describe("Verb Server Tests", () => {
  let app;
  let server;
  
  beforeAll(async () => {
    app = createServer();
    
    app.get("/test", (req, res) => {
      res.json({ message: "test" });
    });
    
    app.post("/echo", (req, res) => {
      res.json(req.body);
    });
    
    server = app.listen(0); // Use random port
  });
  
  afterAll(async () => {
    if (server) {
      server.stop();
    }
  });
  
  test("GET /test returns JSON", async () => {
    const handler = app.createFetchHandler();
    const response = await handler(new Request("http://localhost/test"));
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.message).toBe("test");
  });
  
  test("POST /echo returns request body", async () => {
    const handler = app.createFetchHandler();
    const body = { name: "John", age: 30 };
    
    const response = await handler(new Request("http://localhost/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }));
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toEqual(body);
  });
});
```

### Testing Middleware

```typescript
describe("Middleware Tests", () => {
  test("authentication middleware", async () => {
    const app = createServer();
    
    const authMiddleware = (req, res, next) => {
      const token = req.headers.get("authorization");
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.user = { id: 1, name: "Test User" };
      next();
    };
    
    app.get("/protected", authMiddleware, (req, res) => {
      res.json({ user: req.user });
    });
    
    const handler = app.createFetchHandler();
    
    // Test without token
    const response1 = await handler(new Request("http://localhost/protected"));
    expect(response1.status).toBe(401);
    
    // Test with token
    const response2 = await handler(new Request("http://localhost/protected", {
      headers: { authorization: "Bearer test-token" }
    }));
    expect(response2.status).toBe(200);
    
    const data = await response2.json();
    expect(data.user.name).toBe("Test User");
  });
  
  test("error handling middleware", async () => {
    const app = createServer();
    
    app.get("/error", (req, res) => {
      throw new Error("Test error");
    });
    
    app.use((error, req, res, next) => {
      res.status(500).json({ error: error.message });
    });
    
    const handler = app.createFetchHandler();
    const response = await handler(new Request("http://localhost/error"));
    
    expect(response.status).toBe(500);
    
    const data = await response.json();
    expect(data.error).toBe("Test error");
  });
});
```

### Testing with Database

```typescript
import { Database } from "bun:sqlite";

describe("Database Tests", () => {
  let db;
  
  beforeAll(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )
    `);
  });
  
  afterAll(() => {
    db.close();
  });
  
  test("user creation", () => {
    const insertUser = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
    const result = insertUser.run("John Doe", "john@example.com");
    
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeGreaterThan(0);
    
    const getUser = db.prepare("SELECT * FROM users WHERE id = ?");
    const user = getUser.get(result.lastInsertRowid);
    
    expect(user.name).toBe("John Doe");
    expect(user.email).toBe("john@example.com");
  });
  
  test("duplicate email constraint", () => {
    const insertUser = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
    
    // First user should succeed
    insertUser.run("User 1", "test@example.com");
    
    // Second user with same email should fail
    expect(() => {
      insertUser.run("User 2", "test@example.com");
    }).toThrow();
  });
});
```

## Integration Testing

### API Endpoint Testing

```typescript
describe("API Integration Tests", () => {
  let app;
  let baseURL;
  
  beforeAll(async () => {
    app = createServer();
    
    // Setup routes
    app.use(middleware.json());
    
    const users = new Map();
    let nextId = 1;
    
    app.get("/api/users", (req, res) => {
      res.json(Array.from(users.values()));
    });
    
    app.get("/api/users/:id", (req, res) => {
      const user = users.get(parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    });
    
    app.post("/api/users", (req, res) => {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: "Name and email required" });
      }
      
      const user = { id: nextId++, name, email };
      users.set(user.id, user);
      res.status(201).json(user);
    });
    
    app.put("/api/users/:id", (req, res) => {
      const id = parseInt(req.params.id);
      const user = users.get(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      Object.assign(user, req.body);
      res.json(user);
    });
    
    app.delete("/api/users/:id", (req, res) => {
      const id = parseInt(req.params.id);
      if (!users.delete(id)) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).end();
    });
    
    const server = app.listen(0);
    baseURL = `http://localhost:${server.port}`;
  });
  
  test("CRUD operations", async () => {
    // Create user
    const createResponse = await fetch(`${baseURL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John Doe", email: "john@example.com" })
    });
    
    expect(createResponse.status).toBe(201);
    const user = await createResponse.json();
    expect(user.id).toBeDefined();
    expect(user.name).toBe("John Doe");
    
    // Read user
    const readResponse = await fetch(`${baseURL}/api/users/${user.id}`);
    expect(readResponse.status).toBe(200);
    const readUser = await readResponse.json();
    expect(readUser).toEqual(user);
    
    // Update user
    const updateResponse = await fetch(`${baseURL}/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane Doe" })
    });
    
    expect(updateResponse.status).toBe(200);
    const updatedUser = await updateResponse.json();
    expect(updatedUser.name).toBe("Jane Doe");
    expect(updatedUser.email).toBe("john@example.com");
    
    // Delete user
    const deleteResponse = await fetch(`${baseURL}/api/users/${user.id}`, {
      method: "DELETE"
    });
    
    expect(deleteResponse.status).toBe(204);
    
    // Verify deletion
    const verifyResponse = await fetch(`${baseURL}/api/users/${user.id}`);
    expect(verifyResponse.status).toBe(404);
  });
  
  test("validation errors", async () => {
    // Missing fields
    const response1 = await fetch(`${baseURL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John" })
    });
    
    expect(response1.status).toBe(400);
    const error1 = await response1.json();
    expect(error1.error).toContain("email required");
    
    // Invalid JSON
    const response2 = await fetch(`${baseURL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json"
    });
    
    expect(response2.status).toBe(400);
  });
});
```

### WebSocket Testing

```typescript
describe("WebSocket Tests", () => {
  let app;
  let wsURL;
  
  beforeAll(async () => {
    app = createServer();
    
    const connections = new Set();
    
    app.websocket({
      open: (ws) => {
        connections.add(ws);
        ws.send(JSON.stringify({ type: "welcome", message: "Connected" }));
      },
      
      message: (ws, message) => {
        const data = JSON.parse(message);
        
        if (data.type === "echo") {
          ws.send(JSON.stringify({ type: "echo", data: data.data }));
        } else if (data.type === "broadcast") {
          for (const conn of connections) {
            conn.send(JSON.stringify({ type: "broadcast", data: data.data }));
          }
        }
      },
      
      close: (ws) => {
        connections.delete(ws);
      }
    });
    
    const server = app.listen(0);
    wsURL = `ws://localhost:${server.port}`;
  });
  
  test("WebSocket connection and echo", async () => {
    const ws = new WebSocket(wsURL);
    const messages = [];
    
    ws.onmessage = (event) => {
      messages.push(JSON.parse(event.data));
    };
    
    // Wait for connection
    await new Promise(resolve => {
      ws.onopen = resolve;
    });
    
    // Send echo message
    ws.send(JSON.stringify({ type: "echo", data: "test message" }));
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(messages).toHaveLength(2); // Welcome + echo
    expect(messages[0].type).toBe("welcome");
    expect(messages[1].type).toBe("echo");
    expect(messages[1].data).toBe("test message");
    
    ws.close();
  });
  
  test("WebSocket broadcast", async () => {
    const ws1 = new WebSocket(wsURL);
    const ws2 = new WebSocket(wsURL);
    
    const messages1 = [];
    const messages2 = [];
    
    ws1.onmessage = (event) => messages1.push(JSON.parse(event.data));
    ws2.onmessage = (event) => messages2.push(JSON.parse(event.data));
    
    // Wait for connections
    await Promise.all([
      new Promise(resolve => { ws1.onopen = resolve; }),
      new Promise(resolve => { ws2.onopen = resolve; })
    ]);
    
    // Send broadcast from ws1
    ws1.send(JSON.stringify({ type: "broadcast", data: "broadcast message" }));
    
    // Wait for messages
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Both should receive the broadcast
    expect(messages1.some(m => m.type === "broadcast")).toBe(true);
    expect(messages2.some(m => m.type === "broadcast")).toBe(true);
    
    ws1.close();
    ws2.close();
  });
});
```

## Performance Testing

### Load Testing

```typescript
describe("Performance Tests", () => {
  let app;
  let baseURL;
  
  beforeAll(async () => {
    app = createServer();
    
    app.get("/api/fast", (req, res) => {
      res.json({ message: "fast response" });
    });
    
    app.get("/api/slow", async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ message: "slow response" });
    });
    
    const server = app.listen(0);
    baseURL = `http://localhost:${server.port}`;
  });
  
  test("concurrent requests", async () => {
    const concurrency = 100;
    const requests = Array(concurrency).fill().map(() =>
      fetch(`${baseURL}/api/fast`)
    );
    
    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;
    
    // All requests should succeed
    expect(responses.every(r => r.ok)).toBe(true);
    
    // Should handle 100 concurrent requests quickly
    expect(duration).toBeLessThan(1000);
    
    console.log(`${concurrency} concurrent requests completed in ${duration}ms`);
  });
  
  test("response time under load", async () => {
    const iterations = 1000;
    const responseTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const response = await fetch(`${baseURL}/api/fast`);
      const responseTime = Date.now() - start;
      
      responseTimes.push(responseTime);
      expect(response.ok).toBe(true);
    }
    
    // Calculate statistics
    const avg = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
    const p95 = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
    
    console.log(`Average response time: ${avg.toFixed(2)}ms`);
    console.log(`95th percentile: ${p95}ms`);
    
    // Performance assertions
    expect(avg).toBeLessThan(50); // Average under 50ms
    expect(p95).toBeLessThan(100); // 95% under 100ms
  });
  
  test("memory usage under load", async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Generate load
    const requests = Array(500).fill().map(async () => {
      const response = await fetch(`${baseURL}/api/fast`);
      await response.json();
    });
    
    await Promise.all(requests);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    
    // Memory increase should be reasonable
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
  });
});
```

### Benchmark Testing

```typescript
describe("Benchmark Tests", () => {
  function benchmark(name, fn, iterations = 10000) {
    return test(name, async () => {
      const times = [];
      
      // Warm up
      for (let i = 0; i < 100; i++) {
        await fn();
      }
      
      // Measure
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await fn();
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000); // Convert to ms
      }
      
      const avg = times.reduce((a, b) => a + b) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      console.log(`${name}:`);
      console.log(`  Average: ${avg.toFixed(3)}ms`);
      console.log(`  Min: ${min.toFixed(3)}ms`);
      console.log(`  Max: ${max.toFixed(3)}ms`);
      console.log(`  Ops/sec: ${(1000 / avg).toFixed(0)}`);
      
      return { avg, min, max, opsPerSec: 1000 / avg };
    });
  }
  
  benchmark("JSON serialization", () => {
    const data = { id: 1, name: "Test", items: [1, 2, 3, 4, 5] };
    JSON.stringify(data);
  });
  
  benchmark("Database query", async () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE IF NOT EXISTS test (id INTEGER, value TEXT)");
    const stmt = db.prepare("SELECT 1");
    stmt.get();
    db.close();
  });
  
  benchmark("HTTP request handling", async () => {
    const app = createServer();
    app.get("/test", (req, res) => res.json({ ok: true }));
    
    const handler = app.createFetchHandler();
    const response = await handler(new Request("http://localhost/test"));
    await response.json();
  });
});
```

## Security Testing

### Authentication Testing

```typescript
describe("Security Tests", () => {
  let app;
  let baseURL;
  
  beforeAll(async () => {
    app = createServer();
    app.use(middleware.json());
    
    // Mock user store
    const users = new Map([
      ["admin", { id: 1, username: "admin", password: "hashed_password", role: "admin" }],
      ["user", { id: 2, username: "user", password: "hashed_password", role: "user" }]
    ]);
    
    app.post("/auth/login", (req, res) => {
      const { username, password } = req.body;
      const user = users.get(username);
      
      if (!user || password !== "correct_password") {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      res.json({ token: "mock_jwt_token", user: { id: user.id, username: user.username } });
    });
    
    app.get("/api/admin", (req, res) => {
      const token = req.headers.get("authorization");
      if (token !== "Bearer mock_jwt_token") {
        return res.status(401).json({ error: "Unauthorized" });
      }
      res.json({ data: "admin data" });
    });
    
    const server = app.listen(0);
    baseURL = `http://localhost:${server.port}`;
  });
  
  test("brute force protection", async () => {
    const attempts = Array(10).fill().map(() =>
      fetch(`${baseURL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "wrong_password" })
      })
    );
    
    const responses = await Promise.all(attempts);
    
    // All should fail
    expect(responses.every(r => r.status === 401)).toBe(true);
    
    // Should still accept correct credentials
    const validLogin = await fetch(`${baseURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "correct_password" })
    });
    
    expect(validLogin.status).toBe(200);
  });
  
  test("authorization bypass", async () => {
    // Try to access admin endpoint without token
    const response1 = await fetch(`${baseURL}/api/admin`);
    expect(response1.status).toBe(401);
    
    // Try with invalid token
    const response2 = await fetch(`${baseURL}/api/admin`, {
      headers: { authorization: "Bearer invalid_token" }
    });
    expect(response2.status).toBe(401);
    
    // Try with valid token
    const response3 = await fetch(`${baseURL}/api/admin`, {
      headers: { authorization: "Bearer mock_jwt_token" }
    });
    expect(response3.status).toBe(200);
  });
});
```

### Input Validation Testing

```typescript
describe("Input Validation Tests", () => {
  let app;
  let baseURL;
  
  beforeAll(async () => {
    app = createServer();
    app.use(middleware.json());
    
    app.post("/api/user", (req, res) => {
      const { name, email, age } = req.body;
      
      // Basic validation
      if (!name || typeof name !== "string" || name.length < 2) {
        return res.status(400).json({ error: "Invalid name" });
      }
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email" });
      }
      
      if (age !== undefined && (typeof age !== "number" || age < 0 || age > 150)) {
        return res.status(400).json({ error: "Invalid age" });
      }
      
      res.json({ success: true });
    });
    
    const server = app.listen(0);
    baseURL = `http://localhost:${server.port}`;
  });
  
  test("XSS prevention", async () => {
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "javascript:alert('xss')",
      "<img src=x onerror=alert('xss')>",
      "';DROP TABLE users;--"
    ];
    
    for (const payload of xssPayloads) {
      const response = await fetch(`${baseURL}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload, email: "test@example.com" })
      });
      
      // Should either reject the input or sanitize it
      const result = await response.json();
      if (response.ok) {
        // If accepted, ensure it's properly escaped/sanitized
        expect(result.name).not.toContain("<script>");
      } else {
        // Should reject malicious input
        expect(response.status).toBe(400);
      }
    }
  });
  
  test("SQL injection prevention", async () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "'; SELECT * FROM users; --",
      "' UNION SELECT password FROM users --"
    ];
    
    for (const payload of sqlPayloads) {
      const response = await fetch(`${baseURL}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", email: payload })
      });
      
      // Should reject SQL injection attempts
      expect(response.status).toBe(400);
    }
  });
  
  test("data type validation", async () => {
    const invalidInputs = [
      { name: 123, email: "test@example.com" }, // name not string
      { name: "Test", email: "invalid-email" }, // invalid email
      { name: "Test", email: "test@example.com", age: "thirty" }, // age not number
      { name: "Test", email: "test@example.com", age: -5 }, // negative age
      { name: "A", email: "test@example.com" }, // name too short
    ];
    
    for (const input of invalidInputs) {
      const response = await fetch(`${baseURL}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      
      expect(response.status).toBe(400);
    }
  });
});
```

## Mock Testing

```typescript
import { mock } from "bun:test";

describe("Mock Tests", () => {
  test("database mock", async () => {
    const mockDatabase = {
      query: mock(() => [{ id: 1, name: "Test User" }]),
      insert: mock(() => ({ insertId: 1 })),
      update: mock(() => ({ changes: 1 })),
      delete: mock(() => ({ changes: 1 }))
    };
    
    const userService = {
      async getUsers() {
        return mockDatabase.query("SELECT * FROM users");
      },
      
      async createUser(userData) {
        const result = mockDatabase.insert("INSERT INTO users...", userData);
        return { id: result.insertId, ...userData };
      }
    };
    
    const users = await userService.getUsers();
    expect(users).toHaveLength(1);
    expect(mockDatabase.query).toHaveBeenCalledTimes(1);
    
    const newUser = await userService.createUser({ name: "New User" });
    expect(newUser.id).toBe(1);
    expect(mockDatabase.insert).toHaveBeenCalledTimes(1);
  });
  
  test("external API mock", async () => {
    const originalFetch = global.fetch;
    
    global.fetch = mock(async (url) => {
      if (url.includes("/api/external")) {
        return new Response(JSON.stringify({ data: "mocked response" }));
      }
      return new Response("Not found", { status: 404 });
    });
    
    try {
      const response = await fetch("https://example.com/api/external");
      const data = await response.json();
      
      expect(data.data).toBe("mocked response");
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
```

## Test Utilities

```typescript
// Test helper functions
export class TestHelpers {
  static createTestServer(routes = {}) {
    const app = createServer();
    
    Object.entries(routes).forEach(([path, handler]) => {
      if (typeof handler === "function") {
        app.get(path, handler);
      } else {
        Object.entries(handler).forEach(([method, methodHandler]) => {
          app[method.toLowerCase()](path, methodHandler);
        });
      }
    });
    
    return app;
  }
  
  static async makeRequest(app, method, path, options = {}) {
    const handler = app.createFetchHandler();
    
    const request = new Request(`http://localhost${path}`, {
      method: method.toUpperCase(),
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    const response = await handler(request);
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: response.headers.get("content-type")?.includes("json") 
        ? await response.json() 
        : await response.text()
    };
  }
  
  static async waitFor(condition, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  static randomString(length = 10) {
    return Math.random().toString(36).substring(2, length + 2);
  }
  
  static randomEmail() {
    return `${this.randomString()}@example.com`;
  }
}

// Usage example
test("using test helpers", async () => {
  const app = TestHelpers.createTestServer({
    "/api/test": (req, res) => res.json({ success: true })
  });
  
  const response = await TestHelpers.makeRequest(app, "GET", "/api/test");
  
  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
});
```

## Best Practices

1. **Test Early and Often**: Write tests as you develop
2. **Test All Paths**: Cover success and error scenarios
3. **Use Mocks Wisely**: Mock external dependencies
4. **Test Performance**: Include load and stress tests
5. **Test Security**: Validate input handling and auth
6. **Keep Tests Fast**: Use in-memory databases for tests
7. **Organize Tests**: Group related tests in describe blocks
8. **Use Helpers**: Create reusable test utilities
9. **Mock External Services**: Don't depend on external APIs
10. **Continuous Testing**: Run tests in CI/CD pipelines

## Test Coverage

```typescript
// Run tests with coverage
// bun test --coverage

// Coverage configuration in package.json
{
  "scripts": {
    "test": "bun test",
    "test:coverage": "bun test --coverage",
    "test:watch": "bun test --watch"
  }
}
```

## Next Steps

- [Security](/guide/security) - Security testing in depth
- [Performance](/guide/performance) - Performance optimization
- [Monitoring](/guide/monitoring) - Production monitoring