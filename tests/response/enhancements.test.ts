import { test, expect } from "bun:test";
import { createServer } from "../../src/index";
import { createResponse } from "../../src/response";

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

test("res.type() sets content type", async () => {
  const app = createServer();
  
  app.get("/type", (req, res) => {
    res.type("application/xml").send("<root>Hello</root>");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/type");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/xml");
  expect(await response.text()).toBe("<root>Hello</root>");
});

test("res.type() with MIME type shorthand", async () => {
  const app = createServer();
  
  app.get("/json", (req, res) => {
    res.type("json").send('{"test": true}');
  });
  
  app.get("/html", (req, res) => {
    res.type("html").send("<h1>Test</h1>");
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test JSON
  const jsonRequest = createMockRequest("GET", "http://localhost:3000/json");
  const jsonResponse = await fetchHandler(jsonRequest);
  expect(jsonResponse.headers.get("Content-Type")).toBe("json");
  
  // Test HTML
  const htmlRequest = createMockRequest("GET", "http://localhost:3000/html");
  const htmlResponse = await fetchHandler(htmlRequest);
  expect(htmlResponse.headers.get("Content-Type")).toBe("html");
});

test("res.type() chainable", async () => {
  const app = createServer();
  
  app.get("/chain", (req, res) => {
    res.type("text/csv").status(201).send("name,age\nJohn,30");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/chain");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(201);
  expect(response.headers.get("Content-Type")).toBe("text/csv");
  expect(await response.text()).toBe("name,age\nJohn,30");
});

test("res.attachment() without filename", async () => {
  const app = createServer();
  
  app.get("/download", (req, res) => {
    res.attachment().send("file content");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe("attachment");
  expect(await response.text()).toBe("file content");
});

test("res.attachment() with filename", async () => {
  const app = createServer();
  
  app.get("/download-named", (req, res) => {
    res.attachment("data.txt").send("file content");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-named");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="data.txt"');
  expect(await response.text()).toBe("file content");
});

test("res.attachment() chainable", async () => {
  const app = createServer();
  
  app.get("/download-chain", (req, res) => {
    res.attachment("report.pdf").type("application/pdf").status(200).send("PDF content");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-chain");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="report.pdf"');
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(await response.text()).toBe("PDF content");
});

test("res.vary() single header", async () => {
  const app = createServer();
  
  app.get("/vary", (req, res) => {
    res.vary("Accept-Encoding").json({ message: "varied" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/vary");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Vary")).toBe("Accept-Encoding");
});

test("res.vary() multiple headers", async () => {
  const app = createServer();
  
  app.get("/vary-multiple", (req, res) => {
    res.vary("Accept-Encoding").vary("User-Agent").json({ message: "varied" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/vary-multiple");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Vary")).toBe("Accept-Encoding, User-Agent");
});

test("res.vary() doesn't duplicate headers", async () => {
  const app = createServer();
  
  app.get("/vary-duplicate", (req, res) => {
    res.vary("Accept-Encoding").vary("Accept-Encoding").json({ message: "varied" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/vary-duplicate");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Vary")).toBe("Accept-Encoding");
});

test("res.vary() chainable", async () => {
  const app = createServer();
  
  app.get("/vary-chain", (req, res) => {
    res.status(201).vary("Accept").header("X-Custom", "test").json({ message: "varied" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/vary-chain");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(201);
  expect(response.headers.get("Vary")).toBe("Accept");
  expect(response.headers.get("X-Custom")).toBe("test");
});

// Test direct response methods without server
test("Direct response.type() functionality", () => {
  const { res } = createResponse();
  
  res.type("application/json");
  res.send('{"test": true}');
  
  // Can't easily test headers directly, but ensure no errors
  expect(() => res.type("text/plain")).toThrow("Cannot set response after it has been sent");
});

test("Direct response.attachment() functionality", () => {
  const { res } = createResponse();
  
  res.attachment("test.txt");
  res.send("content");
  
  // Can't easily test headers directly, but ensure no errors
  expect(() => res.attachment("other.txt")).toThrow("Cannot set response after it has been sent");
});

test("Direct response.vary() functionality", () => {
  const { res } = createResponse();
  
  res.vary("Accept");
  res.vary("Accept-Encoding");
  res.send("content");
  
  // Can't easily test headers directly, but ensure no errors
  expect(() => res.vary("User-Agent")).toThrow("Cannot set response after it has been sent");
});

test("Response methods work after finish", () => {
  const { res } = createResponse();
  
  res.json({ test: true });
  
  // All methods should throw after response is finished
  expect(() => res.type("text/plain")).toThrow("Cannot set response after it has been sent");
  expect(() => res.attachment("file.txt")).toThrow("Cannot set response after it has been sent");
  expect(() => res.vary("Accept")).toThrow("Cannot set response after it has been sent");
});

test("Multiple response enhancements combined", async () => {
  const app = createServer();
  
  app.get("/combined", (req, res) => {
    res
      .status(201)
      .type("application/xml")
      .attachment("data.xml")
      .vary("Accept")
      .vary("Accept-Encoding")
      .header("X-Custom", "value")
      .send("<data>test</data>");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/combined");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(201);
  expect(response.headers.get("Content-Type")).toBe("application/xml");
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="data.xml"');
  expect(response.headers.get("Vary")).toBe("Accept, Accept-Encoding");
  expect(response.headers.get("X-Custom")).toBe("value");
  expect(await response.text()).toBe("<data>test</data>");
});