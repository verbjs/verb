# TCP Server

API reference for creating TCP (Transmission Control Protocol) servers with reliable, connection-oriented communication and stream handling.

## Creating TCP Server

### Basic TCP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.TCP);

app.withOptions({
  port: 8080,
  host: "0.0.0.0",
  tcp: {
    onConnection: (socket) => {
      console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
      
      socket.write("Welcome to TCP server!\n");
      
      socket.on("data", (data) => {
        console.log(`Received: ${data}`);
        socket.write(`Echo: ${data}`);
      });
      
      socket.on("end", () => {
        console.log("Client disconnected");
      });
      
      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });
    },
    
    onError: (error) => {
      console.error("TCP Server error:", error);
    },
    
    onListening: () => {
      console.log("TCP server listening on port 8080");
    }
  }
});

app.listen(8080);
```

### TCP Server with Message Protocol

```typescript
class TCPMessageServer {
  private clients = new Map<string, TCPSocket>();
  
  constructor(private app: any) {
    this.setupServer();
  }
  
  setupServer() {
    this.app.withOptions({
      port: 8080,
      tcp: {
        onConnection: (socket) => {
          const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
          this.clients.set(clientId, socket);
          
          console.log(`Client ${clientId} connected`);
          
          // Set up message handling
          const messageHandler = new MessageHandler(socket);
          
          messageHandler.on("message", (message) => {
            this.handleMessage(clientId, message, socket);
          });
          
          socket.on("close", () => {
            this.clients.delete(clientId);
            console.log(`Client ${clientId} disconnected`);
          });
          
          socket.on("error", (error) => {
            console.error(`Socket error for ${clientId}:`, error);
            this.clients.delete(clientId);
          });
        }
      }
    });
  }
  
  handleMessage(clientId: string, message: any, socket: TCPSocket) {
    switch (message.type) {
      case "ping":
        socket.write(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;
        
      case "broadcast":
        this.broadcast(message.data, clientId);
        break;
        
      case "private":
        this.sendPrivateMessage(message.target, message.data, clientId);
        break;
        
      case "join_room":
        this.joinRoom(clientId, message.room);
        break;
        
      default:
        socket.write(JSON.stringify({ 
          type: "error", 
          message: `Unknown message type: ${message.type}` 
        }));
    }
  }
  
  broadcast(data: any, excludeClient?: string) {
    const message = JSON.stringify({
      type: "broadcast",
      data,
      timestamp: Date.now()
    });
    
    for (const [clientId, socket] of this.clients) {
      if (clientId !== excludeClient) {
        socket.write(message);
      }
    }
  }
  
  sendPrivateMessage(targetClient: string, data: any, fromClient: string) {
    const socket = this.clients.get(targetClient);
    if (socket) {
      socket.write(JSON.stringify({
        type: "private",
        from: fromClient,
        data,
        timestamp: Date.now()
      }));
    }
  }
}
```

## TCP Configuration

### Server Options

```typescript
app.withOptions({
  port: 8080,
  host: "0.0.0.0",
  
  tcp: {
    // Connection settings
    backlog: 511, // Maximum pending connections
    exclusive: false,
    
    // Socket options
    allowHalfOpen: false,
    pauseOnConnect: false,
    
    // Buffer settings
    readableHighWaterMark: 16384, // 16KB
    writableHighWaterMark: 16384, // 16KB
    
    // Keep-alive settings
    keepAlive: true,
    keepAliveInitialDelay: 60000, // 60 seconds
    
    // No delay (disable Nagle's algorithm)
    noDelay: true,
    
    // Timeout settings
    timeout: 300000, // 5 minutes
    
    // Event handlers
    onConnection: handleConnection,
    onError: handleError,
    onListening: handleListening,
    onClose: handleClose
  }
});
```

### Socket Configuration

```typescript
const configureSocket = (socket: TCPSocket) => {
  // Enable keep-alive
  socket.setKeepAlive(true, 60000); // 60 second initial delay
  
  // Disable Nagle's algorithm for low latency
  socket.setNoDelay(true);
  
  // Set timeout
  socket.setTimeout(300000, () => { // 5 minutes
    console.log("Socket timeout");
    socket.destroy();
  });
  
  // Configure buffer sizes
  socket.readable && socket.setEncoding("utf8");
  
  return socket;
};
```

## Message Handling

### Message Framing

```typescript
class MessageHandler extends EventEmitter {
  private buffer = "";
  private messageLength = 0;
  private state: "HEADER" | "BODY" = "HEADER";
  
  constructor(private socket: TCPSocket) {
    super();
    
    socket.on("data", (data) => {
      this.handleData(data);
    });
  }
  
  handleData(data: Buffer | string) {
    this.buffer += data.toString();
    
    while (this.buffer.length > 0) {
      if (this.state === "HEADER") {
        if (!this.parseHeader()) break;
      } else if (this.state === "BODY") {
        if (!this.parseBody()) break;
      }
    }
  }
  
  parseHeader(): boolean {
    const headerEnd = this.buffer.indexOf("\n");
    if (headerEnd === -1) return false;
    
    const header = this.buffer.slice(0, headerEnd);
    this.buffer = this.buffer.slice(headerEnd + 1);
    
    try {
      this.messageLength = parseInt(header, 10);
      this.state = "BODY";
      return true;
    } catch (error) {
      this.emit("error", new Error("Invalid message header"));
      return false;
    }
  }
  
  parseBody(): boolean {
    if (this.buffer.length < this.messageLength) return false;
    
    const messageData = this.buffer.slice(0, this.messageLength);
    this.buffer = this.buffer.slice(this.messageLength);
    
    try {
      const message = JSON.parse(messageData);
      this.emit("message", message);
    } catch (error) {
      this.emit("error", new Error("Invalid JSON message"));
    }
    
    this.state = "HEADER";
    this.messageLength = 0;
    return true;
  }
  
  sendMessage(message: any) {
    const data = JSON.stringify(message);
    const header = `${data.length}\n`;
    this.socket.write(header + data);
  }
}
```

### Binary Protocol Handler

```typescript
class BinaryProtocolHandler {
  private buffer = Buffer.alloc(0);
  
  constructor(private socket: TCPSocket) {
    socket.on("data", (data) => {
      this.handleBinaryData(data);
    });
  }
  
  handleBinaryData(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data]);
    
    while (this.buffer.length >= 8) { // Minimum header size
      const messageType = this.buffer.readUInt16BE(0);
      const messageLength = this.buffer.readUInt32BE(2);
      const flags = this.buffer.readUInt16BE(6);
      
      if (this.buffer.length < 8 + messageLength) {
        break; // Wait for complete message
      }
      
      const payload = this.buffer.slice(8, 8 + messageLength);
      this.buffer = this.buffer.slice(8 + messageLength);
      
      this.handleBinaryMessage({
        type: messageType,
        length: messageLength,
        flags,
        payload
      });
    }
  }
  
  handleBinaryMessage(message: any) {
    switch (message.type) {
      case 0x01: // Heartbeat
        this.sendBinaryMessage(0x02, Buffer.from("pong"));
        break;
        
      case 0x10: // Data message
        this.processDataMessage(message.payload);
        break;
        
      case 0x20: // File transfer
        this.handleFileTransfer(message.payload);
        break;
        
      default:
        console.log("Unknown binary message type:", message.type);
    }
  }
  
  sendBinaryMessage(type: number, payload: Buffer, flags = 0) {
    const header = Buffer.alloc(8);
    header.writeUInt16BE(type, 0);
    header.writeUInt32BE(payload.length, 2);
    header.writeUInt16BE(flags, 6);
    
    this.socket.write(Buffer.concat([header, payload]));
  }
}
```

## Connection Management

### Connection Pool

```typescript
class TCPConnectionPool {
  private connections = new Map<string, ConnectionInfo>();
  private maxConnections = 1000;
  
  addConnection(socket: TCPSocket): string {
    if (this.connections.size >= this.maxConnections) {
      throw new Error("Connection limit reached");
    }
    
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    
    this.connections.set(connectionId, {
      socket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      bytesReceived: 0,
      bytesSent: 0
    });
    
    this.setupSocketHandlers(socket, connectionId);
    
    return connectionId;
  }
  
  setupSocketHandlers(socket: TCPSocket, connectionId: string) {
    socket.on("data", (data) => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.lastActivity = Date.now();
        conn.bytesReceived += data.length;
      }
    });
    
    socket.on("close", () => {
      this.connections.delete(connectionId);
    });
    
    socket.on("error", () => {
      this.connections.delete(connectionId);
    });
  }
  
  removeConnection(connectionId: string) {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.socket.destroy();
      this.connections.delete(connectionId);
    }
  }
  
  broadcast(data: Buffer | string, excludeConnection?: string) {
    for (const [id, conn] of this.connections) {
      if (id !== excludeConnection) {
        conn.socket.write(data);
        conn.bytesSent += data.length;
      }
    }
  }
  
  getConnectionStats() {
    return {
      total: this.connections.size,
      connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
        id,
        uptime: Date.now() - conn.connectedAt,
        lastActivity: Date.now() - conn.lastActivity,
        bytesReceived: conn.bytesReceived,
        bytesSent: conn.bytesSent
      }))
    };
  }
  
  cleanup(maxIdleTime = 300000) { // 5 minutes
    const now = Date.now();
    const idleConnections = [];
    
    for (const [id, conn] of this.connections) {
      if (now - conn.lastActivity > maxIdleTime) {
        idleConnections.push(id);
      }
    }
    
    idleConnections.forEach(id => {
      console.log(`Closing idle connection: ${id}`);
      this.removeConnection(id);
    });
  }
}

interface ConnectionInfo {
  socket: TCPSocket;
  connectedAt: number;
  lastActivity: number;
  bytesReceived: number;
  bytesSent: number;
}
```

### Room-based Communication

```typescript
class TCPRoomManager {
  private rooms = new Map<string, Set<string>>();
  private clients = new Map<string, ClientInfo>();
  
  addClient(connectionId: string, socket: TCPSocket, metadata = {}) {
    this.clients.set(connectionId, {
      socket,
      rooms: new Set(),
      metadata,
      joinedAt: Date.now()
    });
  }
  
  removeClient(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (client) {
      // Remove from all rooms
      for (const roomId of client.rooms) {
        this.leaveRoom(connectionId, roomId);
      }
      this.clients.delete(connectionId);
    }
  }
  
  joinRoom(connectionId: string, roomId: string) {
    const client = this.clients.get(connectionId);
    if (!client) return false;
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    this.rooms.get(roomId)!.add(connectionId);
    client.rooms.add(roomId);
    
    // Notify room members
    this.broadcastToRoom(roomId, {
      type: "user_joined",
      connectionId,
      room: roomId,
      timestamp: Date.now()
    }, connectionId);
    
    return true;
  }
  
  leaveRoom(connectionId: string, roomId: string) {
    const client = this.clients.get(connectionId);
    const room = this.rooms.get(roomId);
    
    if (client && room) {
      room.delete(connectionId);
      client.rooms.delete(roomId);
      
      if (room.size === 0) {
        this.rooms.delete(roomId);
      } else {
        // Notify remaining room members
        this.broadcastToRoom(roomId, {
          type: "user_left",
          connectionId,
          room: roomId,
          timestamp: Date.now()
        });
      }
    }
  }
  
  broadcastToRoom(roomId: string, message: any, excludeClient?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    for (const connectionId of room) {
      if (connectionId !== excludeClient) {
        const client = this.clients.get(connectionId);
        if (client) {
          client.socket.write(messageStr);
        }
      }
    }
  }
  
  getRoomMembers(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    return Array.from(room)
      .map(connectionId => this.clients.get(connectionId))
      .filter(client => client !== undefined);
  }
  
  getClientRooms(connectionId: string) {
    const client = this.clients.get(connectionId);
    return client ? Array.from(client.rooms) : [];
  }
}

interface ClientInfo {
  socket: TCPSocket;
  rooms: Set<string>;
  metadata: any;
  joinedAt: number;
}
```

## Stream Processing

### File Transfer Server

```typescript
class TCPFileTransferServer {
  private transfers = new Map<string, FileTransfer>();
  
  constructor(private uploadDir = "./uploads") {}
  
  handleFileTransfer(socket: TCPSocket, message: any) {
    switch (message.type) {
      case "file_start":
        this.startFileTransfer(socket, message);
        break;
        
      case "file_chunk":
        this.receiveFileChunk(socket, message);
        break;
        
      case "file_end":
        this.endFileTransfer(socket, message);
        break;
    }
  }
  
  startFileTransfer(socket: TCPSocket, message: any) {
    const { transferId, filename, fileSize, chunkSize } = message;
    
    const filepath = `${this.uploadDir}/${filename}`;
    const writeStream = Bun.file(filepath).writer();
    
    this.transfers.set(transferId, {
      filename,
      fileSize,
      chunkSize,
      receivedBytes: 0,
      writeStream,
      startTime: Date.now(),
      chunks: []
    });
    
    socket.write(JSON.stringify({
      type: "file_start_ack",
      transferId,
      status: "ready"
    }));
  }
  
  receiveFileChunk(socket: TCPSocket, message: any) {
    const { transferId, chunkIndex, data } = message;
    const transfer = this.transfers.get(transferId);
    
    if (!transfer) {
      socket.write(JSON.stringify({
        type: "error",
        message: "Transfer not found"
      }));
      return;
    }
    
    // Decode base64 chunk
    const chunkData = Buffer.from(data, "base64");
    transfer.writeStream.write(chunkData);
    transfer.receivedBytes += chunkData.length;
    
    // Send chunk acknowledgment
    socket.write(JSON.stringify({
      type: "file_chunk_ack",
      transferId,
      chunkIndex,
      receivedBytes: transfer.receivedBytes
    }));
    
    // Progress update
    const progress = (transfer.receivedBytes / transfer.fileSize) * 100;
    if (chunkIndex % 100 === 0) { // Every 100 chunks
      socket.write(JSON.stringify({
        type: "file_progress",
        transferId,
        progress,
        receivedBytes: transfer.receivedBytes,
        totalBytes: transfer.fileSize
      }));
    }
  }
  
  endFileTransfer(socket: TCPSocket, message: any) {
    const { transferId } = message;
    const transfer = this.transfers.get(transferId);
    
    if (!transfer) return;
    
    transfer.writeStream.end();
    
    const duration = Date.now() - transfer.startTime;
    const avgSpeed = transfer.receivedBytes / (duration / 1000); // bytes per second
    
    socket.write(JSON.stringify({
      type: "file_complete",
      transferId,
      filename: transfer.filename,
      receivedBytes: transfer.receivedBytes,
      duration,
      avgSpeed
    }));
    
    this.transfers.delete(transferId);
  }
}

interface FileTransfer {
  filename: string;
  fileSize: number;
  chunkSize: number;
  receivedBytes: number;
  writeStream: any;
  startTime: number;
  chunks: Buffer[];
}
```

### Stream Multiplexing

```typescript
class TCPStreamMultiplexer {
  private streams = new Map<number, StreamHandler>();
  private nextStreamId = 1;
  
  constructor(private socket: TCPSocket) {
    this.setupProtocol();
  }
  
  setupProtocol() {
    this.socket.on("data", (data) => {
      this.handleMultiplexedData(data);
    });
  }
  
  createStream(type: string, metadata = {}): number {
    const streamId = this.nextStreamId++;
    
    const stream = new StreamHandler(streamId, type, this.socket);
    this.streams.set(streamId, stream);
    
    // Send stream creation message
    this.sendControlMessage({
      type: "stream_create",
      streamId,
      streamType: type,
      metadata
    });
    
    return streamId;
  }
  
  closeStream(streamId: number) {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.close();
      this.streams.delete(streamId);
      
      this.sendControlMessage({
        type: "stream_close",
        streamId
      });
    }
  }
  
  sendStreamData(streamId: number, data: Buffer) {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(streamId, 0);
    header.writeUInt32BE(data.length, 4);
    
    this.socket.write(Buffer.concat([header, data]));
  }
  
  handleMultiplexedData(data: Buffer) {
    // Parse multiplexed stream data
    let offset = 0;
    
    while (offset < data.length) {
      if (data.length - offset < 8) break; // Incomplete header
      
      const streamId = data.readUInt32BE(offset);
      const dataLength = data.readUInt32BE(offset + 4);
      
      if (data.length - offset < 8 + dataLength) break; // Incomplete data
      
      const streamData = data.slice(offset + 8, offset + 8 + dataLength);
      
      if (streamId === 0) {
        // Control message
        this.handleControlMessage(streamData);
      } else {
        // Stream data
        const stream = this.streams.get(streamId);
        if (stream) {
          stream.handleData(streamData);
        }
      }
      
      offset += 8 + dataLength;
    }
  }
  
  sendControlMessage(message: any) {
    const data = Buffer.from(JSON.stringify(message));
    this.sendStreamData(0, data); // Stream ID 0 for control
  }
  
  handleControlMessage(data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case "stream_create":
          this.handleRemoteStreamCreate(message);
          break;
        case "stream_close":
          this.handleRemoteStreamClose(message);
          break;
      }
    } catch (error) {
      console.error("Invalid control message:", error);
    }
  }
}

class StreamHandler extends EventEmitter {
  constructor(
    public id: number,
    public type: string,
    private socket: TCPSocket
  ) {
    super();
  }
  
  write(data: Buffer) {
    this.emit("data", this.id, data);
  }
  
  handleData(data: Buffer) {
    this.emit("data", data);
  }
  
  close() {
    this.emit("close");
  }
}
```

## Performance Optimization

### Connection Throttling

```typescript
class ConnectionThrottler {
  private connections = new Map<string, ConnectionInfo>();
  
  constructor(
    private maxConnectionsPerIP = 10,
    private timeWindow = 60000 // 1 minute
  ) {}
  
  canAcceptConnection(remoteAddress: string): boolean {
    const now = Date.now();
    const connInfo = this.connections.get(remoteAddress);
    
    if (!connInfo) {
      this.connections.set(remoteAddress, {
        count: 1,
        firstConnection: now,
        lastConnection: now
      });
      return true;
    }
    
    // Reset if time window expired
    if (now - connInfo.firstConnection > this.timeWindow) {
      connInfo.count = 1;
      connInfo.firstConnection = now;
      connInfo.lastConnection = now;
      return true;
    }
    
    // Check if under limit
    if (connInfo.count >= this.maxConnectionsPerIP) {
      return false;
    }
    
    connInfo.count++;
    connInfo.lastConnection = now;
    return true;
  }
  
  releaseConnection(remoteAddress: string) {
    const connInfo = this.connections.get(remoteAddress);
    if (connInfo) {
      connInfo.count = Math.max(0, connInfo.count - 1);
    }
  }
}

interface ConnectionInfo {
  count: number;
  firstConnection: number;
  lastConnection: number;
}
```

### Buffer Optimization

```typescript
class OptimizedBufferManager {
  private bufferPool: Buffer[] = [];
  private readonly bufferSize = 64 * 1024; // 64KB
  
  getBuffer(): Buffer {
    return this.bufferPool.pop() || Buffer.allocUnsafe(this.bufferSize);
  }
  
  returnBuffer(buffer: Buffer) {
    if (buffer.length === this.bufferSize) {
      buffer.fill(0); // Clear buffer
      this.bufferPool.push(buffer);
    }
  }
  
  configureSocket(socket: TCPSocket) {
    // Optimize socket buffers
    socket.setNoDelay(true); // Disable Nagle's algorithm
    socket.setKeepAlive(true, 60000); // Enable keep-alive
    
    // Use optimized read/write handling
    const readBuffer = this.getBuffer();
    
    socket.on("data", (data) => {
      // Process data efficiently
      this.processData(data, readBuffer);
    });
    
    socket.on("close", () => {
      this.returnBuffer(readBuffer);
    });
  }
  
  processData(data: Buffer, workBuffer: Buffer) {
    // Efficient data processing using pre-allocated buffer
    data.copy(workBuffer, 0, 0, Math.min(data.length, workBuffer.length));
    // Process workBuffer...
  }
}
```

## Error Handling & Recovery

### Graceful Shutdown

```typescript
class TCPServerManager {
  private server: any;
  private connections = new Set<TCPSocket>();
  private isShuttingDown = false;
  
  constructor(app: any) {
    this.server = app;
    this.setupGracefulShutdown();
  }
  
  setupGracefulShutdown() {
    process.on("SIGTERM", () => this.gracefulShutdown());
    process.on("SIGINT", () => this.gracefulShutdown());
    
    this.server.withOptions({
      tcp: {
        onConnection: (socket) => {
          if (this.isShuttingDown) {
            socket.destroy();
            return;
          }
          
          this.connections.add(socket);
          
          socket.on("close", () => {
            this.connections.delete(socket);
          });
        }
      }
    });
  }
  
  async gracefulShutdown() {
    console.log("Starting graceful shutdown...");
    this.isShuttingDown = true;
    
    // Stop accepting new connections
    this.server.close();
    
    // Notify existing connections
    for (const socket of this.connections) {
      socket.write(JSON.stringify({
        type: "server_shutdown",
        message: "Server is shutting down",
        gracePeriod: 30000 // 30 seconds
      }));
    }
    
    // Wait for connections to close gracefully
    const shutdownTimeout = setTimeout(() => {
      console.log("Force closing remaining connections");
      for (const socket of this.connections) {
        socket.destroy();
      }
    }, 30000);
    
    // Wait for all connections to close
    while (this.connections.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    clearTimeout(shutdownTimeout);
    console.log("Graceful shutdown complete");
    process.exit(0);
  }
}
```

### Connection Recovery

```typescript
class TCPConnectionRecovery {
  private reconnectAttempts = new Map<string, number>();
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1 second
  
  handleConnectionError(socket: TCPSocket, error: Error) {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.error(`Connection error for ${clientId}:`, error.message);
    
    // Log error details
    this.logConnectionError(clientId, error);
    
    // Clean up resources
    this.cleanupConnection(socket, clientId);
  }
  
  logConnectionError(clientId: string, error: Error) {
    const errorLog = {
      clientId,
      error: error.message,
      code: (error as any).code,
      timestamp: new Date().toISOString(),
      attempts: this.reconnectAttempts.get(clientId) || 0
    };
    
    console.log("Connection error log:", errorLog);
  }
  
  cleanupConnection(socket: TCPSocket, clientId: string) {
    // Remove from connection pools
    // Clean up any pending operations
    // Update connection metrics
    
    socket.removeAllListeners();
    socket.destroy();
  }
  
  scheduleReconnectNotification(clientId: string) {
    const attempts = this.reconnectAttempts.get(clientId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.log(`Max reconnect attempts reached for ${clientId}`);
      this.reconnectAttempts.delete(clientId);
      return;
    }
    
    const delay = this.baseReconnectDelay * Math.pow(2, attempts); // Exponential backoff
    this.reconnectAttempts.set(clientId, attempts + 1);
    
    setTimeout(() => {
      this.sendReconnectInvitation(clientId);
    }, delay);
  }
  
  sendReconnectInvitation(clientId: string) {
    // Implementation depends on your application's reconnection strategy
    console.log(`Sending reconnect invitation to ${clientId}`);
  }
}
```

## Testing TCP Server

```typescript
import { test, expect } from "bun:test";
import { createTCPClient, createTCPServer } from "verb/testing";

test("TCP server accepts connections", async () => {
  const server = createTCPServer({
    port: 0, // Random port
    onConnection: (socket) => {
      socket.write("Hello Client!");
    }
  });
  
  const client = createTCPClient();
  const serverAddress = server.address();
  
  await client.connect(serverAddress.port, "localhost");
  
  const data = await new Promise((resolve) => {
    client.on("data", resolve);
  });
  
  expect(data.toString()).toBe("Hello Client!");
  
  client.destroy();
  server.close();
});

test("TCP server handles message protocol", async () => {
  const server = createTCPServer({
    port: 0,
    onConnection: (socket) => {
      const messageHandler = new MessageHandler(socket);
      
      messageHandler.on("message", (message) => {
        messageHandler.sendMessage({
          type: "response",
          echo: message.data
        });
      });
    }
  });
  
  const client = createTCPClient();
  const serverAddress = server.address();
  
  await client.connect(serverAddress.port, "localhost");
  
  const messageHandler = new MessageHandler(client);
  
  messageHandler.sendMessage({
    type: "test",
    data: "Hello Server!"
  });
  
  const response = await new Promise((resolve) => {
    messageHandler.on("message", resolve);
  });
  
  expect(response.type).toBe("response");
  expect(response.echo).toBe("Hello Server!");
  
  client.destroy();
  server.close();
});
```

## Best Practices

1. **Connection Management**: Implement proper connection pooling and limits
2. **Error Handling**: Handle network errors and connection drops gracefully
3. **Buffer Management**: Use buffer pools for high-throughput scenarios
4. **Message Framing**: Implement proper message boundaries for protocols
5. **Flow Control**: Handle backpressure and congestion
6. **Security**: Validate all incoming data and implement rate limiting
7. **Monitoring**: Track connection metrics and performance
8. **Graceful Shutdown**: Implement proper server shutdown procedures

## See Also

- [UDP Server](/api/servers/udp) - Connectionless protocol alternative
- [HTTP Server](/api/servers/http) - Higher-level HTTP protocol
- [WebSocket Server](/api/servers/websocket) - Real-time web communication
- [Performance Guide](/guide/performance) - TCP optimization techniques