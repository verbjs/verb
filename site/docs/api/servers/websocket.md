# WebSocket Server

API reference for creating real-time WebSocket servers with connection management, message handling, and broadcasting capabilities.

## Creating WebSocket Server

### Basic WebSocket Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

app.withOptions({
  port: 3000,
  websocket: {
    message: (ws, message) => {
      console.log("Received:", message);
      ws.send(`Echo: ${message}`);
    },
    
    open: (ws) => {
      console.log("Client connected");
      ws.send("Welcome to WebSocket server!");
    },
    
    close: (ws, code, reason) => {
      console.log(`Client disconnected: ${code} - ${reason}`);
    }
  }
});

app.listen(3000);
console.log("WebSocket server running on ws://localhost:3000");
```

### HTTP + WebSocket Server

```typescript
import { createServer } from "verb";

const app = createServer();

app.withOptions({
  port: 3000,
  websocket: {
    message: (ws, message) => {
      ws.send(`Server received: ${message}`);
    },
    open: (ws) => {
      ws.send("WebSocket connection established");
    }
  }
});

// HTTP routes
app.get("/", (req, res) => {
  res.html(`
    <!DOCTYPE html>
    <html>
      <head><title>WebSocket Demo</title></head>
      <body>
        <h1>WebSocket Demo</h1>
        <div id="messages"></div>
        <input type="text" id="messageInput" placeholder="Type a message...">
        <button onclick="sendMessage()">Send</button>
        
        <script>
          const ws = new WebSocket('ws://localhost:3000');
          const messages = document.getElementById('messages');
          
          ws.onmessage = (event) => {
            messages.innerHTML += '<div>' + event.data + '</div>';
          };
          
          function sendMessage() {
            const input = document.getElementById('messageInput');
            ws.send(input.value);
            input.value = '';
          }
        </script>
      </body>
    </html>
  `);
});

app.listen(3000);
```

## WebSocket Configuration

### Advanced WebSocket Options

```typescript
app.withOptions({
  websocket: {
    // Connection handling
    open: (ws) => {
      console.log("New WebSocket connection");
    },
    
    message: (ws, message) => {
      try {
        const data = JSON.parse(message);
        handleMessage(ws, data);
      } catch (error) {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
      }
    },
    
    close: (ws, code, reason) => {
      console.log(`Connection closed: ${code} - ${reason}`);
    },
    
    error: (ws, error) => {
      console.error("WebSocket error:", error);
    },
    
    // Ping/Pong for connection health
    ping: (ws, data) => {
      console.log("Received ping");
    },
    
    pong: (ws, data) => {
      console.log("Received pong");
    },
    
    // Flow control
    drain: (ws) => {
      console.log("Socket buffer drained");
    },
    
    // Performance options
    maxCompressedSize: 64 * 1024 * 1024, // 64MB
    maxBackpressure: 64 * 1024 * 1024,   // 64MB
    closeOnBackpressureLimit: false,
    
    // Compression
    compression: "shared", // "shared", "dedicated", or "disabled"
    maxPayloadLength: 16 * 1024 * 1024, // 16MB
    
    // Timeouts
    idleTimeout: 120, // seconds
    maxLifetime: 0    // unlimited
  }
});
```

### Per-Route WebSocket Handling

```typescript
// WebSocket upgrade on specific routes
app.get("/chat", (req, res) => {
  if (req.headers.upgrade === "websocket") {
    const ws = res.upgrade();
    
    ws.on("message", (message) => {
      broadcast(message, ws); // Broadcast to all clients
    });
    
    ws.on("close", () => {
      removeFromChat(ws);
    });
  } else {
    res.sendFile("./public/chat.html");
  }
});

app.get("/notifications", (req, res) => {
  if (req.headers.upgrade === "websocket") {
    const ws = res.upgrade();
    
    // Subscribe to user-specific notifications
    const userId = req.query.userId;
    subscribeToNotifications(userId, ws);
  } else {
    res.status(400).json({ error: "WebSocket upgrade required" });
  }
});
```

## Connection Management

### Client Registry

```typescript
class WebSocketManager {
  private clients = new Map();
  private rooms = new Map();
  
  addClient(ws, clientId, metadata = {}) {
    this.clients.set(clientId, {
      socket: ws,
      metadata,
      connectedAt: new Date(),
      lastActivity: new Date()
    });
    
    ws.on("close", () => {
      this.removeClient(clientId);
    });
  }
  
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      // Remove from all rooms
      for (const [roomId, room] of this.rooms) {
        room.delete(clientId);
      }
      this.clients.delete(clientId);
    }
  }
  
  getClient(clientId) {
    return this.clients.get(clientId);
  }
  
  getAllClients() {
    return Array.from(this.clients.entries());
  }
  
  joinRoom(clientId, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(clientId);
  }
  
  leaveRoom(clientId, roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
  
  broadcastToRoom(roomId, message, excludeClient = null) {
    const room = this.rooms.get(roomId);
    if (room) {
      for (const clientId of room) {
        if (clientId !== excludeClient) {
          const client = this.clients.get(clientId);
          if (client) {
            client.socket.send(message);
          }
        }
      }
    }
  }
  
  broadcast(message, excludeClient = null) {
    for (const [clientId, client] of this.clients) {
      if (clientId !== excludeClient) {
        client.socket.send(message);
      }
    }
  }
}

const wsManager = new WebSocketManager();
```

### Authentication & Authorization

```typescript
app.withOptions({
  websocket: {
    open: async (ws) => {
      // Extract token from query or headers
      const token = ws.data?.token || extractTokenFromHeaders(ws);
      
      try {
        const user = await verifyToken(token);
        ws.user = user;
        ws.authenticated = true;
        
        wsManager.addClient(ws, user.id, { user });
        ws.send(JSON.stringify({ 
          type: "auth", 
          status: "success",
          user: { id: user.id, name: user.name }
        }));
      } catch (error) {
        ws.send(JSON.stringify({ 
          type: "auth", 
          status: "error",
          message: "Authentication failed"
        }));
        ws.close(1008, "Authentication failed");
      }
    },
    
    message: (ws, message) => {
      if (!ws.authenticated) {
        ws.send(JSON.stringify({ 
          error: "Authentication required" 
        }));
        return;
      }
      
      handleAuthenticatedMessage(ws, message);
    }
  }
});

const extractTokenFromHeaders = (ws) => {
  // Extract from Sec-WebSocket-Protocol or custom header
  return ws.protocol || ws.headers?.authorization?.replace("Bearer ", "");
};
```

## Message Handling

### Message Types & Routing

```typescript
const messageHandlers = {
  chat: (ws, data) => {
    const message = {
      type: "chat",
      id: generateId(),
      user: ws.user.name,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    
    wsManager.broadcastToRoom(data.roomId, JSON.stringify(message), ws.user.id);
  },
  
  join_room: (ws, data) => {
    wsManager.joinRoom(ws.user.id, data.roomId);
    ws.send(JSON.stringify({
      type: "joined_room",
      roomId: data.roomId
    }));
    
    // Notify others in room
    wsManager.broadcastToRoom(data.roomId, JSON.stringify({
      type: "user_joined",
      user: ws.user.name,
      roomId: data.roomId
    }), ws.user.id);
  },
  
  leave_room: (ws, data) => {
    wsManager.leaveRoom(ws.user.id, data.roomId);
    
    wsManager.broadcastToRoom(data.roomId, JSON.stringify({
      type: "user_left",
      user: ws.user.name,
      roomId: data.roomId
    }));
  },
  
  private_message: (ws, data) => {
    const targetClient = wsManager.getClient(data.targetUserId);
    if (targetClient) {
      targetClient.socket.send(JSON.stringify({
        type: "private_message",
        from: ws.user.name,
        message: data.message,
        timestamp: new Date().toISOString()
      }));
    } else {
      ws.send(JSON.stringify({
        type: "error",
        message: "User not found or offline"
      }));
    }
  }
};

const handleAuthenticatedMessage = (ws, message) => {
  try {
    const data = JSON.parse(message);
    const handler = messageHandlers[data.type];
    
    if (handler) {
      handler(ws, data);
    } else {
      ws.send(JSON.stringify({
        type: "error",
        message: `Unknown message type: ${data.type}`
      }));
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: "error",
      message: "Invalid message format"
    }));
  }
};
```

### Binary Message Handling

```typescript
app.withOptions({
  websocket: {
    message: (ws, message) => {
      if (message instanceof Buffer) {
        // Handle binary data
        handleBinaryMessage(ws, message);
      } else {
        // Handle text data
        handleTextMessage(ws, message);
      }
    }
  }
});

const handleBinaryMessage = (ws, buffer) => {
  // Read message type from first byte
  const messageType = buffer.readUInt8(0);
  
  switch (messageType) {
    case 1: // File upload
      handleFileUpload(ws, buffer.slice(1));
      break;
    case 2: // Audio data
      handleAudioData(ws, buffer.slice(1));
      break;
    case 3: // Video data
      handleVideoData(ws, buffer.slice(1));
      break;
    default:
      ws.send("Unknown binary message type");
  }
};

const handleFileUpload = async (ws, data) => {
  const filename = `upload_${Date.now()}_${ws.user.id}`;
  await Bun.write(`./uploads/${filename}`, data);
  
  ws.send(JSON.stringify({
    type: "file_uploaded",
    filename,
    size: data.length
  }));
};
```

## Real-time Features

### Chat Application

```typescript
class ChatRoom {
  constructor(id) {
    this.id = id;
    this.clients = new Set();
    this.messages = [];
    this.maxMessages = 100;
  }
  
  addClient(ws) {
    this.clients.add(ws);
    
    // Send recent messages to new client
    ws.send(JSON.stringify({
      type: "message_history",
      messages: this.messages.slice(-20) // Last 20 messages
    }));
  }
  
  removeClient(ws) {
    this.clients.delete(ws);
  }
  
  broadcast(message, excludeClient = null) {
    // Store message
    this.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    });
    
    // Keep only recent messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    
    // Broadcast to all clients
    const messageStr = JSON.stringify(message);
    for (const client of this.clients) {
      if (client !== excludeClient && client.readyState === 1) {
        client.send(messageStr);
      }
    }
  }
}

const chatRooms = new Map();

const getChatRoom = (roomId) => {
  if (!chatRooms.has(roomId)) {
    chatRooms.set(roomId, new ChatRoom(roomId));
  }
  return chatRooms.get(roomId);
};
```

### Live Updates & Notifications

```typescript
class NotificationService {
  constructor() {
    this.subscribers = new Map(); // userId -> Set of WebSocket connections
  }
  
  subscribe(userId, ws) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId).add(ws);
    
    ws.on("close", () => {
      this.unsubscribe(userId, ws);
    });
  }
  
  unsubscribe(userId, ws) {
    const userSockets = this.subscribers.get(userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        this.subscribers.delete(userId);
      }
    }
  }
  
  notify(userId, notification) {
    const userSockets = this.subscribers.get(userId);
    if (userSockets) {
      const message = JSON.stringify({
        type: "notification",
        ...notification,
        timestamp: new Date().toISOString()
      });
      
      for (const ws of userSockets) {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      }
    }
  }
  
  broadcast(notification) {
    const message = JSON.stringify({
      type: "broadcast",
      ...notification,
      timestamp: new Date().toISOString()
    });
    
    for (const userSockets of this.subscribers.values()) {
      for (const ws of userSockets) {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      }
    }
  }
}

const notifications = new NotificationService();

// HTTP endpoint to send notifications
app.post("/api/notify/:userId", (req, res) => {
  const userId = req.params.userId;
  const notification = req.body;
  
  notifications.notify(userId, notification);
  res.json({ success: true });
});
```

### Real-time Data Streaming

```typescript
// Stock price updates
const stockPrices = new Map();
const stockSubscribers = new Map();

const updateStockPrice = (symbol, price) => {
  stockPrices.set(symbol, price);
  
  const subscribers = stockSubscribers.get(symbol);
  if (subscribers) {
    const update = JSON.stringify({
      type: "stock_update",
      symbol,
      price,
      timestamp: Date.now()
    });
    
    for (const ws of subscribers) {
      if (ws.readyState === 1) {
        ws.send(update);
      }
    }
  }
};

// WebSocket handler for stock subscriptions
const handleStockMessage = (ws, data) => {
  switch (data.action) {
    case "subscribe":
      if (!stockSubscribers.has(data.symbol)) {
        stockSubscribers.set(data.symbol, new Set());
      }
      stockSubscribers.get(data.symbol).add(ws);
      
      // Send current price
      const currentPrice = stockPrices.get(data.symbol);
      if (currentPrice) {
        ws.send(JSON.stringify({
          type: "stock_update",
          symbol: data.symbol,
          price: currentPrice
        }));
      }
      break;
      
    case "unsubscribe":
      const subscribers = stockSubscribers.get(data.symbol);
      if (subscribers) {
        subscribers.delete(ws);
      }
      break;
  }
};

// Simulate price updates
setInterval(() => {
  const symbols = ["AAPL", "GOOGL", "MSFT", "TSLA"];
  for (const symbol of symbols) {
    const currentPrice = stockPrices.get(symbol) || 100;
    const newPrice = currentPrice + (Math.random() - 0.5) * 10;
    updateStockPrice(symbol, Math.max(0, newPrice));
  }
}, 1000);
```

## Performance & Scaling

### Connection Pooling

```typescript
class WebSocketPool {
  constructor(maxConnections = 1000) {
    this.maxConnections = maxConnections;
    this.connections = new Set();
    this.stats = {
      total: 0,
      active: 0,
      rejected: 0
    };
  }
  
  canAcceptConnection() {
    return this.connections.size < this.maxConnections;
  }
  
  addConnection(ws) {
    if (!this.canAcceptConnection()) {
      this.stats.rejected++;
      return false;
    }
    
    this.connections.add(ws);
    this.stats.total++;
    this.stats.active = this.connections.size;
    
    ws.on("close", () => {
      this.removeConnection(ws);
    });
    
    return true;
  }
  
  removeConnection(ws) {
    this.connections.delete(ws);
    this.stats.active = this.connections.size;
  }
  
  getStats() {
    return { ...this.stats };
  }
}

const wsPool = new WebSocketPool(1000);

app.withOptions({
  websocket: {
    open: (ws) => {
      if (!wsPool.canAcceptConnection()) {
        ws.close(1013, "Server overloaded");
        return;
      }
      
      wsPool.addConnection(ws);
      handleWebSocketConnection(ws);
    }
  }
});
```

### Message Queuing

```typescript
class MessageQueue {
  constructor() {
    this.queues = new Map(); // clientId -> message array
  }
  
  enqueue(clientId, message) {
    if (!this.queues.has(clientId)) {
      this.queues.set(clientId, []);
    }
    
    const queue = this.queues.get(clientId);
    queue.push({
      message,
      timestamp: Date.now()
    });
    
    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }
  
  dequeue(clientId) {
    const queue = this.queues.get(clientId);
    return queue ? queue.shift() : null;
  }
  
  getQueuedMessages(clientId) {
    return this.queues.get(clientId) || [];
  }
  
  clearQueue(clientId) {
    this.queues.delete(clientId);
  }
}

const messageQueue = new MessageQueue();

// Send queued messages when client reconnects
const sendQueuedMessages = (ws, clientId) => {
  const messages = messageQueue.getQueuedMessages(clientId);
  for (const { message } of messages) {
    ws.send(message);
  }
  messageQueue.clearQueue(clientId);
};
```

## Error Handling & Resilience

### Connection Health Monitoring

```typescript
const healthCheck = (ws) => {
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping("health-check");
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // Ping every 30 seconds
  
  let pongReceived = true;
  
  ws.on("pong", () => {
    pongReceived = true;
  });
  
  ws.on("ping", () => {
    pongReceived = false;
    setTimeout(() => {
      if (!pongReceived) {
        console.log("Client not responding to ping");
        ws.close(1002, "Ping timeout");
      }
    }, 5000);
  });
  
  ws.on("close", () => {
    clearInterval(pingInterval);
  });
};
```

### Graceful Shutdown

```typescript
const gracefulShutdown = () => {
  console.log("Shutting down WebSocket server...");
  
  // Notify all clients
  wsManager.broadcast(JSON.stringify({
    type: "server_shutdown",
    message: "Server is shutting down",
    timestamp: new Date().toISOString()
  }));
  
  // Close all connections
  setTimeout(() => {
    for (const [clientId, client] of wsManager.getAllClients()) {
      client.socket.close(1001, "Server shutdown");
    }
    process.exit(0);
  }, 5000); // Give clients 5 seconds to handle shutdown
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
```

## Testing WebSocket Server

```typescript
import { test, expect } from "bun:test";
import WebSocket from "ws";

test("WebSocket connection and messaging", (done) => {
  const ws = new WebSocket("ws://localhost:3000");
  
  ws.on("open", () => {
    ws.send("Hello Server!");
  });
  
  ws.on("message", (data) => {
    const message = data.toString();
    expect(message).toContain("Echo: Hello Server!");
    ws.close();
    done();
  });
});

test("Chat room functionality", (done) => {
  const ws1 = new WebSocket("ws://localhost:3000");
  const ws2 = new WebSocket("ws://localhost:3000");
  
  let messagesReceived = 0;
  
  ws1.on("open", () => {
    ws1.send(JSON.stringify({
      type: "join_room",
      roomId: "test-room"
    }));
  });
  
  ws2.on("open", () => {
    ws2.send(JSON.stringify({
      type: "join_room", 
      roomId: "test-room"
    }));
    
    setTimeout(() => {
      ws1.send(JSON.stringify({
        type: "chat",
        roomId: "test-room",
        message: "Hello from ws1!"
      }));
    }, 100);
  });
  
  ws2.on("message", (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === "chat") {
      expect(message.message).toBe("Hello from ws1!");
      messagesReceived++;
      if (messagesReceived === 1) {
        ws1.close();
        ws2.close();
        done();
      }
    }
  });
});
```

## Best Practices

1. **Authentication**: Authenticate WebSocket connections
2. **Rate Limiting**: Implement message rate limiting
3. **Error Handling**: Handle connection errors gracefully
4. **Health Checks**: Monitor connection health with ping/pong
5. **Message Validation**: Validate all incoming messages
6. **Resource Management**: Limit concurrent connections
7. **Logging**: Log WebSocket events for debugging

## See Also

- [HTTP Server](/api/servers/http) - HTTP server with WebSocket upgrades
- [Real-time Guide](/guide/realtime) - Building real-time applications
- [Performance Guide](/guide/performance) - WebSocket optimization
- [Security Guide](/guide/security) - WebSocket security