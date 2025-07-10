# TCP (Transmission Control Protocol)

Verb supports TCP for reliable, connection-oriented communication with guaranteed delivery and ordering.

## Overview

TCP provides:
- **Reliable Delivery**: Guaranteed message delivery
- **Ordered Data**: Messages arrive in order
- **Connection-Oriented**: Persistent connections
- **Flow Control**: Automatic congestion management

## Creating a TCP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.TCP);

app.onConnection((socket) => {
  console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
  
  socket.on("data", (data) => {
    console.log(`Received: ${data}`);
    socket.write(`Echo: ${data}`);
  });
  
  socket.on("close", () => {
    console.log("Client disconnected");
  });
  
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

app.listen(3000);
console.log("TCP server listening on port 3000");
```

## Message Protocols

Implement custom message protocols:

```typescript
class MessageProtocol {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
  }
  
  send(message) {
    const data = JSON.stringify(message);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    
    this.socket.write(Buffer.concat([length, Buffer.from(data)]));
  }
  
  handleData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    
    while (this.buffer.length >= 4) {
      const messageLength = this.buffer.readUInt32BE(0);
      
      if (this.buffer.length >= 4 + messageLength) {
        const messageData = this.buffer.slice(4, 4 + messageLength);
        this.buffer = this.buffer.slice(4 + messageLength);
        
        try {
          const message = JSON.parse(messageData.toString());
          this.onMessage(message);
        } catch (error) {
          console.error("Invalid message:", error);
        }
      } else {
        break; // Wait for more data
      }
    }
  }
  
  onMessage(message) {
    // Override in subclass
    console.log("Received message:", message);
  }
}

app.onConnection((socket) => {
  const protocol = new MessageProtocol(socket);
  
  socket.on("data", (data) => {
    protocol.handleData(data);
  });
  
  protocol.onMessage = (message) => {
    switch (message.type) {
      case "ping":
        protocol.send({ type: "pong", timestamp: Date.now() });
        break;
      case "chat":
        broadcastMessage(message, socket);
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  };
});
```

## Connection Management

Track and manage connections:

```typescript
const connections = new Map();

app.onConnection((socket) => {
  const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
  
  connections.set(connectionId, {
    socket,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    authenticated: false
  });
  
  socket.on("data", (data) => {
    const connection = connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
    
    handleMessage(data, socket, connectionId);
  });
  
  socket.on("close", () => {
    connections.delete(connectionId);
    console.log(`Connection closed: ${connectionId}`);
  });
  
  socket.on("error", (error) => {
    console.error(`Connection error ${connectionId}:`, error);
    connections.delete(connectionId);
  });
  
  // Set connection timeout
  socket.setTimeout(300000); // 5 minutes
  socket.on("timeout", () => {
    console.log(`Connection timeout: ${connectionId}`);
    socket.destroy();
  });
});

// Cleanup inactive connections
setInterval(() => {
  const now = Date.now();
  const timeout = 300000; // 5 minutes
  
  for (const [connectionId, connection] of connections) {
    if (now - connection.lastActivity > timeout) {
      console.log(`Cleaning up inactive connection: ${connectionId}`);
      connection.socket.destroy();
      connections.delete(connectionId);
    }
  }
}, 60000); // Check every minute
```

## Streaming Data

Handle streaming data efficiently:

```typescript
app.onConnection((socket) => {
  socket.on("data", (chunk) => {
    // Process streaming data
    processStreamChunk(chunk, socket);
  });
});

function processStreamChunk(chunk, socket) {
  // Example: Process audio/video stream
  const header = chunk.slice(0, 8);
  const payload = chunk.slice(8);
  
  const streamType = header.readUInt16BE(0);
  const timestamp = header.readUInt32BE(2);
  const sequenceNumber = header.readUInt16BE(6);
  
  switch (streamType) {
    case 1: // Audio
      processAudioData(payload, timestamp);
      break;
    case 2: // Video
      processVideoData(payload, timestamp);
      break;
    default:
      console.log("Unknown stream type:", streamType);
  }
  
  // Send acknowledgment
  const ack = Buffer.alloc(4);
  ack.writeUInt16BE(sequenceNumber, 0);
  ack.writeUInt16BE(0x0001, 2); // ACK flag
  socket.write(ack);
}
```

## Chat Server Example

Complete chat server with rooms:

```typescript
const rooms = new Map();
const clients = new Map();

app.onConnection((socket) => {
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  
  clients.set(clientId, {
    socket,
    nickname: null,
    room: null,
    connectedAt: Date.now()
  });
  
  const protocol = new MessageProtocol(socket);
  
  protocol.onMessage = (message) => {
    const client = clients.get(clientId);
    
    switch (message.type) {
      case "login":
        client.nickname = message.nickname;
        protocol.send({
          type: "login_success",
          clientId,
          message: `Welcome, ${message.nickname}!`
        });
        break;
        
      case "join_room":
        joinRoom(clientId, message.room);
        break;
        
      case "leave_room":
        leaveRoom(clientId);
        break;
        
      case "chat_message":
        if (client.room) {
          broadcastToRoom(client.room, {
            type: "chat_message",
            from: client.nickname,
            message: message.message,
            timestamp: Date.now()
          }, clientId);
        }
        break;
        
      case "private_message":
        sendPrivateMessage(clientId, message.to, message.message);
        break;
    }
  };
  
  socket.on("data", (data) => {
    protocol.handleData(data);
  });
  
  socket.on("close", () => {
    const client = clients.get(clientId);
    if (client && client.room) {
      leaveRoom(clientId);
    }
    clients.delete(clientId);
  });
});

function joinRoom(clientId, roomName) {
  const client = clients.get(clientId);
  if (!client) return;
  
  // Leave current room
  if (client.room) {
    leaveRoom(clientId);
  }
  
  // Join new room
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  
  rooms.get(roomName).add(clientId);
  client.room = roomName;
  
  // Notify room
  broadcastToRoom(roomName, {
    type: "user_joined",
    nickname: client.nickname,
    message: `${client.nickname} joined the room`
  }, clientId);
  
  // Send room info to client
  const protocol = new MessageProtocol(client.socket);
  protocol.send({
    type: "room_joined",
    room: roomName,
    users: Array.from(rooms.get(roomName)).map(id => clients.get(id)?.nickname).filter(Boolean)
  });
}

function leaveRoom(clientId) {
  const client = clients.get(clientId);
  if (!client || !client.room) return;
  
  const room = rooms.get(client.room);
  if (room) {
    room.delete(clientId);
    
    // Notify room
    broadcastToRoom(client.room, {
      type: "user_left",
      nickname: client.nickname,
      message: `${client.nickname} left the room`
    }, clientId);
    
    // Clean up empty room
    if (room.size === 0) {
      rooms.delete(client.room);
    }
  }
  
  client.room = null;
}

function broadcastToRoom(roomName, message, excludeClientId = null) {
  const room = rooms.get(roomName);
  if (!room) return;
  
  for (const clientId of room) {
    if (clientId !== excludeClientId) {
      const client = clients.get(clientId);
      if (client) {
        const protocol = new MessageProtocol(client.socket);
        protocol.send(message);
      }
    }
  }
}
```

## TCP Client

Creating a TCP client:

```typescript
import { TCPSocket } from "verb/tcp";

const client = new TCPSocket();

client.connect(3000, "localhost", () => {
  console.log("Connected to server");
  
  const protocol = new MessageProtocol(client);
  
  // Login
  protocol.send({
    type: "login",
    nickname: "TestUser"
  });
  
  // Join room
  protocol.send({
    type: "join_room",
    room: "general"
  });
});

client.on("data", (data) => {
  protocol.handleData(data);
});

protocol.onMessage = (message) => {
  console.log("Received:", message);
};

client.on("error", (error) => {
  console.error("Client error:", error);
});

client.on("close", () => {
  console.log("Disconnected from server");
});
```

## SSL/TLS Support

Secure TCP connections:

```typescript
app.withOptions({
  port: 3000,
  tls: {
    cert: await Bun.file("cert.pem").text(),
    key: await Bun.file("key.pem").text(),
    ca: await Bun.file("ca.pem").text(), // Optional CA
    requestCert: true,
    rejectUnauthorized: false
  }
});

app.onConnection((socket) => {
  // Check if connection is secure
  if (socket.encrypted) {
    console.log("Secure connection established");
    console.log("Cipher:", socket.getCipher());
    console.log("Protocol:", socket.getProtocol());
  }
  
  // Handle secure connection
  handleSecureConnection(socket);
});
```

## Performance Optimization

Optimize TCP performance:

```typescript
app.withOptions({
  port: 3000,
  tcp: {
    keepAlive: true,
    keepAliveInitialDelay: 300000, // 5 minutes
    noDelay: true, // Disable Nagle's algorithm
    timeout: 300000, // 5 minutes
    allowHalfOpen: false
  }
});

// Connection pooling
class ConnectionPool {
  constructor(maxConnections = 100) {
    this.connections = new Set();
    this.maxConnections = maxConnections;
  }
  
  addConnection(socket) {
    if (this.connections.size >= this.maxConnections) {
      socket.destroy();
      return false;
    }
    
    this.connections.add(socket);
    
    socket.on("close", () => {
      this.connections.delete(socket);
    });
    
    return true;
  }
  
  getConnectionCount() {
    return this.connections.size;
  }
}

const pool = new ConnectionPool(1000);

app.onConnection((socket) => {
  if (!pool.addConnection(socket)) {
    console.log("Connection limit reached");
    return;
  }
  
  handleConnection(socket);
});
```

## Error Handling

Handle TCP-specific errors:

```typescript
app.onError((error) => {
  console.error("TCP Server Error:", error);
  
  switch (error.code) {
    case "EADDRINUSE":
      console.error("Port is already in use");
      process.exit(1);
      break;
    case "EACCES":
      console.error("Permission denied");
      break;
    case "ENOENT":
      console.error("No such file or directory");
      break;
    default:
      console.error("Unknown TCP error:", error.message);
  }
});

app.onConnection((socket) => {
  socket.on("error", (error) => {
    console.error("Socket error:", error);
    
    switch (error.code) {
      case "ECONNRESET":
        console.log("Connection reset by peer");
        break;
      case "ETIMEDOUT":
        console.log("Connection timed out");
        break;
      case "EPIPE":
        console.log("Broken pipe");
        break;
      default:
        console.error("Unknown socket error:", error.message);
    }
  });
});
```

## Best Practices

1. **Handle Backpressure**: Use `socket.write()` return value
2. **Set Timeouts**: Prevent hanging connections
3. **Validate Data**: Check incoming data format
4. **Implement Heartbeats**: Detect dead connections
5. **Use Connection Pools**: Limit concurrent connections
6. **Monitor Performance**: Track connection metrics

## Use Cases

TCP is ideal for:
- **Chat Applications**: Reliable messaging
- **File Transfer**: Large file uploads/downloads
- **Database Connections**: Persistent DB connections
- **Streaming**: Media streaming protocols
- **Remote Control**: Device management

## Next Steps

- [Performance](/guide/performance) - Optimization techniques
- [Testing](/guide/testing) - Testing strategies
- [Security](/guide/security) - Security best practices