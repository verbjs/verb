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
  if (body !== undefined) {
    if (typeof body === "string") {
      requestInit.body = body;
    } else {
      requestInit.body = JSON.stringify(body);
    }
  }
  
  return new Request(url, requestInit);
};

test("Static route performance", async () => {
  const app = createServer();
  
  // Add many static routes
  for (let i = 0; i < 100; i++) {
    app.get(`/route${i}`, (req, res) => {
      res.json({ route: i });
    });
  }

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test first route (should be fast due to Map optimization)
  const start1 = performance.now();
  const request1 = createMockRequest("GET", "http://localhost:3000/route0");
  const response1 = await fetchHandler(request1);
  const duration1 = performance.now() - start1;
  
  expect(response1.status).toBe(200);
  expect(duration1).toBeLessThan(10); // Should be very fast
  
  // Test last route (should still be fast)
  const start2 = performance.now();
  const request2 = createMockRequest("GET", "http://localhost:3000/route99");
  const response2 = await fetchHandler(request2);
  const duration2 = performance.now() - start2;
  
  expect(response2.status).toBe(200);
  expect(duration2).toBeLessThan(10); // Should still be fast
});

test("Dynamic route performance", async () => {
  const app = createServer();
  
  // Add many dynamic routes
  for (let i = 0; i < 50; i++) {
    app.get(`/users/:id/posts${i}/:postId`, (req, res) => {
      res.json({ 
        userId: req.params?.id, 
        postId: req.params?.postId, 
        route: i 
      });
    });
  }

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test dynamic route matching performance
  const start = performance.now();
  const request = createMockRequest("GET", "http://localhost:3000/users/123/posts25/456");
  const response = await fetchHandler(request);
  const duration = performance.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(20); // Should be reasonably fast even with many dynamic routes
  
  const data = await response.json();
  expect(data.userId).toBe("123");
  expect(data.postId).toBe("456");
  expect(data.route).toBe(25);
});

test("Middleware chain performance", async () => {
  const app = createServer();
  
  // Add many middleware
  for (let i = 0; i < 20; i++) {
    app.use((req, res, next) => {
      (req as any)[`middleware${i}`] = i;
      next();
    });
  }
  
  app.get("/test", (req, res) => {
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      sum += (req as any)[`middleware${i}`] || 0;
    }
    res.json({ middlewareSum: sum });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const start = performance.now();
  const request = createMockRequest("GET", "http://localhost:3000/test");
  const response = await fetchHandler(request);
  const duration = performance.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(15); // Should handle many middleware efficiently
  
  const data = await response.json();
  expect(data.middlewareSum).toBe(190); // Sum of 0+1+2+...+19
});

test("Large JSON payload performance", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  app.use(middleware.json({ limit: "10mb" }));
  
  app.post("/large", (req, res) => {
    res.json({ 
      received: Array.isArray(req.body),
      length: req.body?.length || 0
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Create large JSON payload (10,000 items)
  const largePayload = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    data: `Data for item ${i}`.repeat(10)
  }));
  
  const start = performance.now();
  const request = createMockRequest("POST", "http://localhost:3000/large", {
    "content-type": "application/json"
  }, largePayload);
  const response = await fetchHandler(request);
  const duration = performance.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(100); // Should handle large payloads reasonably
  
  const data = await response.json();
  expect(data.received).toBe(true);
  expect(data.length).toBe(10000);
});

test("Many concurrent requests simulation", async () => {
  const app = createServer();
  
  app.get("/concurrent/:id", async (req, res) => {
    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, 5));
    res.json({ 
      id: req.params?.id,
      timestamp: Date.now()
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Simulate 50 concurrent requests
  const requests = Array.from({ length: 50 }, (_, i) => 
    createMockRequest("GET", `http://localhost:3000/concurrent/${i}`)
  );
  
  const start = performance.now();
  const responses = await Promise.all(
    requests.map(request => fetchHandler(request))
  );
  const duration = performance.now() - start;
  
  // All requests should succeed
  expect(responses.every(r => r.status === 200)).toBe(true);
  
  // Should handle concurrent requests efficiently
  expect(duration).toBeLessThan(200); // With 5ms delay each, sequential would take 250ms
  
  // Verify all responses are different
  const responseData = await Promise.all(responses.map(r => r.json()));
  const ids = responseData.map(d => d.id);
  const uniqueIds = new Set(ids);
  expect(uniqueIds.size).toBe(50);
});

test("Route matching performance with complex patterns", async () => {
  const app = createServer();
  
  // Add routes with various complexity levels (non-conflicting paths)
  app.get("/simple", (req, res) => res.json({ type: "simple" }));
  app.get("/users/:id", (req, res) => res.json({ type: "param" }));
  app.get("/products/:id(\\d+)", (req, res) => res.json({ type: "regex" }));
  app.get("/files/*", (req, res) => res.json({ type: "wildcard" }));
  app.get("/api/:version(v\\d+)/users/:id(\\d+)/posts/:postId", (req, res) =>
    res.json({ type: "complex" }));

  const fetchHandler = (app as any).createFetchHandler();

  const testCases = [
    { url: "/simple", expectedType: "simple" },
    { url: "/users/abc", expectedType: "param" },
    { url: "/products/123", expectedType: "regex" },
    { url: "/files/deep/path/file.txt", expectedType: "wildcard" },
    { url: "/api/v1/users/123/posts/456", expectedType: "complex" }
  ];
  
  for (const testCase of testCases) {
    const start = performance.now();
    const request = createMockRequest("GET", `http://localhost:3000${testCase.url}`);
    const response = await fetchHandler(request);
    const duration = performance.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(5); // Each route match should be very fast
    
    const data = await response.json();
    expect(data.type).toBe(testCase.expectedType);
  }
});

test("Memory usage with many routes", async () => {
  const app = createServer();
  
  // Add many routes to test memory efficiency
  const routeCount = 1000;
  for (let i = 0; i < routeCount; i++) {
    app.get(`/route${i}/:param${i}`, (req, res) => {
      res.json({ route: i, param: req.params?.[`param${i}`] });
    });
  }

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test that we can still route efficiently
  const start = performance.now();
  const request = createMockRequest("GET", "http://localhost:3000/route500/testvalue");
  const response = await fetchHandler(request);
  const duration = performance.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(50); // Should still be fast with many routes
  
  const data = await response.json();
  expect(data.route).toBe(500);
  expect(data.param).toBe("testvalue");
});

test("Cookie parsing performance", async () => {
  const app = createServer();
  
  app.get("/cookies", (req, res) => {
    res.json({ 
      cookieCount: Object.keys(req.cookies || {}).length,
      allCookies: req.cookies
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Create large cookie header with many cookies
  const cookies = Array.from({ length: 100 }, (_, i) => `cookie${i}=value${i}`).join("; ");
  
  const start = performance.now();
  const request = createMockRequest("GET", "http://localhost:3000/cookies", {
    cookie: cookies
  });
  const response = await fetchHandler(request);
  const duration = performance.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(10); // Cookie parsing should be fast
  
  const data = await response.json();
  expect(data.cookieCount).toBe(100);
});

test("Query string parsing performance", async () => {
  const app = createServer();
  
  app.get("/query", (req, res) => {
    res.json({
      paramCount: Object.keys(req.query || {}).length,
      hasLargeParam: 'largeParam' in (req.query || {})
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Create large query string
  const params = Array.from({ length: 100 }, (_, i) => `param${i}=value${i}`);
  params.push(`largeParam=${"x".repeat(1000)}`); // One large parameter
  const queryString = "?" + params.join("&");
  
  const start = performance.now();
  const request = createMockRequest("GET", `http://localhost:3000/query${queryString}`);
  const response = await fetchHandler(request);
  const duration = performance.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(15); // Query parsing should be fast
  
  const data = await response.json();
  expect(data.paramCount).toBe(101);
  expect(data.hasLargeParam).toBe(true);
});

test("Response creation performance", async () => {
  const app = createServer();
  
  app.get("/response", (req, res) => {
    // Chain many response operations
    res.status(200)
       .header("X-Custom-1", "value1")
       .header("X-Custom-2", "value2")
       .header("X-Custom-3", "value3")
       .headers({
         "X-Bulk-1": "bulk1",
         "X-Bulk-2": "bulk2",
         "X-Bulk-3": "bulk3"
       })
       .cookie("cookie1", "value1")
       .cookie("cookie2", "value2")
       .json({ 
         message: "Performance test",
         data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item${i}` }))
       });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const start = performance.now();
  const request = createMockRequest("GET", "http://localhost:3000/response");
  const response = await fetchHandler(request);
  const duration = performance.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(20); // Response creation should be fast
  
  // Verify all headers and cookies are set
  expect(response.headers.get("X-Custom-1")).toBe("value1");
  expect(response.headers.get("X-Bulk-1")).toBe("bulk1");
  
  const data = await response.json();
  expect(data.data).toHaveLength(100);
});

test("Error handling performance impact", async () => {
  const app = createServer();
  
  // Route that might throw errors
  app.get("/maybe-error/:shouldError", (req, res) => {
    if (req.params?.shouldError === "true") {
      throw new Error("Intentional error");
    }
    res.json({ success: true });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test successful requests (should be fast)
  const successStart = performance.now();
  const successRequest = createMockRequest("GET", "http://localhost:3000/maybe-error/false");
  const successResponse = await fetchHandler(successRequest);
  const successDuration = performance.now() - successStart;
  
  expect(successResponse.status).toBe(200);
  expect(successDuration).toBeLessThan(5);
  
  // Test error requests (should not be significantly slower)
  const errorStart = performance.now();
  const errorRequest = createMockRequest("GET", "http://localhost:3000/maybe-error/true");
  const errorResponse = await fetchHandler(errorRequest);
  const errorDuration = performance.now() - errorStart;
  
  expect(errorResponse.status).toBe(500);
  expect(errorDuration).toBeLessThan(10); // Error handling shouldn't add much overhead
  
  // Error handling should not be more than 10x slower than success
  expect(errorDuration / successDuration).toBeLessThan(10);
});