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

test("res.download() with existing file", async () => {
  const app = createServer();
  
  app.get("/download-txt", async (req, res) => {
    await res.download(path.join(testFilesDir, "sample.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-txt");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="sample.txt"');
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(response.headers.get("Content-Length")).toBeDefined();
  expect(response.headers.get("Last-Modified")).toBeDefined();
  
  const content = await response.text();
  expect(content).toBe("This is a sample text file for testing file operations.");
});

test("res.download() with custom filename", async () => {
  const app = createServer();
  
  app.get("/download-custom", async (req, res) => {
    await res.download(path.join(testFilesDir, "sample.txt"), "custom-name.txt");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-custom");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="custom-name.txt"');
  expect(response.headers.get("Content-Type")).toBe("text/plain");
});

test("res.download() with JSON file", async () => {
  const app = createServer();
  
  app.get("/download-json", async (req, res) => {
    await res.download(path.join(testFilesDir, "data.json"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-json");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="data.json"');
  expect(response.headers.get("Content-Type")).toBe("application/json");
  
  const content = await response.text();
  expect(content).toBe('{"message": "Hello from JSON file", "type": "test"}');
});

test("res.download() with image file", async () => {
  const app = createServer();
  
  app.get("/download-image", async (req, res) => {
    await res.download(path.join(testFilesDir, "image.png"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-image");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="image.png"');
  expect(response.headers.get("Content-Type")).toBe("image/png");
});

test("res.download() with non-existent file", async () => {
  const app = createServer();
  
  app.get("/download-missing", async (req, res) => {
    await res.download(path.join(testFilesDir, "nonexistent.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-missing");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("File not found");
});

test("res.download() with invalid path", async () => {
  const app = createServer();
  
  app.get("/download-invalid", async (req, res) => {
    await res.download("/invalid/path/file.txt");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/download-invalid");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("File not found");
});

test("res.sendFile() with existing file", async () => {
  const app = createServer();
  
  app.get("/sendfile-txt", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "sample.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/sendfile-txt");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBeNull(); // sendFile doesn't set attachment
  expect(response.headers.get("Content-Type")).toBe("text/plain");
  expect(response.headers.get("Content-Length")).toBeDefined();
  expect(response.headers.get("Last-Modified")).toBeDefined();
  expect(response.headers.get("Accept-Ranges")).toBe("bytes");
  
  const content = await response.text();
  expect(content).toBe("This is a sample text file for testing file operations.");
});

test("res.sendFile() with JSON file", async () => {
  const app = createServer();
  
  app.get("/sendfile-json", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "data.json"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/sendfile-json");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(response.headers.get("Accept-Ranges")).toBe("bytes");
  
  const content = await response.text();
  expect(content).toBe('{"message": "Hello from JSON file", "type": "test"}');
});

test("res.sendFile() with options", async () => {
  const app = createServer();
  
  app.get("/sendfile-options", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "sample.txt"), { acceptRanges: false });
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/sendfile-options");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(200);
  expect(response.headers.get("Accept-Ranges")).toBeNull(); // Should not be set when acceptRanges: false
});

test("res.sendFile() with non-existent file", async () => {
  const app = createServer();
  
  app.get("/sendfile-missing", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "nonexistent.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/sendfile-missing");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("File not found");
});

test("res.sendFile() with invalid path", async () => {
  const app = createServer();
  
  app.get("/sendfile-invalid", async (req, res) => {
    await res.sendFile("/invalid/path/file.txt");
  });

  const fetchHandler = (app as any).createFetchHandler();
  const request = createMockRequest("GET", "http://localhost:3000/sendfile-invalid");
  const response = await fetchHandler(request);
  
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("File not found");
});

test("File operations with chained methods", async () => {
  const app = createServer();
  
  app.get("/chain-download", async (req, res) => {
    await res.status(200).header("X-Custom", "download").download(path.join(testFilesDir, "sample.txt"));
  });
  
  app.get("/chain-sendfile", async (req, res) => {
    await res.status(200).header("X-Custom", "sendfile").sendFile(path.join(testFilesDir, "data.json"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test download with chained methods
  const downloadRequest = createMockRequest("GET", "http://localhost:3000/chain-download");
  const downloadResponse = await fetchHandler(downloadRequest);
  
  expect(downloadResponse.status).toBe(200);
  expect(downloadResponse.headers.get("X-Custom")).toBe("download");
  expect(downloadResponse.headers.get("Content-Disposition")).toBe('attachment; filename="sample.txt"');
  
  // Test sendFile with chained methods
  const sendFileRequest = createMockRequest("GET", "http://localhost:3000/chain-sendfile");
  const sendFileResponse = await fetchHandler(sendFileRequest);
  
  expect(sendFileResponse.status).toBe(200);
  expect(sendFileResponse.headers.get("X-Custom")).toBe("sendfile");
  expect(sendFileResponse.headers.get("Content-Type")).toBe("application/json");
});

test("File operations error handling", async () => {
  const app = createServer();
  
  app.get("/error-after-send", async (req, res) => {
    res.json({ sent: true });
    // This should throw since response is already sent
    await res.download(path.join(testFilesDir, "sample.txt"));
  });
  
  app.get("/error-sendfile-after-send", async (req, res) => {
    res.json({ sent: true });
    // This should throw since response is already sent
    await res.sendFile(path.join(testFilesDir, "sample.txt"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // These should return 500 due to errors
  const downloadRequest = createMockRequest("GET", "http://localhost:3000/error-after-send");
  const downloadResponse = await fetchHandler(downloadRequest);
  expect(downloadResponse.status).toBe(500);
  
  const sendFileRequest = createMockRequest("GET", "http://localhost:3000/error-sendfile-after-send");
  const sendFileResponse = await fetchHandler(sendFileRequest);
  expect(sendFileResponse.status).toBe(500);
});

test("MIME type detection edge cases", async () => {
  const app = createServer();
  
  // Create temp files with different extensions
  await Bun.write(path.join(testFilesDir, "test.css"), "body { color: red; }");
  await Bun.write(path.join(testFilesDir, "test.js"), "console.log('test');");
  await Bun.write(path.join(testFilesDir, "test.pdf"), "PDF content");
  await Bun.write(path.join(testFilesDir, "noextension"), "content without extension");
  
  app.get("/css", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "test.css"));
  });
  
  app.get("/js", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "test.js"));
  });
  
  app.get("/pdf", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "test.pdf"));
  });
  
  app.get("/noext", async (req, res) => {
    await res.sendFile(path.join(testFilesDir, "noextension"));
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test CSS
  const cssResponse = await fetchHandler(createMockRequest("GET", "http://localhost:3000/css"));
  expect(cssResponse.headers.get("Content-Type")).toBe("text/css");
  
  // Test JS
  const jsResponse = await fetchHandler(createMockRequest("GET", "http://localhost:3000/js"));
  expect(jsResponse.headers.get("Content-Type")).toBe("application/javascript");
  
  // Test PDF
  const pdfResponse = await fetchHandler(createMockRequest("GET", "http://localhost:3000/pdf"));
  expect(pdfResponse.headers.get("Content-Type")).toBe("application/pdf");
  
  // Test no extension (should default to octet-stream)
  const noExtResponse = await fetchHandler(createMockRequest("GET", "http://localhost:3000/noext"));
  expect(noExtResponse.headers.get("Content-Type")).toBe("application/octet-stream");
});

test("Large file handling", async () => {
  const app = createServer();
  
  // Create a larger test file
  const largeContent = "x".repeat(10000);
  const largePath = path.join(testFilesDir, "large.txt");
  await Bun.write(largePath, largeContent);
  
  app.get("/large-download", async (req, res) => {
    await res.download(largePath);
  });
  
  app.get("/large-sendfile", async (req, res) => {
    await res.sendFile(largePath);
  });

  const fetchHandler = (app as any).createFetchHandler();
  
  // Test large file download
  const downloadResponse = await fetchHandler(createMockRequest("GET", "http://localhost:3000/large-download"));
  expect(downloadResponse.status).toBe(200);
  expect(downloadResponse.headers.get("Content-Length")).toBe("10000");
  expect(await downloadResponse.text()).toBe(largeContent);
  
  // Test large file sendFile
  const sendFileResponse = await fetchHandler(createMockRequest("GET", "http://localhost:3000/large-sendfile"));
  expect(sendFileResponse.status).toBe(200);
  expect(sendFileResponse.headers.get("Content-Length")).toBe("10000");
  expect(await sendFileResponse.text()).toBe(largeContent);
});