import { test, expect } from "bun:test";
import { createWebSocketServer } from "../../src/server/websocket";

test("WebSocket server - creates server instance", () => {
  const server = createWebSocketServer();
  
  expect(server).toBeDefined();
  expect(server.get).toBeDefined();
  expect(server.post).toBeDefined();
  expect(server.websocket).toBeDefined();
  expect(server.use).toBeDefined();
  expect(server.listen).toBeDefined();
});

test("WebSocket server - handles HTTP routes", async () => {
  const server = createWebSocketServer();
  
  server.get("/test", (req, res) => {
    res.json({ message: "HTTP over WebSocket server" });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.message).toBe("HTTP over WebSocket server");
});

test("WebSocket server - configures WebSocket handlers", () => {
  const server = createWebSocketServer();
  
  let openCalled = false;
  let messageCalled = false;
  let closeCalled = false;
  let errorCalled = false;
  
  server.websocket({
    open: (ws) => {
      openCalled = true;
      expect(ws).toBeDefined();
    },
    message: (ws, message) => {
      messageCalled = true;
      expect(ws).toBeDefined();
      expect(message).toBeDefined();
    },
    close: (ws, code, reason) => {
      closeCalled = true;
      expect(ws).toBeDefined();
    },
    error: (ws, error) => {
      errorCalled = true;
      expect(ws).toBeDefined();
      expect(error).toBeDefined();
    }
  });
  
  // WebSocket handlers are configured but not called in this test
  expect(openCalled).toBe(false);
  expect(messageCalled).toBe(false);
  expect(closeCalled).toBe(false);
  expect(errorCalled).toBe(false);
});

test("WebSocket server - handles API routes for WebSocket info", async () => {
  const server = createWebSocketServer();
  
  server.websocket({
    open: (ws) => {
      console.log("WebSocket opened");
    },
    message: (ws, message) => {
      console.log("WebSocket message:", message);
    }
  });
  
  server.get("/ws-info", (req, res) => {
    res.json({
      websocketEnabled: true,
      supportedProtocols: ["ws", "wss"],
      features: ["ping", "pong", "close", "error"]
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/ws-info"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.websocketEnabled).toBe(true);
  expect(data.supportedProtocols).toEqual(["ws", "wss"]);
  expect(data.features).toEqual(["ping", "pong", "close", "error"]);
});

test("WebSocket server - handles middleware with WebSocket context", async () => {
  const server = createWebSocketServer();
  
  server.use((req, res, next) => {
    (req as any).websocketEnabled = true;
    (req as any).protocol = "ws";
    next();
  });
  
  server.get("/test", (req, res) => {
    res.json({ 
      websocketEnabled: (req as any).websocketEnabled,
      protocol: (req as any).protocol
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.websocketEnabled).toBe(true);
  expect(data.protocol).toBe("ws");
});

test("WebSocket server - handles chat room simulation", async () => {
  const server = createWebSocketServer();
  
  const chatRooms = new Map();
  
  server.websocket({
    open: (ws) => {
      // Simulate joining a chat room
      const roomId = "general";
      if (!chatRooms.has(roomId)) {
        chatRooms.set(roomId, new Set());
      }
      chatRooms.get(roomId).add(ws);
    },
    message: (ws, message) => {
      // Simulate broadcasting message to all users in room
      const roomId = "general";
      const users = chatRooms.get(roomId);
      if (users) {
        users.forEach((user) => {
          if (user !== ws) {
            // In real implementation, would send to other users
            console.log("Broadcasting message:", message);
          }
        });
      }
    },
    close: (ws) => {
      // Simulate leaving chat room
      const roomId = "general";
      const users = chatRooms.get(roomId);
      if (users) {
        users.delete(ws);
      }
    }
  });
  
  server.get("/chat-rooms", (req, res) => {
    res.json({
      rooms: Array.from(chatRooms.keys()),
      totalUsers: Array.from(chatRooms.values()).reduce((sum, users) => sum + users.size, 0)
    });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/chat-rooms"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.rooms).toEqual([]);
  expect(data.totalUsers).toBe(0);
});

test("WebSocket server - handles WebSocket upgrade simulation", async () => {
  const server = createWebSocketServer();
  
  server.websocket({
    open: (ws) => {
      // Simulate successful WebSocket upgrade
      console.log("WebSocket connection established");
    }
  });
  
  server.get("/ws-upgrade", (req, res) => {
    // Simulate WebSocket upgrade request handling
    const upgrade = req.headers.get("upgrade");
    const connection = req.headers.get("connection");
    
    if (upgrade === "websocket" && connection === "upgrade") {
      res.status(101).json({ 
        message: "Switching Protocols",
        protocol: "websocket"
      });
    } else {
      res.json({
        message: "WebSocket upgrade available",
        upgradeRequired: true
      });
    }
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/ws-upgrade"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.message).toBe("WebSocket upgrade available");
  expect(data.upgradeRequired).toBe(true);
});