# UDP (User Datagram Protocol)

Verb supports UDP for fast, connectionless communication ideal for real-time applications where speed matters more than reliability.

## Overview

UDP characteristics:
- **Connectionless**: No connection establishment required
- **Fast**: Minimal overhead for maximum speed
- **Unreliable**: No guaranteed delivery or ordering
- **Low Latency**: Ideal for real-time applications

## Creating a UDP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.UDP);

app.onMessage((message, remoteInfo) => {
  console.log(`Received: ${message} from ${remoteInfo.address}:${remoteInfo.port}`);
  
  // Echo the message back
  app.send(message, remoteInfo.port, remoteInfo.address);
});

app.listen(3000);
console.log("UDP server listening on port 3000");
```

## Message Handling

Handle different types of UDP messages:

```typescript
app.onMessage((message, remoteInfo) => {
  try {
    const data = JSON.parse(message.toString());
    
    switch (data.type) {
      case "ping":
        app.send(JSON.stringify({ type: "pong", timestamp: Date.now() }), 
                remoteInfo.port, remoteInfo.address);
        break;
        
      case "game_update":
        handleGameUpdate(data, remoteInfo);
        break;
        
      case "chat_message":
        broadcastChatMessage(data, remoteInfo);
        break;
        
      default:
        console.log("Unknown message type:", data.type);
    }
  } catch (error) {
    console.error("Invalid JSON message:", message.toString());
  }
});
```

## Client Management

Track connected clients:

```typescript
const clients = new Map();

app.onMessage((message, remoteInfo) => {
  const clientId = `${remoteInfo.address}:${remoteInfo.port}`;
  
  // Update client info
  clients.set(clientId, {
    address: remoteInfo.address,
    port: remoteInfo.port,
    lastSeen: Date.now()
  });
  
  // Handle message
  handleMessage(message, clientId);
});

// Clean up inactive clients
setInterval(() => {
  const now = Date.now();
  const timeout = 30000; // 30 seconds
  
  for (const [clientId, client] of clients) {
    if (now - client.lastSeen > timeout) {
      console.log(`Client ${clientId} timed out`);
      clients.delete(clientId);
    }
  }
}, 10000);
```

## Broadcasting

Send messages to multiple clients:

```typescript
function broadcast(message, excludeClient = null) {
  const data = Buffer.from(JSON.stringify(message));
  
  for (const [clientId, client] of clients) {
    if (clientId !== excludeClient) {
      app.send(data, client.port, client.address);
    }
  }
}

app.onMessage((message, remoteInfo) => {
  const data = JSON.parse(message.toString());
  const clientId = `${remoteInfo.address}:${remoteInfo.port}`;
  
  if (data.type === "chat") {
    broadcast({
      type: "chat",
      from: clientId,
      message: data.message,
      timestamp: Date.now()
    }, clientId);
  }
});
```

## Game Server Example

Real-time game server with UDP:

```typescript
const gameState = {
  players: new Map(),
  bullets: [],
  gameId: "game_" + Date.now()
};

app.onMessage((message, remoteInfo) => {
  const data = JSON.parse(message.toString());
  const playerId = `${remoteInfo.address}:${remoteInfo.port}`;
  
  switch (data.type) {
    case "join":
      gameState.players.set(playerId, {
        id: playerId,
        name: data.name,
        x: Math.random() * 800,
        y: Math.random() * 600,
        health: 100,
        address: remoteInfo.address,
        port: remoteInfo.port
      });
      
      // Send current game state to new player
      app.send(JSON.stringify({
        type: "game_state",
        players: Array.from(gameState.players.values()),
        bullets: gameState.bullets
      }), remoteInfo.port, remoteInfo.address);
      break;
      
    case "move":
      const player = gameState.players.get(playerId);
      if (player) {
        player.x = data.x;
        player.y = data.y;
        
        // Broadcast player movement
        broadcastGameUpdate();
      }
      break;
      
    case "shoot":
      gameState.bullets.push({
        id: Date.now(),
        x: data.x,
        y: data.y,
        dx: data.dx,
        dy: data.dy,
        playerId
      });
      break;
  }
});

function broadcastGameUpdate() {
  const update = JSON.stringify({
    type: "game_update",
    players: Array.from(gameState.players.values()),
    bullets: gameState.bullets,
    timestamp: Date.now()
  });
  
  for (const player of gameState.players.values()) {
    app.send(update, player.port, player.address);
  }
}

// Game loop
setInterval(() => {
  // Update bullets
  gameState.bullets = gameState.bullets.filter(bullet => {
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;
    
    // Remove bullets that are off-screen
    return bullet.x >= 0 && bullet.x <= 800 && bullet.y >= 0 && bullet.y <= 600;
  });
  
  broadcastGameUpdate();
}, 16); // ~60 FPS
```

## UDP Client

Creating a UDP client:

```typescript
import { UDPSocket } from "verb/udp";

const client = new UDPSocket();

client.on("message", (message, remoteInfo) => {
  const data = JSON.parse(message.toString());
  console.log("Received:", data);
});

// Connect to server
client.bind(() => {
  client.send(JSON.stringify({ type: "ping" }), 3000, "localhost");
});

// Send periodic updates
setInterval(() => {
  client.send(JSON.stringify({
    type: "heartbeat",
    timestamp: Date.now()
  }), 3000, "localhost");
}, 5000);
```

## Error Handling

Handle UDP-specific errors:

```typescript
app.onError((error) => {
  console.error("UDP Error:", error);
  
  switch (error.code) {
    case "EADDRINUSE":
      console.error("Port is already in use");
      break;
    case "EACCES":
      console.error("Permission denied");
      break;
    case "EADDRNOTAVAIL":
      console.error("Address not available");
      break;
    default:
      console.error("Unknown UDP error:", error.message);
  }
});

app.onMessage((message, remoteInfo) => {
  try {
    // Handle message
    handleMessage(message, remoteInfo);
  } catch (error) {
    console.error("Error handling message:", error);
    
    // Send error response
    app.send(JSON.stringify({
      type: "error",
      message: "Invalid message format"
    }), remoteInfo.port, remoteInfo.address);
  }
});
```

## Reliability Features

Add reliability to UDP when needed:

```typescript
class ReliableUDP {
  constructor(socket) {
    this.socket = socket;
    this.pendingMessages = new Map();
    this.sequenceNumber = 0;
  }
  
  sendReliable(message, port, address) {
    const id = ++this.sequenceNumber;
    const packet = {
      id,
      type: "reliable",
      data: message,
      timestamp: Date.now()
    };
    
    this.pendingMessages.set(id, { packet, port, address, retries: 0 });
    this.socket.send(JSON.stringify(packet), port, address);
    
    // Set timeout for retransmission
    setTimeout(() => this.checkRetransmission(id), 1000);
  }
  
  handleAck(ackId) {
    this.pendingMessages.delete(ackId);
  }
  
  checkRetransmission(messageId) {
    const pending = this.pendingMessages.get(messageId);
    if (pending && pending.retries < 3) {
      pending.retries++;
      this.socket.send(JSON.stringify(pending.packet), pending.port, pending.address);
      setTimeout(() => this.checkRetransmission(messageId), 1000 * pending.retries);
    } else {
      // Give up after 3 retries
      this.pendingMessages.delete(messageId);
    }
  }
}

const reliableUDP = new ReliableUDP(app);

app.onMessage((message, remoteInfo) => {
  const data = JSON.parse(message.toString());
  
  if (data.type === "reliable") {
    // Send acknowledgment
    app.send(JSON.stringify({
      type: "ack",
      id: data.id
    }), remoteInfo.port, remoteInfo.address);
    
    // Handle the actual message
    handleMessage(data.data, remoteInfo);
  } else if (data.type === "ack") {
    reliableUDP.handleAck(data.id);
  }
});
```

## Performance Optimization

Optimize UDP performance:

```typescript
// Configure socket options
app.withOptions({
  port: 3000,
  udp: {
    reuseAddress: true,
    sendBufferSize: 65536,
    receiveBufferSize: 65536,
    multicast: {
      enabled: true,
      address: "224.0.0.1",
      ttl: 1
    }
  }
});

// Batch messages
const messageQueue = [];
let batchTimeout;

function queueMessage(message, port, address) {
  messageQueue.push({ message, port, address });
  
  if (!batchTimeout) {
    batchTimeout = setTimeout(flushMessages, 10); // 10ms batching
  }
}

function flushMessages() {
  const batch = messageQueue.splice(0);
  batchTimeout = null;
  
  for (const { message, port, address } of batch) {
    app.send(message, port, address);
  }
}
```

## Use Cases

UDP is ideal for:
- **Gaming**: Real-time multiplayer games
- **Streaming**: Video/audio streaming
- **IoT**: Sensor data collection
- **DNS**: Domain name resolution
- **DHCP**: Network configuration

## Best Practices

1. **Handle Packet Loss**: Implement retransmission if needed
2. **Limit Message Size**: Keep under 1500 bytes (MTU)
3. **Use Heartbeats**: Track client connectivity
4. **Validate Messages**: Check message format and content
5. **Monitor Performance**: Track packet loss and latency

## Next Steps

- [TCP](/guide/protocols/tcp) - Reliable connection-oriented protocol
- [Performance](/guide/performance) - Optimization techniques
- [Testing](/guide/testing) - Testing strategies