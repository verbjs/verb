---
title: WebSockets
description: Learn how to implement WebSocket connections in Verb applications
---

# WebSockets in Verb

WebSockets provide a persistent connection between a client and server, allowing for real-time, bidirectional communication. Verb makes it easy to implement WebSocket functionality in your applications.

## Basic WebSocket Server

Verb provides a simple way to handle WebSocket connections:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

// Handle WebSocket connections
app.ws("/ws", {
  // Called when a client connects
  open(ws) {
    console.log("WebSocket connection opened");
    
    // Send a welcome message to the client
    ws.send(JSON.stringify({
      type: "welcome",
      message: "Welcome to the WebSocket server!"
    }));
  },
  
  // Called when a message is received from a client
  message(ws, message) {
    console.log("Received message:", message);
    
    try {
      // Parse the message as JSON
      const data = JSON.parse(message);
      
      // Echo the message back to the client
      ws.send(JSON.stringify({
        type: "echo",
        data
      }));
    } catch (error) {
      // Handle non-JSON messages
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON format"
      }));
    }
  },
  
  // Called when a client disconnects
  close(ws, code, reason) {
    console.log(`WebSocket connection closed: ${code} ${reason}`);
  },
  
  // Called when an error occurs
  error(ws, error) {
    console.error("WebSocket error:", error);
  }
});

app.listen(3000);
```

## Client-Side WebSocket Implementation

Here's a simple client-side implementation to connect to the WebSocket server:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Client</title>
  <style>
    #messages {
      height: 300px;
      overflow-y: auto;
      border: 1px solid #ccc;
      padding: 10px;
      margin-bottom: 10px;
    }
    .message {
      margin-bottom: 5px;
      padding: 5px;
      border-radius: 4px;
    }
    .sent {
      background-color: #e6f7ff;
      text-align: right;
    }
    .received {
      background-color: #f0f0f0;
    }
  </style>
</head>
<body>
  <h1>WebSocket Client</h1>
  <div id="status">Disconnected</div>
  <div id="messages"></div>
  <form id="messageForm">
    <input type="text" id="messageInput" placeholder="Type a message...">
    <button type="submit">Send</button>
  </form>
  <button id="connectButton">Connect</button>
  <button id="disconnectButton" disabled>Disconnect</button>

  <script>
    const statusDiv = document.getElementById('status');
    const messagesDiv = document.getElementById('messages');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const connectButton = document.getElementById('connectButton');
    const disconnectButton = document.getElementById('disconnectButton');
    
    let socket = null;
    
    // Function to add a message to the messages div
    function addMessage(message, isSent) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message');
      messageElement.classList.add(isSent ? 'sent' : 'received');
      messageElement.textContent = message;
      messagesDiv.appendChild(messageElement);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    // Function to connect to the WebSocket server
    function connect() {
      // Create a new WebSocket connection
      socket = new WebSocket(`ws://${window.location.host}/ws`);
      
      // Connection opened
      socket.addEventListener('open', (event) => {
        statusDiv.textContent = 'Connected';
        statusDiv.style.color = 'green';
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        addMessage('Connected to server', false);
      });
      
      // Listen for messages
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'welcome') {
            addMessage(data.message, false);
          } else if (data.type === 'echo') {
            addMessage(`Server: ${JSON.stringify(data.data)}`, false);
          } else if (data.type === 'error') {
            addMessage(`Error: ${data.message}`, false);
          } else {
            addMessage(`Received: ${event.data}`, false);
          }
        } catch (error) {
          addMessage(`Received: ${event.data}`, false);
        }
      });
      
      // Connection closed
      socket.addEventListener('close', (event) => {
        statusDiv.textContent = `Disconnected: ${event.code} ${event.reason}`;
        statusDiv.style.color = 'red';
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        addMessage(`Disconnected: ${event.code} ${event.reason}`, false);
      });
      
      // Connection error
      socket.addEventListener('error', (event) => {
        statusDiv.textContent = 'Error';
        statusDiv.style.color = 'red';
        addMessage('Connection error', false);
      });
    }
    
    // Function to disconnect from the WebSocket server
    function disconnect() {
      if (socket) {
        socket.close();
        socket = null;
      }
    }
    
    // Connect button click handler
    connectButton.addEventListener('click', connect);
    
    // Disconnect button click handler
    disconnectButton.addEventListener('click', disconnect);
    
    // Form submit handler
    messageForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const message = messageInput.value.trim();
      
      if (message && socket && socket.readyState === WebSocket.OPEN) {
        // Send the message as JSON
        socket.send(JSON.stringify({
          type: 'message',
          text: message
        }));
        
        addMessage(`You: ${message}`, true);
        messageInput.value = '';
      }
    });
  </script>
</body>
</html>
```

## Broadcasting Messages

You can broadcast messages to all connected clients:

```typescript
import { createServer } from "@verb/server";
import { WebSocket } from "@verb/server";

const app = createServer();

// Store all connected clients
const clients = new Set<WebSocket>();

app.ws("/ws", {
  open(ws) {
    // Add the client to the set
    clients.add(ws);
    
    // Send a welcome message to the client
    ws.send(JSON.stringify({
      type: "welcome",
      message: "Welcome to the chat!",
      userCount: clients.size
    }));
    
    // Broadcast a user joined message to all other clients
    broadcast(ws, {
      type: "system",
      message: "A user has joined the chat",
      userCount: clients.size
    });
  },
  
  message(ws, message) {
    try {
      // Parse the message as JSON
      const data = JSON.parse(message);
      
      // Broadcast the message to all clients
      broadcast(ws, {
        type: "message",
        sender: data.username || "Anonymous",
        text: data.text,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Handle non-JSON messages
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON format"
      }));
    }
  },
  
  close(ws) {
    // Remove the client from the set
    clients.delete(ws);
    
    // Broadcast a user left message to all other clients
    broadcast(ws, {
      type: "system",
      message: "A user has left the chat",
      userCount: clients.size
    });
  }
});

// Function to broadcast a message to all clients except the sender
function broadcast(sender: WebSocket, message: any) {
  const messageStr = JSON.stringify(message);
  
  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

app.listen(3000);
```

## WebSocket Rooms

You can implement rooms to group WebSocket connections:

```typescript
import { createServer } from "@verb/server";
import { WebSocket } from "@verb/server";

const app = createServer();

// Store rooms and their clients
const rooms = new Map<string, Set<WebSocket>>();

app.ws("/ws/:room", {
  open(ws, req) {
    // Get the room name from the URL parameters
    const roomName = req.params.room;
    
    // Create the room if it doesn't exist
    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Set());
    }
    
    // Add the client to the room
    const room = rooms.get(roomName)!;
    room.add(ws);
    
    // Store the room name on the WebSocket instance for easy access
    (ws as any).roomName = roomName;
    
    // Send a welcome message to the client
    ws.send(JSON.stringify({
      type: "welcome",
      room: roomName,
      userCount: room.size
    }));
    
    // Broadcast a user joined message to all other clients in the room
    broadcastToRoom(roomName, ws, {
      type: "system",
      message: "A user has joined the room",
      userCount: room.size
    });
  },
  
  message(ws, message) {
    try {
      // Parse the message as JSON
      const data = JSON.parse(message);
      const roomName = (ws as any).roomName;
      
      // Broadcast the message to all clients in the room
      broadcastToRoom(roomName, ws, {
        type: "message",
        sender: data.username || "Anonymous",
        text: data.text,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Handle non-JSON messages
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON format"
      }));
    }
  },
  
  close(ws) {
    const roomName = (ws as any).roomName;
    
    if (roomName && rooms.has(roomName)) {
      const room = rooms.get(roomName)!;
      
      // Remove the client from the room
      room.delete(ws);
      
      // Broadcast a user left message to all other clients in the room
      broadcastToRoom(roomName, ws, {
        type: "system",
        message: "A user has left the room",
        userCount: room.size
      });
      
      // Remove the room if it's empty
      if (room.size === 0) {
        rooms.delete(roomName);
      }
    }
  }
});

// Function to broadcast a message to all clients in a room except the sender
function broadcastToRoom(roomName: string, sender: WebSocket, message: any) {
  if (!rooms.has(roomName)) return;
  
  const room = rooms.get(roomName)!;
  const messageStr = JSON.stringify(message);
  
  for (const client of room) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

app.listen(3000);
```

## WebSocket Authentication

You can implement authentication for WebSocket connections:

```typescript
import { createServer } from "@verb/server";
import { WebSocket } from "@verb/server";
import jwt from "jsonwebtoken";

const app = createServer();

// Store authenticated clients
const clients = new Map<string, WebSocket>();

// Middleware to authenticate WebSocket connections
const authenticateWs = (req: Request, next: () => Response | Promise<Response>) => {
  // Get the token from the query parameters
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, "your-secret-key");
    
    // Store the user data on the request object
    (req as any).user = decoded;
    
    return next();
  } catch (error) {
    return new Response("Unauthorized", { status: 401 });
  }
};

// Login route to get a token
app.post("/login", async (req) => {
  const body = await req.json();
  
  // Validate credentials (in a real app, you would check against a database)
  if (body.username === "admin" && body.password === "password") {
    // Generate a token
    const token = jwt.sign(
      { id: 1, username: "admin" },
      "your-secret-key",
      { expiresIn: "1h" }
    );
    
    return new Response(JSON.stringify({ token }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ error: "Invalid credentials" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
});

// WebSocket endpoint with authentication
app.ws("/ws", {
  middleware: [authenticateWs],
  
  open(ws, req) {
    const user = (req as any).user;
    
    // Store the user data on the WebSocket instance
    (ws as any).user = user;
    
    // Add the client to the map
    clients.set(user.id.toString(), ws);
    
    // Send a welcome message to the client
    ws.send(JSON.stringify({
      type: "welcome",
      message: `Welcome, ${user.username}!`,
      user: user
    }));
  },
  
  message(ws, message) {
    const user = (ws as any).user;
    
    try {
      // Parse the message as JSON
      const data = JSON.parse(message);
      
      // Handle direct messages
      if (data.type === "direct" && data.to) {
        const recipient = clients.get(data.to.toString());
        
        if (recipient && recipient.readyState === WebSocket.OPEN) {
          recipient.send(JSON.stringify({
            type: "direct",
            from: user.id,
            fromUsername: user.username,
            text: data.text,
            timestamp: new Date().toISOString()
          }));
          
          // Send a confirmation to the sender
          ws.send(JSON.stringify({
            type: "sent",
            to: data.to,
            text: data.text,
            timestamp: new Date().toISOString()
          }));
        } else {
          // Recipient not found or not connected
          ws.send(JSON.stringify({
            type: "error",
            message: "Recipient not found or not connected"
          }));
        }
      } else {
        // Broadcast to all clients
        broadcast(ws, {
          type: "message",
          from: user.id,
          fromUsername: user.username,
          text: data.text,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      // Handle non-JSON messages
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON format"
      }));
    }
  },
  
  close(ws) {
    const user = (ws as any).user;
    
    if (user) {
      // Remove the client from the map
      clients.delete(user.id.toString());
    }
  }
});

// Function to broadcast a message to all authenticated clients except the sender
function broadcast(sender: WebSocket, message: any) {
  const messageStr = JSON.stringify(message);
  
  for (const client of clients.values()) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

app.listen(3000);
```

Client-side code for authenticated WebSockets:

```javascript
// Get the token from localStorage or another source
const token = localStorage.getItem('token');

// Connect to the WebSocket server with the token
const socket = new WebSocket(`ws://${window.location.host}/ws?token=${token}`);

// Connection opened
socket.addEventListener('open', (event) => {
  console.log('Connected to server');
});

// Listen for messages
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
});

// Send a message
function sendMessage(text) {
  socket.send(JSON.stringify({
    type: 'message',
    text: text
  }));
}

// Send a direct message
function sendDirectMessage(to, text) {
  socket.send(JSON.stringify({
    type: 'direct',
    to: to,
    text: text
  }));
}
```

## WebSocket Heartbeat

To keep connections alive and detect disconnections, you can implement a heartbeat mechanism:

```typescript
import { createServer } from "@verb/server";
import { WebSocket } from "@verb/server";

const app = createServer();

// Store clients with their last activity timestamp
const clients = new Map<WebSocket, { lastPing: number }>();

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Timeout for inactive clients (90 seconds)
const CLIENT_TIMEOUT = 90000;

app.ws("/ws", {
  open(ws) {
    // Add the client to the map with the current timestamp
    clients.set(ws, { lastPing: Date.now() });
    
    // Send a welcome message
    ws.send(JSON.stringify({
      type: "welcome",
      message: "Welcome to the WebSocket server!"
    }));
    
    // Set up a ping interval for this client
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      } else {
        clearInterval(pingInterval);
      }
    }, HEARTBEAT_INTERVAL);
    
    // Store the interval ID on the WebSocket instance for cleanup
    (ws as any).pingInterval = pingInterval;
  },
  
  message(ws, message) {
    try {
      const data = JSON.parse(message);
      
      // Update the last ping timestamp on pong messages
      if (data.type === "pong") {
        const client = clients.get(ws);
        if (client) {
          client.lastPing = Date.now();
        }
        return;
      }
      
      // Handle other message types
      // ...
      
    } catch (error) {
      // Handle non-JSON messages
      // ...
    }
  },
  
  close(ws) {
    // Remove the client from the map
    clients.delete(ws);
    
    // Clear the ping interval
    clearInterval((ws as any).pingInterval);
  }
});

// Check for inactive clients every minute
setInterval(() => {
  const now = Date.now();
  
  for (const [ws, client] of clients.entries()) {
    // Check if the client has been inactive for too long
    if (now - client.lastPing > CLIENT_TIMEOUT) {
      console.log("Closing inactive WebSocket connection");
      ws.close(1000, "Connection timeout due to inactivity");
      clients.delete(ws);
    }
  }
}, 60000);

app.listen(3000);
```

Client-side heartbeat implementation:

```javascript
const socket = new WebSocket(`ws://${window.location.host}/ws`);

// Connection opened
socket.addEventListener('open', (event) => {
  console.log('Connected to server');
});

// Listen for messages
socket.addEventListener('message', (event) => {
  try {
    const data = JSON.parse(event.data);
    
    // Respond to ping messages with a pong
    if (data.type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    
    // Handle other message types
    console.log('Received:', data);
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

// Reconnect on close
socket.addEventListener('close', (event) => {
  console.log(`Connection closed: ${event.code} ${event.reason}`);
  
  // Reconnect after a delay
  setTimeout(() => {
    console.log('Reconnecting...');
    // Recreate the WebSocket connection
    // ...
  }, 5000);
});
```

## Best Practices

- **Implement Authentication**: Secure your WebSocket connections with authentication
- **Use Heartbeats**: Implement heartbeats to detect disconnections
- **Handle Reconnections**: Implement client-side reconnection logic
- **Validate Messages**: Always validate incoming messages
- **Limit Message Size**: Set a maximum message size to prevent abuse
- **Implement Rate Limiting**: Limit the number of messages a client can send
- **Use Secure WebSockets**: Use WSS (WebSocket Secure) in production
- **Handle Errors**: Properly handle errors in your WebSocket handlers
- **Clean Up Resources**: Make sure to clean up resources when connections close
- **Monitor Connections**: Monitor the number of active connections

## Next Steps

- [Streaming](/server/streaming) - Learn about streaming responses in Verb
- [Security](/server/security) - Learn about security best practices in Verb
- [Middleware](/server/middleware) - Explore middleware in Verb