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

test("return res.json() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-json", (req, res) => {
    return res.json({ message: "returned", status: "success" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-json");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  
  const data = await response.json();
  expect(data.message).toBe("returned");
  expect(data.status).toBe("success");
});

test("return res.send() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-send", (req, res) => {
    return res.send("Hello from returned send");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-send");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(await response.text()).toBe("Hello from returned send");
});

test("return res.html() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-html", (req, res) => {
    return res.html("<h1>Returned HTML</h1>");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-html");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/html");
  expect(await response.text()).toBe("<h1>Returned HTML</h1>");
});

test("return res.text() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-text", (req, res) => {
    return res.text("Plain text returned");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-text");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(await response.text()).toBe("Plain text returned");
});

test("return res.redirect() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-redirect", (req, res) => {
    return res.redirect("/new-location");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-redirect");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/new-location");
  expect(await response.text()).toBe("Redirecting to /new-location");
});

test("return res.redirect() with custom status works", async () => {
  const app = createServer();
  
  app.get("/return-redirect-301", (req, res) => {
    return res.redirect("/permanent-location", 301);
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-redirect-301");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(301);
  expect(response.headers.get("Location")).toBe("/permanent-location");
});

test("return res.end() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-end", (req, res) => {
    res.status(204);
    return res.end();
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-end");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
});

test("chained return pattern works", async () => {
  const app = createServer();
  
  app.get("/return-chain", (req, res) => {
    return res.status(201).json({ created: true, id: 123 });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-chain");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(201);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  
  const data = await response.json();
  expect(data.created).toBe(true);
  expect(data.id).toBe(123);
});

test("return with headers pattern works", async () => {
  const app = createServer();
  
  app.get("/return-headers", (req, res) => {
    return res.header("X-Custom", "returned").json({ message: "with headers" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-headers");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Custom")).toBe("returned");
  
  const data = await response.json();
  expect(data.message).toBe("with headers");
});

test("early return prevents further execution", async () => {
  const app = createServer();
  let afterReturnExecuted = false;
  
  app.get("/early-return", (req, res) => {
    if (req.query?.early === "true") {
      return res.json({ early: true });
    }
    
    afterReturnExecuted = true;
    return res.json({ early: false });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test early return
  const earlyRequest = createMockRequest("GET", "http://localhost:3000/early-return?early=true");
  const earlyResponse = await fetchHandler(earlyRequest);
  
  expect(earlyResponse.status).toBe(200);
  const earlyData = await earlyResponse.json();
  expect(earlyData.early).toBe(true);
  expect(afterReturnExecuted).toBe(false);
  
  // Test normal execution
  afterReturnExecuted = false;
  const normalRequest = createMockRequest("GET", "http://localhost:3000/early-return?early=false");
  const normalResponse = await fetchHandler(normalRequest);
  
  expect(normalResponse.status).toBe(200);
  const normalData = await normalResponse.json();
  expect(normalData.early).toBe(false);
  expect(afterReturnExecuted).toBe(true);
});

test("return res.react() with function component", async () => {
  const app = createServer();
  
  // Mock React component
  const TestComponent = (props: { name: string }) => {
    return `<h1>Hello ${props.name}!</h1>`;
  };
  
  app.get("/return-react", (req, res) => {
    return res.react(TestComponent, { name: "World" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-react");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/html");
  expect(await response.text()).toBe("<h1>Hello World!</h1>");
});

test("return res.react() with HTML string", async () => {
  const app = createServer();
  
  app.get("/return-react-string", (req, res) => {
    return res.react("<div>Static HTML</div>");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-react-string");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/html");
  expect(await response.text()).toBe("<div>Static HTML</div>");
});

test("return res.react() with object fallback", async () => {
  const app = createServer();
  
  app.get("/return-react-object", (req, res) => {
    return res.react({ message: "Fallback object" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-react-object");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/html");
  expect(await response.text()).toBe('{"message":"Fallback object"}');
});

test("return res.react() error handling", async () => {
  const app = createServer();
  
  // Component that throws error
  const ErrorComponent = () => {
    throw new Error("Component error");
  };
  
  app.get("/return-react-error", (req, res) => {
    return res.react(ErrorComponent);
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-react-error");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("Error rendering React component");
});

test("async return patterns work", async () => {
  const app = createServer();
  
  app.get("/async-return", async (req, res) => {
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 10));
    return res.json({ async: true, timestamp: Date.now() });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/async-return");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  
  const data = await response.json();
  expect(data.async).toBe(true);
  expect(typeof data.timestamp).toBe("number");
});

test("return prevents double response errors", async () => {
  const app = createServer();
  
  app.get("/prevent-double", (req, res) => {
    if (req.query?.condition === "true") {
      return res.json({ early: true });
    }
    // This should not execute when condition is true
    res.json({ late: true });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/prevent-double?condition=true");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.early).toBe(true);
  expect(data.late).toBeUndefined();
});

test("conditional returns work correctly", async () => {
  const app = createServer();
  
  app.post("/conditional", (req, res) => {
    const { action } = req.query || {};
    
    if (action === "redirect") {
      return res.redirect("/redirected");
    }
    
    if (action === "error") {
      return res.status(400).json({ error: "Bad request" });
    }
    
    return res.json({ action: action || "default" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test redirect
  const redirectRequest = createMockRequest("POST", "http://localhost:3000/conditional?action=redirect");
  const redirectResponse = await fetchHandler(redirectRequest);
  expect(redirectResponse.status).toBe(302);
  expect(redirectResponse.headers.get("Location")).toBe("/redirected");
  
  // Test error
  const errorRequest = createMockRequest("POST", "http://localhost:3000/conditional?action=error");
  const errorResponse = await fetchHandler(errorRequest);
  expect(errorResponse.status).toBe(400);
  const errorData = await errorResponse.json();
  expect(errorData.error).toBe("Bad request");
  
  // Test default
  const defaultRequest = createMockRequest("POST", "http://localhost:3000/conditional");
  const defaultResponse = await fetchHandler(defaultRequest);
  expect(defaultResponse.status).toBe(200);
  const defaultData = await defaultResponse.json();
  expect(defaultData.action).toBe("default");
});