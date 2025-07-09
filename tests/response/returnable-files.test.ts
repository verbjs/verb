import { test, expect } from "bun:test";
import { createServer } from "../../src/index";
import path from "path";

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

const testFilesDir = path.join(process.cwd(), "test-files");

test("return await res.download() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-download", async (req, res) => {
    return await res.download(path.join(testFilesDir, "sample.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-download");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="sample.txt"');
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(response.headers.get("Content-Length")).toBeDefined();
  
  const content = await response.text();
  expect(content).toBe("This is a sample text file for testing file operations.");
});

test("return await res.sendFile() pattern works", async () => {
  const app = createServer();
  
  app.get("/return-sendfile", async (req, res) => {
    return await res.sendFile(path.join(testFilesDir, "data.json"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-sendfile");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBeNull(); // sendFile doesn't set attachment
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(response.headers.get("Accept-Ranges")).toBe("bytes");
  
  const content = await response.text();
  expect(content).toBe('{"message": "Hello from JSON file", "type": "test"}');
});

test("return await res.download() with custom filename", async () => {
  const app = createServer();
  
  app.get("/return-download-custom", async (req, res) => {
    return await res.download(path.join(testFilesDir, "sample.txt"), "custom-download.txt");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-download-custom");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="custom-download.txt"');
  expect(response.headers.get("Content-Type")).toBe("text/plain");
});

test("return await res.download() with non-existent file", async () => {
  const app = createServer();
  
  app.get("/return-download-missing", async (req, res) => {
    return await res.download(path.join(testFilesDir, "nonexistent.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-download-missing");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("File not found");
});

test("return await res.sendFile() with non-existent file", async () => {
  const app = createServer();
  
  app.get("/return-sendfile-missing", async (req, res) => {
    return await res.sendFile(path.join(testFilesDir, "nonexistent.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/return-sendfile-missing");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("File not found");
});

test("conditional file return patterns", async () => {
  const app = createServer();
  
  app.get("/conditional-file", async (req, res) => {
    const { type } = req.query || {};
    
    if (type === "download") {
      return await res.download(path.join(testFilesDir, "sample.txt"));
    }
    
    if (type === "send") {
      return await res.sendFile(path.join(testFilesDir, "data.json"));
    }
    
    return res.json({ error: "Invalid type parameter" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test download
  const downloadRequest = createMockRequest("GET", "http://localhost:3000/conditional-file?type=download");
  const downloadResponse = await fetchHandler(downloadRequest);
  expect(downloadResponse.status).toBe(200);
  expect(downloadResponse.headers.get("Content-Disposition")).toContain("attachment");
  
  // Test sendFile
  const sendRequest = createMockRequest("GET", "http://localhost:3000/conditional-file?type=send");
  const sendResponse = await fetchHandler(sendRequest);
  expect(sendResponse.status).toBe(200);
  expect(sendResponse.headers.get("Content-Type")).toBe("application/json");
  expect(sendResponse.headers.get("Content-Disposition")).toBeNull();
  
  // Test fallback
  const fallbackRequest = createMockRequest("GET", "http://localhost:3000/conditional-file");
  const fallbackResponse = await fetchHandler(fallbackRequest);
  expect(fallbackResponse.status).toBe(200);
  const fallbackData = await fallbackResponse.json();
  expect(fallbackData.error).toBe("Invalid type parameter");
});

test("chained file operations with return", async () => {
  const app = createServer();
  
  app.get("/chained-file-download", async (req, res) => {
    return await res.status(200).header("X-Custom", "file-download").download(path.join(testFilesDir, "sample.txt"));
  });
  
  app.get("/chained-file-send", async (req, res) => {
    return await res.status(200).header("X-Custom", "file-send").sendFile(path.join(testFilesDir, "data.json"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test chained download
  const downloadRequest = createMockRequest("GET", "http://localhost:3000/chained-file-download");
  const downloadResponse = await fetchHandler(downloadRequest);
  expect(downloadResponse.status).toBe(200);
  expect(downloadResponse.headers.get("X-Custom")).toBe("file-download");
  expect(downloadResponse.headers.get("Content-Disposition")).toContain("attachment");
  
  // Test chained sendFile
  const sendRequest = createMockRequest("GET", "http://localhost:3000/chained-file-send");
  const sendResponse = await fetchHandler(sendRequest);
  expect(sendResponse.status).toBe(200);
  expect(sendResponse.headers.get("X-Custom")).toBe("file-send");
  expect(sendResponse.headers.get("Content-Type")).toBe("application/json");
});

test("early return with file operations", async () => {
  const app = createServer();
  let afterReturnExecuted = false;
  
  app.get("/early-file-return", async (req, res) => {
    const { early } = req.query || {};
    
    if (early === "true") {
      return await res.download(path.join(testFilesDir, "sample.txt"));
    }
    
    afterReturnExecuted = true;
    return res.json({ message: "No early return" });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test early return
  const earlyRequest = createMockRequest("GET", "http://localhost:3000/early-file-return?early=true");
  const earlyResponse = await fetchHandler(earlyRequest);
  
  expect(earlyResponse.status).toBe(200);
  expect(earlyResponse.headers.get("Content-Disposition")).toContain("attachment");
  expect(afterReturnExecuted).toBe(false);
  
  // Test normal execution
  afterReturnExecuted = false;
  const normalRequest = createMockRequest("GET", "http://localhost:3000/early-file-return?early=false");
  const normalResponse = await fetchHandler(normalRequest);
  
  expect(normalResponse.status).toBe(200);
  expect(normalResponse.headers.get("Content-Type")).toBe("application/json");
  expect(afterReturnExecuted).toBe(true);
});

test("async file operations in complex handlers", async () => {
  const app = createServer();
  
  app.get("/complex-file-handler", async (req, res) => {
    // Simulate some async validation
    await new Promise(resolve => setTimeout(resolve, 5));
    
    const { action, filename } = req.query || {};
    
    if (action === "validate") {
      // Simulate validation logic
      if (filename === "sample.txt") {
        return await res.download(path.join(testFilesDir, "sample.txt"));
      } else {
        return res.status(400).json({ error: "Invalid filename" });
      }
    }
    
    if (action === "serve") {
      return await res.sendFile(path.join(testFilesDir, "data.json"));
    }
    
    return res.json({ 
      message: "Specify action parameter",
      availableActions: ["validate", "serve"]
    });
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test validation success
  const validRequest = createMockRequest("GET", "http://localhost:3000/complex-file-handler?action=validate&filename=sample.txt");
  const validResponse = await fetchHandler(validRequest);
  expect(validResponse.status).toBe(200);
  expect(validResponse.headers.get("Content-Disposition")).toContain("attachment");
  
  // Test validation failure
  const invalidRequest = createMockRequest("GET", "http://localhost:3000/complex-file-handler?action=validate&filename=invalid.txt");
  const invalidResponse = await fetchHandler(invalidRequest);
  expect(invalidResponse.status).toBe(400);
  const invalidData = await invalidResponse.json();
  expect(invalidData.error).toBe("Invalid filename");
  
  // Test serve action
  const serveRequest = createMockRequest("GET", "http://localhost:3000/complex-file-handler?action=serve");
  const serveResponse = await fetchHandler(serveRequest);
  expect(serveResponse.status).toBe(200);
  expect(serveResponse.headers.get("Content-Type")).toBe("application/json");
  
  // Test default case
  const defaultRequest = createMockRequest("GET", "http://localhost:3000/complex-file-handler");
  const defaultResponse = await fetchHandler(defaultRequest);
  expect(defaultResponse.status).toBe(200);
  const defaultData = await defaultResponse.json();
  expect(defaultData.message).toBe("Specify action parameter");
  expect(defaultData.availableActions).toEqual(["validate", "serve"]);
});