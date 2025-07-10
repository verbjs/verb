# WebSocket

This guide covers creating WebSocket servers with Verb for real-time, bidirectional communication.

## Overview

WebSocket provides full-duplex communication channels over a single TCP connection, making it ideal for:

- Real-time chat applications
- Live data feeds
- Gaming applications
- Collaborative editing
- Live notifications

## Basic WebSocket Server

### Creating a WebSocket Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

// HTTP routes still work
app.get("/", (req, res) => {
  res.html(`
    <html>
      <head><title>WebSocket Demo</title></head>
      <body>
        <h1>WebSocket Server</h1>
        <script>
          const ws = new WebSocket('ws://localhost:3000');
          ws.onopen = () => console.log('Connected');
          ws.onmessage = (e) => console.log('Message:', e.data);
        </script>
      </body>
    </html>
  `);
});

// WebSocket configuration
app.websocket({
  open: (ws) => {
    console.log("WebSocket connection opened");
    ws.send("Welcome to WebSocket server!");
  },
  
  message: (ws, message) => {
    console.log("Received:", message);
    ws.send(`Echo: ${message}`);
  },
  
  close: (ws, code, reason) => {
    console.log("WebSocket closed:", code, reason);
  }
});

app.listen(3000);
```

### WebSocket Secure (WSS)

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKETS);

app.websocket({
  open: (ws) => {
    console.log("Secure WebSocket connection opened");
    ws.send("Secure WebSocket connected!");
  },
  
  message: (ws, message) => {
    console.log("Secure message:", message);
    ws.send(`Secure echo: ${message}`);
  },
  
  close: (ws, code, reason) => {
    console.log("Secure WebSocket closed:", code, reason);
  }
});

app.listen(443);
```

## WebSocket Configuration

### Advanced Configuration

```typescript
const app = createServer(ServerProtocol.WEBSOCKET);

app.websocket({
  // Connection opened
  open: (ws) => {
    console.log("New WebSocket connection");
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: "welcome",
      message: "Connected to WebSocket server"
    }));
  },
  
  // Message received
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received:", data);
      
      // Handle different message types
      switch (data.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
        case "chat":
          broadcastMessage(data.message);
          break;
        default:
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Unknown message type" 
          }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ 
        type: "error", 
        message: "Invalid JSON" 
      }));
    }
  },
  
  // Connection closed
  close: (ws, code, reason) => {
    console.log(`WebSocket closed: ${code} - ${reason}`);
  },
  
  // Error handling
  error: (ws, error) => {
    console.error("WebSocket error:", error);
  }
});
```

### Configuration Options

```typescript
const app = createServer(ServerProtocol.WEBSOCKET);

app.websocket({
  // Basic handlers
  open: (ws) => { /* ... */ },
  message: (ws, message) => { /* ... */ },
  close: (ws, code, reason) => { /* ... */ },
  error: (ws, error) => { /* ... */ },
  
  // Configuration options (conceptual - depends on Bun's WebSocket implementation)
  maxPayloadLength: 16 * 1024 * 1024, // 16MB
  idleTimeout: 120, // 2 minutes
  compression: true,
  backpressureLimit: 64 * 1024, // 64KB
  
  // Subprotocol support
  protocols: ["chat", "notification"],
  
  // Custom headers
  headers: {
    "X-WebSocket-Server": "Verb"
  }
});
```

## Real-time Chat Example

### Chat Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

// Store active connections
const connections = new Set();
const rooms = new Map();

// Serve chat interface
app.get("/", (req, res) => {
  res.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WebSocket Chat</title>
      <style>
        #messages { height: 300px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
        #messageInput { width: 80%; }
        #sendBtn { width: 15%; }
      </style>
    </head>
    <body>
      <h1>WebSocket Chat</h1>
      <div id="messages"></div>
      <input type="text" id="messageInput" placeholder="Type a message..." />
      <button id="sendBtn">Send</button>
      
      <script>
        const ws = new WebSocket('ws://localhost:3000');
        const messages = document.getElementById('messages');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        ws.onopen = () => {
          addMessage('Connected to chat server');
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'message') {
            addMessage(\`\${data.username}: \${data.message}\`);
          }
        };
        
        const sendMessage = () => {
          const message = messageInput.value.trim();
          if (message) {
            ws.send(JSON.stringify({
              type: 'message',
              username: 'User',
              message: message
            }));
            messageInput.value = '';
          }
        };
        
        const addMessage = (message) => {
          messages.innerHTML += \`<div>\${message}</div>\`;
          messages.scrollTop = messages.scrollHeight;
        };
        
        sendBtn.onclick = sendMessage;
        messageInput.onkeypress = (e) => {
          if (e.key === 'Enter') sendMessage();
        };
      </script>
    </body>
    </html>
  `);
});

// WebSocket handlers
app.websocket({
  open: (ws) => {
    console.log("User connected");
    connections.add(ws);
    
    // Send user count
    broadcast({
      type: "userCount",
      count: connections.size
    });
  },
  
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === "message") {
        // Broadcast message to all connected clients
        broadcast({
          type: "message",
          username: data.username || "Anonymous",
          message: data.message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
    }
  },
  
  close: (ws) => {
    console.log("User disconnected");
    connections.delete(ws);
    
    // Send updated user count
    broadcast({
      type: "userCount",
      count: connections.size
    });
  }
});

// Helper function to broadcast to all connections
function broadcast(data) {
  const message = JSON.stringify(data);
  for (const ws of connections) {
    try {
      ws.send(message);
    } catch (error) {
      // Remove broken connections
      connections.delete(ws);
    }
  }
}

app.listen(3000);
console.log("Chat server running on http://localhost:3000");
```

## Room-based Chat

### Multi-room Chat Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

// Store connections and rooms
const connections = new Map(); // ws -> { userId, username, room }
const rooms = new Map(); // roomId -> Set of websockets

app.websocket({
  open: (ws) => {
    console.log("New connection");
  },
  
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case "join":
          handleJoin(ws, data);
          break;
        case "leave":
          handleLeave(ws, data);
          break;
        case "message":
          handleMessage(ws, data);
          break;
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
    }
  },
  
  close: (ws) => {
    const connection = connections.get(ws);
    if (connection) {
      handleLeave(ws, { room: connection.room });
      connections.delete(ws);
    }
  }
});

function handleJoin(ws, data) {
  const { username, room } = data;
  
  // Leave previous room if any
  const currentConnection = connections.get(ws);
  if (currentConnection) {
    handleLeave(ws, { room: currentConnection.room });
  }
  
  // Join new room
  connections.set(ws, { username, room });
  
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  rooms.get(room).add(ws);
  
  // Notify room
  broadcastToRoom(room, {
    type: "userJoined",
    username,
    message: `${username} joined the room`
  });
  
  // Send room info to user
  ws.send(JSON.stringify({
    type: "joined",
    room,
    userCount: rooms.get(room).size
  }));
}

function handleLeave(ws, data) {
  const { room } = data;
  const connection = connections.get(ws);
  
  if (connection && rooms.has(room)) {
    rooms.get(room).delete(ws);
    
    // Clean up empty rooms
    if (rooms.get(room).size === 0) {
      rooms.delete(room);
    } else {
      broadcastToRoom(room, {
        type: "userLeft",
        username: connection.username,
        message: `${connection.username} left the room`
      });
    }
  }
}

function handleMessage(ws, data) {
  const connection = connections.get(ws);
  if (!connection) {
    return ws.send(JSON.stringify({
      type: "error",
      message: "Not in a room"
    }));
  }
  
  broadcastToRoom(connection.room, {
    type: "message",
    username: connection.username,
    message: data.message,
    timestamp: new Date().toISOString()
  });
}

function broadcastToRoom(room, data) {
  const message = JSON.stringify(data);
  const roomConnections = rooms.get(room);
  
  if (roomConnections) {
    for (const ws of roomConnections) {
      try {
        ws.send(message);
      } catch (error) {
        // Remove broken connections
        roomConnections.delete(ws);
        connections.delete(ws);
      }
    }
  }
}

app.listen(3000);
```

## Live Data Feed

### Real-time Data Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

// Store subscribers
const subscribers = new Map(); // ws -> { topics: Set }

app.websocket({
  open: (ws) => {
    subscribers.set(ws, { topics: new Set() });
    
    ws.send(JSON.stringify({
      type: "connected",
      message: "Ready to receive data feeds"
    }));
  },
  
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case "subscribe":
          handleSubscribe(ws, data.topic);
          break;
        case "unsubscribe":
          handleUnsubscribe(ws, data.topic);
          break;
        case "getTopics":
          sendAvailableTopics(ws);
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
    }
  },
  
  close: (ws) => {
    subscribers.delete(ws);
  }
});

function handleSubscribe(ws, topic) {
  const subscriber = subscribers.get(ws);
  if (subscriber) {
    subscriber.topics.add(topic);
    
    ws.send(JSON.stringify({
      type: "subscribed",
      topic,
      message: `Subscribed to ${topic}`
    }));
  }
}

function handleUnsubscribe(ws, topic) {
  const subscriber = subscribers.get(ws);
  if (subscriber) {
    subscriber.topics.delete(topic);
    
    ws.send(JSON.stringify({
      type: "unsubscribed",
      topic,
      message: `Unsubscribed from ${topic}`
    }));
  }
}

function sendAvailableTopics(ws) {
  ws.send(JSON.stringify({
    type: "topics",
    topics: ["stocks", "crypto", "news", "weather"]
  }));
}

// Simulate data feeds
function startDataFeeds() {
  setInterval(() => {
    // Stock data
    publishToTopic("stocks", {
      symbol: "AAPL",
      price: (Math.random() * 200 + 100).toFixed(2),
      change: (Math.random() * 10 - 5).toFixed(2)
    });
    
    // Crypto data
    publishToTopic("crypto", {
      symbol: "BTC",
      price: (Math.random() * 50000 + 30000).toFixed(2),
      change: (Math.random() * 2000 - 1000).toFixed(2)
    });
  }, 1000);
  
  setInterval(() => {
    // Weather data
    publishToTopic("weather", {
      location: "New York",
      temperature: (Math.random() * 30 + 50).toFixed(1),
      humidity: (Math.random() * 100).toFixed(1)
    });
  }, 5000);
}

function publishToTopic(topic, data) {
  const message = JSON.stringify({
    type: "data",
    topic,
    data,
    timestamp: new Date().toISOString()
  });
  
  for (const [ws, subscriber] of subscribers) {
    if (subscriber.topics.has(topic)) {
      try {
        ws.send(message);
      } catch (error) {
        subscribers.delete(ws);
      }
    }
  }
}

startDataFeeds();
app.listen(3000);
```

## Authentication and Authorization

### Authenticated WebSocket

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

// Store authenticated connections
const authenticatedConnections = new Map();

app.websocket({
  open: (ws) => {
    // Connection opened but not authenticated
    ws.send(JSON.stringify({
      type: "auth_required",
      message: "Please authenticate"
    }));
    
    // Set authentication timeout
    const authTimeout = setTimeout(() => {
      ws.send(JSON.stringify({
        type: "auth_timeout",
        message: "Authentication timeout"
      }));
      ws.close();
    }, 10000); // 10 seconds
    
    ws.authTimeout = authTimeout;
  },
  
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      
      if (!authenticatedConnections.has(ws)) {
        // Handle authentication
        if (data.type === "auth") {
          handleAuthentication(ws, data);
        } else {
          ws.send(JSON.stringify({
            type: "error",
            message: "Authentication required"
          }));
        }
      } else {
        // Handle authenticated messages
        handleAuthenticatedMessage(ws, data);
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
    }
  },
  
  close: (ws) => {
    if (ws.authTimeout) {
      clearTimeout(ws.authTimeout);
    }
    authenticatedConnections.delete(ws);
  }
});

async function handleAuthentication(ws, data) {
  const { token } = data;
  
  try {
    // Verify token (implement your own verification)
    const user = await verifyToken(token);
    
    // Clear auth timeout
    if (ws.authTimeout) {
      clearTimeout(ws.authTimeout);
    }
    
    // Store authenticated connection
    authenticatedConnections.set(ws, {
      userId: user.id,
      username: user.username,
      role: user.role
    });
    
    ws.send(JSON.stringify({
      type: "auth_success",
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: "auth_failed",
      message: "Invalid token"
    }));
    ws.close();
  }
}

function handleAuthenticatedMessage(ws, data) {
  const user = authenticatedConnections.get(ws);
  
  switch (data.type) {
    case "message":
      // Handle authenticated messages
      broadcastMessage({
        type: "message",
        userId: user.userId,
        username: user.username,
        message: data.message,
        timestamp: new Date().toISOString()
      });
      break;
    case "admin_command":
      // Admin-only commands
      if (user.role === "admin") {
        handleAdminCommand(ws, data);
      } else {
        ws.send(JSON.stringify({
          type: "error",
          message: "Insufficient permissions"
        }));
      }
      break;
  }
}

function broadcastMessage(data) {
  const message = JSON.stringify(data);
  for (const [ws, user] of authenticatedConnections) {
    try {
      ws.send(message);
    } catch (error) {
      authenticatedConnections.delete(ws);
    }
  }
}

async function verifyToken(token) {
  // Implement your token verification logic
  // This is a placeholder
  if (token === "valid-token") {
    return { id: "123", username: "john", role: "user" };
  }
  throw new Error("Invalid token");
}

app.listen(3000);
```

## Error Handling

### Connection Error Handling

```typescript
const app = createServer(ServerProtocol.WEBSOCKET);

app.websocket({
  open: (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    console.log("WebSocket connection opened");
  },
  
  message: (ws, message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle message
      handleMessage(ws, data);
    } catch (error) {
      console.error("Message parsing error:", error);
      
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format",
        code: "INVALID_JSON"
      }));
    }
  },
  
  close: (ws, code, reason) => {
    console.log(`WebSocket closed: ${code} - ${reason}`);
    
    // Clean up resources
    cleanupConnection(ws);
  },
  
  error: (ws, error) => {
    console.error("WebSocket error:", error);
    
    // Send error to client if connection is still open
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Connection error occurred",
        code: "CONNECTION_ERROR"
      }));
    }
  }
});

// Health check with ping/pong
setInterval(() => {
  for (const [ws, connection] of connections) {
    if (!ws.isAlive) {
      console.log("Terminating inactive connection");
      ws.terminate();
      connections.delete(ws);
    } else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30000); // Check every 30 seconds
```

## Performance Optimization

### Connection Management

```typescript
const app = createServer(ServerProtocol.WEBSOCKET);

// Connection pool management
const maxConnections = 10000;
const connections = new Map();

app.websocket({
  open: (ws) => {
    if (connections.size >= maxConnections) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Server capacity reached"
      }));
      ws.close();
      return;
    }
    
    connections.set(ws, {
      connectedAt: Date.now(),
      lastActivity: Date.now()
    });
  },
  
  message: (ws, message) => {
    const connection = connections.get(ws);
    if (connection) {
      connection.lastActivity = Date.now();
    }
    
    // Handle message
    handleMessage(ws, message);
  },
  
  close: (ws) => {
    connections.delete(ws);
  }
});

// Clean up inactive connections
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes
  
  for (const [ws, connection] of connections) {
    if (now - connection.lastActivity > timeout) {
      console.log("Closing inactive connection");
      ws.close();
      connections.delete(ws);
    }
  }
}, 60000); // Check every minute
```

## Testing

### WebSocket Testing

```typescript
import { test, expect } from "bun:test";
import { createServer, ServerProtocol } from "verb";

test("WebSocket connection", async () => {
  const app = createServer(ServerProtocol.WEBSOCKET);
  
  let messageReceived = false;
  
  app.websocket({
    open: (ws) => {
      ws.send("Hello");
    },
    message: (ws, message) => {
      messageReceived = true;
      expect(message).toBe("Hello back");
    }
  });
  
  // Start server
  const server = app.listen(3001);
  
  // Test WebSocket connection
  const ws = new WebSocket("ws://localhost:3001");
  
  ws.onopen = () => {
    ws.send("Hello back");
  };
  
  // Wait for message
  await new Promise(resolve => setTimeout(resolve, 100));
  
  expect(messageReceived).toBe(true);
  
  ws.close();
  server.stop();
});
```

## Best Practices

1. **Authentication**: Always authenticate WebSocket connections
2. **Rate Limiting**: Implement rate limiting for messages
3. **Connection Limits**: Set maximum connection limits
4. **Health Checks**: Implement ping/pong for connection health
5. **Error Handling**: Handle errors gracefully
6. **Resource Cleanup**: Clean up resources on connection close
7. **Message Validation**: Validate incoming messages
8. **Security**: Use WSS for secure connections
9. **Monitoring**: Monitor connection metrics
10. **Graceful Shutdown**: Handle server shutdown properly

## Next Steps

- [gRPC](/guide/protocols/grpc) - Learn about gRPC servers
- [UDP](/guide/protocols/udp) - Connectionless communication
- [Security](/guide/security) - WebSocket security practices
- [Examples](/examples/websocket-chat) - WebSocket examples