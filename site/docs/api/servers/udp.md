# UDP Server

API reference for creating UDP (User Datagram Protocol) servers for connectionless, low-latency communication with packet handling and broadcasting.

## Creating UDP Server

### Basic UDP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.UDP);

app.withOptions({
  port: 8080,
  address: "0.0.0.0",
  udp: {
    reuseAddr: true,
    onMessage: (message, rinfo, socket) => {
      console.log(`Received: ${message} from ${rinfo.address}:${rinfo.port}`);
      
      // Echo the message back
      const response = `Echo: ${message}`;
      socket.send(response, rinfo.port, rinfo.address);
    },
    
    onError: (error) => {
      console.error("UDP Server error:", error);
    },
    
    onListening: () => {
      console.log("UDP server listening on port 8080");
    }
  }
});

app.listen(8080);
```

### UDP Server with Message Routing

```typescript
const app = createServer(ServerProtocol.UDP);

// Define message handlers
const messageHandlers = {
  ping: (data, rinfo, socket) => {
    socket.send("pong", rinfo.port, rinfo.address);
  },
  
  echo: (data, rinfo, socket) => {
    const { message } = JSON.parse(data);
    const response = JSON.stringify({ echo: message });
    socket.send(response, rinfo.port, rinfo.address);
  },
  
  broadcast: (data, rinfo, socket) => {
    const { message } = JSON.parse(data);
    broadcastToAllClients(message, rinfo);
  },
  
  time: (data, rinfo, socket) => {
    const response = JSON.stringify({ 
      time: new Date().toISOString() 
    });
    socket.send(response, rinfo.port, rinfo.address);
  }
};

app.withOptions({
  port: 8080,
  udp: {
    onMessage: (message, rinfo, socket) => {
      try {
        const data = JSON.parse(message.toString());
        const handler = messageHandlers[data.type];
        
        if (handler) {
          handler(data, rinfo, socket);
        } else {
          const error = JSON.stringify({ 
            error: `Unknown message type: ${data.type}` 
          });
          socket.send(error, rinfo.port, rinfo.address);
        }
      } catch (error) {
        const errorResponse = JSON.stringify({ 
          error: "Invalid JSON message" 
        });
        socket.send(errorResponse, rinfo.port, rinfo.address);
      }
    }
  }
});
```

## UDP Configuration

### Server Options

```typescript
app.withOptions({
  port: 8080,
  address: "0.0.0.0", // Bind to all interfaces
  
  udp: {
    // Socket options
    reuseAddr: true,
    ipv6Only: false, // Accept both IPv4 and IPv6
    
    // Buffer sizes
    recvBufferSize: 65536, // 64KB receive buffer
    sendBufferSize: 65536, // 64KB send buffer
    
    // Timeouts
    timeout: 30000, // 30 seconds
    
    // Event handlers
    onMessage: handleMessage,
    onError: handleError,
    onListening: handleListening,
    onClose: handleClose,
    
    // Performance options
    highWaterMark: 16384, // 16KB
    allowHalfOpen: false
  }
});
```

### IPv6 Support

```typescript
app.withOptions({
  port: 8080,
  address: "::", // IPv6 any address
  
  udp: {
    ipv6Only: false, // Allow both IPv4 and IPv6
    
    onMessage: (message, rinfo, socket) => {
      console.log(`Message from ${rinfo.family} ${rinfo.address}:${rinfo.port}`);
      console.log(`Family: ${rinfo.family}`); // "IPv4" or "IPv6"
      
      // Handle message regardless of IP version
      handleMessage(message, rinfo, socket);
    }
  }
});
```

## Message Handling

### Packet Structure

```typescript
interface UDPPacket {
  data: Buffer;
  rinfo: {
    address: string;
    family: "IPv4" | "IPv6";
    port: number;
    size: number;
  };
}

// Message parser
const parseMessage = (packet: UDPPacket) => {
  const { data, rinfo } = packet;
  
  try {
    // Try JSON first
    const json = JSON.parse(data.toString());
    return { type: "json", data: json, rinfo };
  } catch {
    // Fallback to binary protocol
    return parseBinaryMessage(data, rinfo);
  }
};

const parseBinaryMessage = (data: Buffer, rinfo: any) => {
  // Example binary protocol: [type:1][length:4][payload:length]
  if (data.length < 5) {
    throw new Error("Invalid binary message");
  }
  
  const type = data.readUInt8(0);
  const length = data.readUInt32BE(1);
  const payload = data.slice(5, 5 + length);
  
  return {
    type: "binary",
    messageType: type,
    payload,
    rinfo
  };
};
```

### Message Broadcasting

```typescript
class UDPBroadcaster {
  private clients = new Map<string, ClientInfo>();
  
  constructor(private socket: any) {}
  
  registerClient(address: string, port: number, metadata = {}) {
    const key = `${address}:${port}`;
    this.clients.set(key, {
      address,
      port,
      lastSeen: Date.now(),
      metadata
    });
  }
  
  removeClient(address: string, port: number) {
    const key = `${address}:${port}`;
    this.clients.delete(key);
  }
  
  broadcast(message: string | Buffer, excludeClient?: string) {
    for (const [key, client] of this.clients) {
      if (key !== excludeClient) {
        this.socket.send(message, client.port, client.address);
      }
    }
  }
  
  multicast(message: string | Buffer, predicate: (client: ClientInfo) => boolean) {
    for (const client of this.clients.values()) {
      if (predicate(client)) {
        this.socket.send(message, client.port, client.address);
      }
    }
  }
  
  getClients() {
    return Array.from(this.clients.values());
  }
  
  cleanup(maxAge = 300000) { // 5 minutes
    const now = Date.now();
    for (const [key, client] of this.clients) {
      if (now - client.lastSeen > maxAge) {
        this.clients.delete(key);
      }
    }
  }
}

interface ClientInfo {
  address: string;
  port: number;
  lastSeen: number;
  metadata: any;
}
```

### Room-based Broadcasting

```typescript
class UDPRoomManager {
  private rooms = new Map<string, Set<string>>();
  private clients = new Map<string, ClientInfo>();
  
  joinRoom(clientId: string, roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(clientId);
  }
  
  leaveRoom(clientId: string, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
  
  broadcastToRoom(roomId: string, message: string | Buffer, socket: any, excludeClient?: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      for (const clientId of room) {
        if (clientId !== excludeClient) {
          const client = this.clients.get(clientId);
          if (client) {
            socket.send(message, client.port, client.address);
          }
        }
      }
    }
  }
  
  getRoomClients(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    return Array.from(room)
      .map(clientId => this.clients.get(clientId))
      .filter(client => client !== undefined);
  }
}
```

## Real-time Applications

### Game Server

```typescript
class UDPGameServer {
  private players = new Map();
  private gameState = {
    players: new Map(),
    objects: new Map(),
    timestamp: Date.now()
  };
  
  constructor(private socket: any) {
    this.startGameLoop();
  }
  
  handlePlayerMessage(data: any, rinfo: any) {
    const { playerId, action, payload } = data;
    
    switch (action) {
      case "join":
        this.addPlayer(playerId, rinfo, payload);
        break;
      case "move":
        this.movePlayer(playerId, payload);
        break;
      case "action":
        this.handlePlayerAction(playerId, payload);
        break;
      case "leave":
        this.removePlayer(playerId);
        break;
    }
  }
  
  addPlayer(playerId: string, rinfo: any, data: any) {
    this.players.set(playerId, {
      address: rinfo.address,
      port: rinfo.port,
      lastSeen: Date.now()
    });
    
    this.gameState.players.set(playerId, {
      id: playerId,
      x: data.x || 0,
      y: data.y || 0,
      health: 100,
      score: 0
    });
    
    // Broadcast player joined
    this.broadcast({
      type: "player_joined",
      player: this.gameState.players.get(playerId)
    });
  }
  
  movePlayer(playerId: string, position: { x: number, y: number }) {
    const player = this.gameState.players.get(playerId);
    if (player) {
      player.x = position.x;
      player.y = position.y;
      
      // Update client info
      const clientInfo = this.players.get(playerId);
      if (clientInfo) {
        clientInfo.lastSeen = Date.now();
      }
    }
  }
  
  startGameLoop() {
    setInterval(() => {
      this.updateGameState();
      this.broadcastGameState();
    }, 1000 / 60); // 60 FPS
  }
  
  updateGameState() {
    this.gameState.timestamp = Date.now();
    // Update game logic here
  }
  
  broadcastGameState() {
    const stateUpdate = {
      type: "game_state",
      players: Array.from(this.gameState.players.values()),
      timestamp: this.gameState.timestamp
    };
    
    this.broadcast(stateUpdate);
  }
  
  broadcast(data: any) {
    const message = JSON.stringify(data);
    for (const client of this.players.values()) {
      this.socket.send(message, client.port, client.address);
    }
  }
}
```

### IoT Data Collection

```typescript
class UDPIoTCollector {
  private devices = new Map();
  private telemetryBuffer = [];
  
  constructor(private socket: any) {
    this.startDataProcessing();
  }
  
  handleSensorData(data: any, rinfo: any) {
    const { deviceId, sensorType, value, timestamp } = data;
    
    // Register/update device
    this.devices.set(deviceId, {
      address: rinfo.address,
      port: rinfo.port,
      lastSeen: Date.now(),
      sensorType
    });
    
    // Store telemetry data
    this.telemetryBuffer.push({
      deviceId,
      sensorType,
      value,
      timestamp: timestamp || Date.now(),
      receivedAt: Date.now()
    });
    
    // Send acknowledgment
    const ack = JSON.stringify({
      type: "ack",
      deviceId,
      timestamp: Date.now()
    });
    
    this.socket.send(ack, rinfo.port, rinfo.address);
  }
  
  startDataProcessing() {
    // Process telemetry data every second
    setInterval(() => {
      if (this.telemetryBuffer.length > 0) {
        this.processTelemetryBatch(this.telemetryBuffer.splice(0));
      }
    }, 1000);
    
    // Send status updates to devices every 30 seconds
    setInterval(() => {
      this.sendStatusUpdates();
    }, 30000);
  }
  
  async processTelemetryBatch(batch: any[]) {
    // Batch insert to database
    await insertTelemetryData(batch);
    
    // Check for alerts
    for (const data of batch) {
      if (this.shouldAlert(data)) {
        await this.sendAlert(data);
      }
    }
  }
  
  shouldAlert(data: any) {
    // Implement alerting logic based on sensor values
    if (data.sensorType === "temperature" && data.value > 80) {
      return true;
    }
    if (data.sensorType === "humidity" && data.value > 90) {
      return true;
    }
    return false;
  }
  
  sendStatusUpdates() {
    for (const [deviceId, device] of this.devices) {
      const status = {
        type: "status_update",
        serverTime: Date.now(),
        deviceCount: this.devices.size
      };
      
      this.socket.send(
        JSON.stringify(status),
        device.port,
        device.address
      );
    }
  }
}
```

## Performance Optimization

### Buffer Management

```typescript
class UDPBufferPool {
  private buffers: Buffer[] = [];
  private readonly bufferSize: number;
  
  constructor(bufferSize = 65536, poolSize = 100) {
    this.bufferSize = bufferSize;
    
    // Pre-allocate buffers
    for (let i = 0; i < poolSize; i++) {
      this.buffers.push(Buffer.allocUnsafe(bufferSize));
    }
  }
  
  getBuffer(): Buffer {
    return this.buffers.pop() || Buffer.allocUnsafe(this.bufferSize);
  }
  
  returnBuffer(buffer: Buffer) {
    if (buffer.length === this.bufferSize) {
      buffer.fill(0); // Clear buffer
      this.buffers.push(buffer);
    }
  }
}

const bufferPool = new UDPBufferPool();

app.withOptions({
  udp: {
    onMessage: (message, rinfo, socket) => {
      const buffer = bufferPool.getBuffer();
      
      try {
        // Process message using pooled buffer
        processMessage(message, buffer, rinfo, socket);
      } finally {
        bufferPool.returnBuffer(buffer);
      }
    }
  }
});
```

### Message Batching

```typescript
class UDPMessageBatcher {
  private batches = new Map<string, any[]>();
  private timers = new Map<string, NodeJS.Timeout>();
  
  constructor(
    private socket: any,
    private batchSize = 10,
    private batchTimeout = 100 // ms
  ) {}
  
  addMessage(clientKey: string, message: any, rinfo: any) {
    if (!this.batches.has(clientKey)) {
      this.batches.set(clientKey, []);
    }
    
    const batch = this.batches.get(clientKey)!;
    batch.push(message);
    
    // Send batch if it's full
    if (batch.length >= this.batchSize) {
      this.sendBatch(clientKey, rinfo);
    } else if (!this.timers.has(clientKey)) {
      // Set timeout for partial batch
      const timer = setTimeout(() => {
        this.sendBatch(clientKey, rinfo);
      }, this.batchTimeout);
      
      this.timers.set(clientKey, timer);
    }
  }
  
  sendBatch(clientKey: string, rinfo: any) {
    const batch = this.batches.get(clientKey);
    if (batch && batch.length > 0) {
      const batchMessage = JSON.stringify({
        type: "batch",
        messages: batch,
        count: batch.length
      });
      
      this.socket.send(batchMessage, rinfo.port, rinfo.address);
      
      // Clear batch and timer
      this.batches.delete(clientKey);
      const timer = this.timers.get(clientKey);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(clientKey);
      }
    }
  }
}
```

## Reliability Features

### Message Acknowledgment

```typescript
class UDPReliableTransport {
  private pendingMessages = new Map();
  private messageId = 0;
  
  constructor(private socket: any, private retryTimeout = 1000, private maxRetries = 3) {}
  
  sendReliable(message: any, port: number, address: string) {
    const id = ++this.messageId;
    const reliableMessage = {
      id,
      type: "reliable",
      data: message,
      timestamp: Date.now()
    };
    
    this.pendingMessages.set(id, {
      message: reliableMessage,
      port,
      address,
      retries: 0,
      timer: null
    });
    
    this.sendWithRetry(id);
  }
  
  sendWithRetry(messageId: number) {
    const pending = this.pendingMessages.get(messageId);
    if (!pending) return;
    
    if (pending.retries >= this.maxRetries) {
      console.error(`Message ${messageId} failed after ${this.maxRetries} retries`);
      this.pendingMessages.delete(messageId);
      return;
    }
    
    // Send message
    this.socket.send(
      JSON.stringify(pending.message),
      pending.port,
      pending.address
    );
    
    pending.retries++;
    
    // Set retry timer
    pending.timer = setTimeout(() => {
      this.sendWithRetry(messageId);
    }, this.retryTimeout * pending.retries); // Exponential backoff
  }
  
  handleAck(ackMessage: any) {
    const { messageId } = ackMessage;
    const pending = this.pendingMessages.get(messageId);
    
    if (pending) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      this.pendingMessages.delete(messageId);
    }
  }
  
  handleMessage(message: any, rinfo: any) {
    if (message.type === "reliable") {
      // Send acknowledgment
      const ack = {
        type: "ack",
        messageId: message.id
      };
      
      this.socket.send(
        JSON.stringify(ack),
        rinfo.port,
        rinfo.address
      );
      
      return message.data;
    } else if (message.type === "ack") {
      this.handleAck(message);
      return null;
    }
    
    return message;
  }
}
```

### Connection Keep-Alive

```typescript
class UDPKeepAlive {
  private clients = new Map();
  private keepAliveInterval: NodeJS.Timeout;
  
  constructor(
    private socket: any,
    private interval = 30000, // 30 seconds
    private timeout = 90000   // 90 seconds
  ) {
    this.startKeepAlive();
  }
  
  registerClient(address: string, port: number) {
    const key = `${address}:${port}`;
    this.clients.set(key, {
      address,
      port,
      lastSeen: Date.now(),
      lastPing: 0
    });
  }
  
  updateClientActivity(address: string, port: number) {
    const key = `${address}:${port}`;
    const client = this.clients.get(key);
    if (client) {
      client.lastSeen = Date.now();
    }
  }
  
  startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      this.sendPings();
      this.checkTimeouts();
    }, this.interval);
  }
  
  sendPings() {
    const now = Date.now();
    const pingMessage = JSON.stringify({
      type: "ping",
      timestamp: now
    });
    
    for (const client of this.clients.values()) {
      if (now - client.lastPing >= this.interval) {
        this.socket.send(pingMessage, client.port, client.address);
        client.lastPing = now;
      }
    }
  }
  
  checkTimeouts() {
    const now = Date.now();
    const timeoutClients = [];
    
    for (const [key, client] of this.clients) {
      if (now - client.lastSeen > this.timeout) {
        timeoutClients.push(key);
      }
    }
    
    // Remove timed out clients
    timeoutClients.forEach(key => {
      const client = this.clients.get(key);
      console.log(`Client ${key} timed out`);
      this.clients.delete(key);
    });
  }
  
  handlePong(rinfo: any) {
    this.updateClientActivity(rinfo.address, rinfo.port);
  }
  
  stop() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
  }
}
```

## Testing UDP Server

```typescript
import { test, expect } from "bun:test";
import { createUDPClient, createUDPServer } from "verb/testing";

test("UDP server echoes messages", async () => {
  const server = createUDPServer({
    port: 0, // Random port
    onMessage: (message, rinfo, socket) => {
      socket.send(`Echo: ${message}`, rinfo.port, rinfo.address);
    }
  });
  
  const client = createUDPClient();
  const serverAddress = server.address();
  
  const response = await client.send(
    "Hello UDP",
    serverAddress.port,
    "localhost"
  );
  
  expect(response.toString()).toBe("Echo: Hello UDP");
  
  client.close();
  server.close();
});

test("UDP server handles JSON messages", async () => {
  const server = createUDPServer({
    port: 0,
    onMessage: (message, rinfo, socket) => {
      const data = JSON.parse(message.toString());
      const response = JSON.stringify({
        received: data,
        timestamp: Date.now()
      });
      socket.send(response, rinfo.port, rinfo.address);
    }
  });
  
  const client = createUDPClient();
  const serverAddress = server.address();
  
  const testData = { type: "test", value: 42 };
  const response = await client.send(
    JSON.stringify(testData),
    serverAddress.port,
    "localhost"
  );
  
  const responseData = JSON.parse(response.toString());
  expect(responseData.received).toEqual(testData);
  expect(responseData.timestamp).toBeDefined();
  
  client.close();
  server.close();
});
```

## Best Practices

1. **Handle Packet Loss**: Implement reliability mechanisms when needed
2. **Validate Messages**: Always validate incoming UDP packets
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Buffer Management**: Use buffer pools for high-throughput scenarios
5. **Client Tracking**: Track client connections and implement timeouts
6. **Error Handling**: Handle network errors gracefully
7. **Security**: Validate and sanitize all incoming data
8. **Monitoring**: Monitor packet loss and latency

## See Also

- [TCP Server](/api/servers/tcp) - Connection-oriented protocol
- [WebSocket Server](/api/servers/websocket) - Real-time web communication
- [Performance Guide](/guide/performance) - UDP optimization
- [Networking Guide](/guide/networking) - Network programming concepts