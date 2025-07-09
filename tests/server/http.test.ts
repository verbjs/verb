import { test, expect } from "bun:test";
import { createHttpServer } from "../../src/server/http";

test("HTTP server - creates server instance", () => {
  const server = createHttpServer();
  
  expect(server).toBeDefined();
  expect(server.get).toBeDefined();
  expect(server.post).toBeDefined();
  expect(server.put).toBeDefined();
  expect(server.delete).toBeDefined();
  expect(server.patch).toBeDefined();
  expect(server.head).toBeDefined();
  expect(server.options).toBeDefined();
  expect(server.use).toBeDefined();
  expect(server.route).toBeDefined();
  expect(server.listen).toBeDefined();
});

test("HTTP server - handles GET route", async () => {
  const server = createHttpServer();
  
  server.get("/test", (req, res) => {
    res.json({ message: "Hello World" });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.message).toBe("Hello World");
});

test("HTTP server - handles POST route", async () => {
  const server = createHttpServer();
  
  server.post("/test", (req, res) => {
    res.json({ method: "POST" });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test", {
    method: "POST"
  }));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.method).toBe("POST");
});

test("HTTP server - handles middleware", async () => {
  const server = createHttpServer();
  
  server.use((req, res, next) => {
    (req as any).middleware = true;
    next();
  });
  
  server.get("/test", (req, res) => {
    res.json({ middleware: (req as any).middleware });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.middleware).toBe(true);
});

test("HTTP server - handles 404 for unknown routes", async () => {
  const server = createHttpServer();
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/unknown"));
  
  expect(response.status).toBe(404);
});

test("HTTP server - handles route parameters", async () => {
  const server = createHttpServer();
  
  server.get("/users/:id", (req, res) => {
    res.json({ userId: req.params.id });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/users/123"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.userId).toBe("123");
});

test("HTTP server - handles query parameters", async () => {
  const server = createHttpServer();
  
  server.get("/search", (req, res) => {
    res.json({ query: req.query.q });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/search?q=test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.query).toBe("test");
});

test("HTTP server - handles path-specific middleware", async () => {
  const server = createHttpServer();
  
  server.use("/api", (req, res, next) => {
    (req as any).apiMiddleware = true;
    next();
  });
  
  server.get("/api/users", (req, res) => {
    res.json({ apiMiddleware: (req as any).apiMiddleware });
  });
  
  server.get("/users", (req, res) => {
    res.json({ apiMiddleware: (req as any).apiMiddleware });
  });
  
  const fetchHandler = server.createFetchHandler();
  
  // API route should have middleware
  const apiResponse = await fetchHandler(new Request("http://localhost:3000/api/users"));
  expect(apiResponse.status).toBe(200);
  const apiData = await apiResponse.json();
  expect(apiData.apiMiddleware).toBe(true);
  
  // Non-API route should not have middleware
  const nonApiResponse = await fetchHandler(new Request("http://localhost:3000/users"));
  expect(nonApiResponse.status).toBe(200);
  const nonApiData = await nonApiResponse.json();
  expect(nonApiData.apiMiddleware).toBe(undefined);
});

test("HTTP server - handles multiple HTTP methods", async () => {
  const server = createHttpServer();
  
  server.get("/test", (req, res) => {
    res.json({ method: "GET" });
  });
  
  server.post("/test", (req, res) => {
    res.json({ method: "POST" });
  });
  
  server.put("/test", (req, res) => {
    res.json({ method: "PUT" });
  });
  
  server.delete("/test", (req, res) => {
    res.json({ method: "DELETE" });
  });
  
  const fetchHandler = server.createFetchHandler();
  
  const getResponse = await fetchHandler(new Request("http://localhost:3000/test"));
  expect(getResponse.status).toBe(200);
  const getData = await getResponse.json();
  expect(getData.method).toBe("GET");
  
  const postResponse = await fetchHandler(new Request("http://localhost:3000/test", { method: "POST" }));
  expect(postResponse.status).toBe(200);
  const postData = await postResponse.json();
  expect(postData.method).toBe("POST");
  
  const putResponse = await fetchHandler(new Request("http://localhost:3000/test", { method: "PUT" }));
  expect(putResponse.status).toBe(200);
  const putData = await putResponse.json();
  expect(putData.method).toBe("PUT");
  
  const deleteResponse = await fetchHandler(new Request("http://localhost:3000/test", { method: "DELETE" }));
  expect(deleteResponse.status).toBe(200);
  const deleteData = await deleteResponse.json();
  expect(deleteData.method).toBe("DELETE");
});