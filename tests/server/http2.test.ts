import { test, expect } from "bun:test";
import { createHttp2Server } from "../../src/server/http2";

test("HTTP/2 server - creates server instance", () => {
  const server = createHttp2Server();
  
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

test("HTTP/2 server - handles GET route", async () => {
  const server = createHttp2Server();
  
  server.get("/test", (req, res) => {
    res.json({ message: "Hello HTTP/2", protocol: "h2" });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.message).toBe("Hello HTTP/2");
  expect(data.protocol).toBe("h2");
});

test("HTTP/2 server - handles POST route", async () => {
  const server = createHttp2Server();
  
  server.post("/test", (req, res) => {
    res.json({ method: "POST", protocol: "h2" });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test", {
    method: "POST"
  }));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.method).toBe("POST");
  expect(data.protocol).toBe("h2");
});

test("HTTP/2 server - handles middleware", async () => {
  const server = createHttp2Server();
  
  server.use((req, res, next) => {
    (req as any).middleware = true;
    (req as any).protocol = "h2";
    next();
  });
  
  server.get("/test", (req, res) => {
    res.json({ 
      middleware: (req as any).middleware,
      protocol: (req as any).protocol 
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.middleware).toBe(true);
  expect(data.protocol).toBe("h2");
});

test("HTTP/2 server - handles 404 for unknown routes", async () => {
  const server = createHttp2Server();
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/unknown"));
  
  expect(response.status).toBe(404);
});

test("HTTP/2 server - handles route parameters", async () => {
  const server = createHttp2Server();
  
  server.get("/api/:version/users/:id", (req, res) => {
    res.json({ 
      version: req.params.version,
      userId: req.params.id,
      protocol: "h2"
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/api/v1/users/123"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.version).toBe("v1");
  expect(data.userId).toBe("123");
  expect(data.protocol).toBe("h2");
});

test("HTTP/2 server - supports server push simulation", async () => {
  const server = createHttp2Server();
  
  server.get("/page", (req, res) => {
    // Simulate server push by including resources
    res.json({
      page: "main",
      pushedResources: [
        "/style.css",
        "/script.js",
        "/image.png"
      ],
      protocol: "h2"
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/page"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.page).toBe("main");
  expect(data.pushedResources).toEqual(["/style.css", "/script.js", "/image.png"]);
  expect(data.protocol).toBe("h2");
});

test("HTTP/2 server - handles concurrent requests", async () => {
  const server = createHttp2Server();
  
  server.get("/concurrent/:id", (req, res) => {
    res.json({ 
      id: req.params.id,
      timestamp: Date.now(),
      protocol: "h2"
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  
  // Simulate concurrent requests
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(fetchHandler(new Request(`http://localhost:3000/concurrent/${i}`)));
  }
  
  const responses = await Promise.all(promises);
  
  expect(responses.length).toBe(5);
  for (let i = 0; i < 5; i++) {
    expect(responses[i].status).toBe(200);
    const data = await responses[i].json();
    expect(data.id).toBe(i.toString());
    expect(data.protocol).toBe("h2");
  }
});

test("HTTP/2 server - handles stream priority simulation", async () => {
  const server = createHttp2Server();
  
  server.get("/priority/:level", (req, res) => {
    const level = req.params.level;
    res.json({
      priority: level,
      weight: level === "high" ? 256 : level === "medium" ? 128 : 64,
      protocol: "h2"
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  
  const highPriorityResponse = await fetchHandler(new Request("http://localhost:3000/priority/high"));
  expect(highPriorityResponse.status).toBe(200);
  const highPriorityData = await highPriorityResponse.json();
  expect(highPriorityData.priority).toBe("high");
  expect(highPriorityData.weight).toBe(256);
  expect(highPriorityData.protocol).toBe("h2");
});