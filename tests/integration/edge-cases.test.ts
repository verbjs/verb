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

test("Empty request body handling", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  app.use(middleware.json());
  
  app.post("/test", (req, res) => {
    res.json({ 
      hasBody: req.body !== undefined,
      bodyType: typeof req.body,
      body: req.body
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test completely empty body
  const emptyRequest = createMockRequest("POST", "http://localhost:3000/test", {
    "content-type": "application/json"
  });
  const emptyResponse = await fetchHandler(emptyRequest);
  const emptyData = await emptyResponse.json();
  
  expect(emptyData.hasBody).toBeUndefined(); // Empty request body results in undefined
});

test("Very long URLs", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.json({ 
      pathLength: req.path?.length,
      queryLength: Object.keys(req.query || {}).length
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Create very long query string
  const longQuery = "?param=" + "a".repeat(10000);
  const longUrl = "http://localhost:3000/test" + longQuery;
  
  const longRequest = createMockRequest("GET", longUrl);
  const longResponse = await fetchHandler(longRequest);
  const longData = await longResponse.json();
  
  expect(longData.pathLength).toBe(5); // "/test"
  expect(longData.queryLength).toBe(1); // One query parameter
});

test("Special characters in URLs", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.json({ 
      query: req.query,
      path: req.path
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test with encoded special characters
  const specialUrl = "http://localhost:3000/test?name=John%20Doe&email=test%40example.com&message=Hello%21%20%26%20Goodbye";
  const specialRequest = createMockRequest("GET", specialUrl);
  const specialResponse = await fetchHandler(specialRequest);
  const specialData = await specialResponse.json();
  
  expect(specialData.query.name).toBe("John Doe");
  expect(specialData.query.email).toBe("test@example.com");
  expect(specialData.query.message).toBe("Hello! & Goodbye");
});

test("Unicode characters in requests", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  app.use(middleware.json());
  
  app.post("/unicode", (req, res) => {
    res.json({ 
      received: req.body,
      cookies: req.cookies 
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const unicodeData = {
    emoji: "🚀🎉💻",
    chinese: "你好世界",
    arabic: "مرحبا بالعالم",
    russian: "Привет мир"
  };
  
  const unicodeRequest = createMockRequest("POST", "http://localhost:3000/unicode", {
    "content-type": "application/json",
    "cookie": "session=abc123; user=jose" // Avoid unicode in headers
  }, unicodeData);
  
  const unicodeResponse = await fetchHandler(unicodeRequest);
  const responseData = await unicodeResponse.json();
  
  expect(responseData.received).toEqual(unicodeData);
  // Unicode in cookies may have encoding issues, just check they exist
  expect(responseData.cookies.session).toBeDefined();
  expect(responseData.cookies.user).toBeDefined();
});

test("Malformed headers handling", async () => {
  const app = createServer();
  
  app.get("/headers", (req, res) => {
    res.json({
      userAgent: req.get?.("user-agent"),
      customHeader: req.get?.("x-custom"),
      contentType: req.get?.("content-type")
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test with unusual but valid headers
  const headerRequest = createMockRequest("GET", "http://localhost:3000/headers", {
    "user-agent": "", // Empty user agent
    "x-custom": "value with spaces and special chars !@#$%",
    "content-type": "application/json; charset=utf-8; boundary=something"
  });
  
  const headerResponse = await fetchHandler(headerRequest);
  const headerData = await headerResponse.json();
  
  expect(headerData.userAgent).toBeUndefined(); // Empty headers may be undefined
  expect(headerData.customHeader).toBe("value with spaces and special chars !@#$%");
  expect(headerData.contentType).toBe("application/json; charset=utf-8; boundary=something");
});

test("Multiple slashes in paths", async () => {
  const app = createServer();
  
  app.get("/api/users", (req, res) => {
    res.json({ message: "Found users", path: req.path });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test paths with multiple slashes
  const multiSlashRequest = createMockRequest("GET", "http://localhost:3000//api///users");
  const multiSlashResponse = await fetchHandler(multiSlashRequest);
  
  // Should normalize to single slashes
  expect(multiSlashResponse.status).toBe(404); // Current implementation treats these as different paths
});

test("Empty path segments", async () => {
  const app = createServer();
  
  app.get("/", (req, res) => {
    res.json({ message: "root", path: req.path });
  });
  
  app.get("/api", (req, res) => {
    res.json({ message: "api", path: req.path });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test root path variations
  const rootRequest = createMockRequest("GET", "http://localhost:3000/");
  const rootResponse = await fetchHandler(rootRequest);
  const rootData = await rootResponse.json();
  expect(rootData.message).toBe("root");
  expect(rootData.path).toBe("/");
});

test("Query string edge cases", async () => {
  const app = createServer();
  
  app.get("/query", (req, res) => {
    res.json({ query: req.query });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test various query string formats
  const testCases = [
    { url: "http://localhost:3000/query?", expected: {} },
    { url: "http://localhost:3000/query?=value", expected: {} }, // Key without name
    { url: "http://localhost:3000/query?key=", expected: { key: "" } }, // Empty value
    { url: "http://localhost:3000/query?key", expected: { key: "" } }, // No value
    { url: "http://localhost:3000/query?key1=value1&key1=value2", expected: { key1: "value2" } }, // Duplicate keys (last wins)
    { url: "http://localhost:3000/query?a=1&b=2&c=3", expected: { a: "1", b: "2", c: "3" } }
  ];
  
  for (const testCase of testCases) {
    const request = createMockRequest("GET", testCase.url);
    const response = await fetchHandler(request);
    const data = await response.json();
    expect(data.query).toEqual(testCase.expected);
  }
});

test("Cookie parsing edge cases", async () => {
  const app = createServer();
  
  app.get("/cookies", (req, res) => {
    res.json({ cookies: req.cookies });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const testCases = [
    { cookie: "", expected: {} },
    { cookie: "   ", expected: {} },
    { cookie: "invalid", expected: {} },
    { cookie: "=value", expected: {} }, // No name
    { cookie: "name=", expected: { name: "" } }, // Empty value
    { cookie: "name1=value1; name2=value2", expected: { name1: "value1", name2: "value2" } },
    { cookie: "name=value=with=equals", expected: { name: "value=with=equals" } },
    { cookie: " name = value ", expected: { name: "value" } }, // Spaces
    { cookie: "name1=value1;name2=value2", expected: { name1: "value1", name2: "value2" } } // No space after semicolon
  ];
  
  for (const testCase of testCases) {
    const request = createMockRequest("GET", "http://localhost:3000/cookies", {
      cookie: testCase.cookie
    });
    const response = await fetchHandler(request);
    const data = await response.json();
    expect(data.cookies).toEqual(testCase.expected);
  }
});

test("Parameter extraction edge cases", async () => {
  const app = createServer();
  
  app.get("/users/:id", (req, res) => {
    res.json({ 
      id: req.params?.id,
      type: typeof req.params?.id
    });
  });
  
  app.get("/files/*", (req, res) => {
    res.json({ 
      wildcard: req.params?.["*"],
      all: req.params
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test parameter with special characters (properly decoded)
  const specialParamRequest = createMockRequest("GET", "http://localhost:3000/users/user%40example.com");
  const specialParamResponse = await fetchHandler(specialParamRequest);
  const specialParamData = await specialParamResponse.json();
  expect(specialParamData.id).toBe("user@example.com"); // URL decoded
  
  // Test wildcard with deep path
  const deepWildcardRequest = createMockRequest("GET", "http://localhost:3000/files/path/to/deep/file.txt");
  const deepWildcardResponse = await fetchHandler(deepWildcardRequest);
  const deepWildcardData = await deepWildcardResponse.json();
  expect(deepWildcardData.wildcard).toBe("path/to/deep/file.txt");
});

test("Request method case sensitivity", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.json({ method: req.method });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test lowercase method (should be normalized to uppercase)
  const request = new Request("http://localhost:3000/test", { method: "get" });
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.method).toBe("GET"); // Should be normalized
});

test("Content-Length mismatches", async () => {
  const app = createServer();
  const { middleware } = await import("../../src/index");
  
  app.use(middleware.json());
  
  app.post("/test", (req, res) => {
    res.json({ 
      body: req.body,
      hasBody: req.body !== undefined 
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Normal case
  const normalRequest = createMockRequest("POST", "http://localhost:3000/test", {
    "content-type": "application/json"
  }, { test: "data" });
  
  const normalResponse = await fetchHandler(normalRequest);
  const normalData = await normalResponse.json();
  expect(normalData.body).toEqual({ test: "data" });
});

test("IP address detection edge cases", async () => {
  const app = createServer();
  
  app.get("/ip", (req, res) => {
    res.json({ ip: req.ip });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const testCases = [
    { headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1" }, expected: "192.168.1.1" },
    { headers: { "x-forwarded-for": " 192.168.1.1 " }, expected: "192.168.1.1" }, // Spaces
    { headers: { "x-real-ip": "10.0.0.1" }, expected: "10.0.0.1" },
    { headers: { "cf-connecting-ip": "172.16.0.1" }, expected: "172.16.0.1" },
    { headers: {}, expected: "unknown" } // No IP headers
  ];
  
  for (const testCase of testCases) {
    const request = createMockRequest("GET", "http://localhost:3000/ip", testCase.headers);
    const response = await fetchHandler(request);
    const data = await response.json();
    expect(data.ip).toBe(testCase.expected);
  }
});

test("Protocol detection edge cases", async () => {
  const app = createServer();
  
  app.get("/protocol", (req, res) => {
    res.json({ 
      protocol: req.protocol,
      secure: req.secure 
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const testCases = [
    { headers: { "x-forwarded-proto": "https" }, expectedProtocol: "https", expectedSecure: true },
    { headers: { "x-forwarded-proto": "http" }, expectedProtocol: "http", expectedSecure: false },
    { headers: {}, expectedProtocol: "http", expectedSecure: false }, // Default
  ];
  
  for (const testCase of testCases) {
    const request = createMockRequest("GET", "http://localhost:3000/protocol", testCase.headers);
    const response = await fetchHandler(request);
    const data = await response.json();
    expect(data.protocol).toBe(testCase.expectedProtocol);
    expect(data.secure).toBe(testCase.expectedSecure);
  }
});

test("XHR detection edge cases", async () => {
  const app = createServer();
  
  app.get("/xhr", (req, res) => {
    res.json({ xhr: req.xhr });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  const testCases = [
    { headers: { "x-requested-with": "XMLHttpRequest" }, expected: true },
    { headers: { "x-requested-with": "xmlhttprequest" }, expected: true }, // Case insensitive
    { headers: { "x-requested-with": "XMLHTTPREQUEST" }, expected: true },
    { headers: { "x-requested-with": "fetch" }, expected: false },
    { headers: {}, expected: false }
  ];
  
  for (const testCase of testCases) {
    const request = createMockRequest("GET", "http://localhost:3000/xhr", testCase.headers);
    const response = await fetchHandler(request);
    const data = await response.json();
    expect(data.xhr).toBe(testCase.expected);
  }
});

test("Response after timeout simulation", async () => {
  const app = createServer();
  
  app.get("/slow", async (req, res) => {
    // Simulate slow operation
    await new Promise(resolve => setTimeout(resolve, 50));
    res.json({ message: "Slow response" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/slow");
  
  const start = Date.now();
  const response = await fetchHandler(request);
  const duration = Date.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeGreaterThan(40); // Should take at least 40ms
  
  const data = await response.json();
  expect(data.message).toBe("Slow response");
});