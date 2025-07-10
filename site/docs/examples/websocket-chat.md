# WebSocket Chat Example

Complete real-time chat application built with Verb's WebSocket server, featuring multiple rooms, user management, message history, and typing indicators.

## Overview

This example demonstrates building a full-featured chat application with:

- Real-time messaging with WebSocket
- Multiple chat rooms
- User authentication and presence
- Message history and persistence
- Typing indicators
- File sharing
- Private messaging
- Admin moderation features

## Project Setup

```bash
# Create new project
mkdir chat-app
cd chat-app
bun init -y

# Install dependencies
bun install verb
bun install -D @types/bun typescript

# Install additional packages
bun install jsonwebtoken bcryptjs zod
```

## Server Setup

```typescript
// server.ts
import { createServer } from "verb";
import { cors, json, staticFiles } from "verb/middleware";
import { ChatServer } from "./src/ChatServer";
import { authRouter } from "./src/routes/auth";
import { chatRouter } from "./src/routes/chat";

const app = createServer();

// Initialize chat server
const chatServer = new ChatServer();

// Middleware
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true
}));
app.use(json());
app.use(staticFiles({ root: "./public" }));

// HTTP routes
app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);

// Serve main chat page
app.get("/", (req, res) => {
  res.sendFile("./public/index.html");
});

// WebSocket configuration
app.withOptions({
  port: 3000,
  websocket: {
    message: (ws, message) => chatServer.handleMessage(ws, message),
    open: (ws) => chatServer.handleConnection(ws),
    close: (ws, code, reason) => chatServer.handleDisconnection(ws, code, reason),
    drain: (ws) => console.log("WebSocket buffer drained"),
    ping: (ws, data) => ws.pong(data),
    
    // Performance settings
    maxCompressedSize: 64 * 1024 * 1024,
    maxBackpressure: 64 * 1024 * 1024,
    compression: "shared"
  }
});

app.listen(3000);
console.log("🚀 Chat server running on http://localhost:3000");
```

## Chat Server Implementation

```typescript
// src/ChatServer.ts
import { Database } from "bun:sqlite";
import { verify } from "jsonwebtoken";
import { ChatRoom } from "./ChatRoom";
import { User, Message, ChatEvent } from "./types";

export class ChatServer {
  private clients = new Map<WebSocket, User>();
  private rooms = new Map<string, ChatRoom>();
  private db: Database;
  
  constructor() {
    this.db = new Database("chat.db");
    this.initializeDatabase();
    this.createDefaultRooms();
  }
  
  private initializeDatabase() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT FALSE,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        reply_to TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        edited_at DATETIME,
        FOREIGN KEY (room_id) REFERENCES rooms (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (reply_to) REFERENCES messages (id)
      );
      
      CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT,
        user_id TEXT,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);
  }
  
  private createDefaultRooms() {
    const defaultRooms = [
      { id: "general", name: "General", description: "General discussion" },
      { id: "random", name: "Random", description: "Random topics" },
      { id: "tech", name: "Tech Talk", description: "Technology discussions" }
    ];
    
    for (const room of defaultRooms) {
      this.db.query(`
        INSERT OR IGNORE INTO rooms (id, name, description, is_private)
        VALUES (?, ?, ?, ?)
      `).run(room.id, room.name, room.description, false);
      
      if (!this.rooms.has(room.id)) {
        this.rooms.set(room.id, new ChatRoom(room.id, room.name, this.db));
      }
    }
  }
  
  async handleConnection(ws: WebSocket) {
    console.log("New WebSocket connection");
    
    // Send welcome message
    this.sendToClient(ws, {
      type: "connection_established",
      data: {
        message: "Connected to chat server",
        timestamp: new Date().toISOString()
      }
    });
  }
  
  async handleMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case "authenticate":
          await this.handleAuthentication(ws, data);
          break;
          
        case "join_room":
          await this.handleJoinRoom(ws, data);
          break;
          
        case "leave_room":
          await this.handleLeaveRoom(ws, data);
          break;
          
        case "send_message":
          await this.handleSendMessage(ws, data);
          break;
          
        case "typing_start":
          await this.handleTypingStart(ws, data);
          break;
          
        case "typing_stop":
          await this.handleTypingStop(ws, data);
          break;
          
        case "private_message":
          await this.handlePrivateMessage(ws, data);
          break;
          
        case "get_room_history":
          await this.handleGetRoomHistory(ws, data);
          break;
          
        case "edit_message":
          await this.handleEditMessage(ws, data);
          break;
          
        case "delete_message":
          await this.handleDeleteMessage(ws, data);
          break;
          
        default:
          this.sendError(ws, "Unknown message type", data.type);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      this.sendError(ws, "Invalid message format");
    }
  }
  
  async handleAuthentication(ws: WebSocket, data: any) {
    try {
      const { token } = data;
      
      if (!token) {
        return this.sendError(ws, "Authentication token required");
      }
      
      const decoded = verify(token, process.env.JWT_SECRET!) as any;
      const user = this.db.query(`
        SELECT id, username, email, avatar_url, role 
        FROM users 
        WHERE id = ?
      `).get(decoded.userId) as User;
      
      if (!user) {
        return this.sendError(ws, "User not found");
      }
      
      // Update last seen
      this.db.query(`
        UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?
      `).run(user.id);
      
      // Store user connection
      this.clients.set(ws, user);
      
      // Send authentication success
      this.sendToClient(ws, {
        type: "authenticated",
        data: {
          user: {
            id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            role: user.role
          },
          rooms: this.getAvailableRooms(user.id)
        }
      });
      
      // Broadcast user online status
      this.broadcastUserStatus(user, "online");
      
      console.log(`User ${user.username} authenticated`);
    } catch (error) {
      this.sendError(ws, "Invalid authentication token");
    }
  }
  
  async handleJoinRoom(ws: WebSocket, data: any) {
    const user = this.clients.get(ws);
    if (!user) {
      return this.sendError(ws, "Authentication required");
    }
    
    const { roomId } = data;
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return this.sendError(ws, "Room not found");
    }
    
    // Check if user can join room
    if (!await this.canUserJoinRoom(user.id, roomId)) {
      return this.sendError(ws, "Access denied to room");
    }
    
    // Add user to room
    room.addUser(ws, user);
    
    // Add to database
    this.db.query(`
      INSERT OR REPLACE INTO room_members (room_id, user_id, joined_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(roomId, user.id);
    
    // Send join confirmation
    this.sendToClient(ws, {
      type: "room_joined",
      data: {
        roomId,
        roomName: room.name,
        members: room.getMembers()
      }
    });
    
    // Broadcast to room that user joined
    room.broadcast({
      type: "user_joined",
      data: {
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url
        },
        roomId,
        timestamp: new Date().toISOString()
      }
    }, ws);
    
    console.log(`User ${user.username} joined room ${roomId}`);
  }
  
  async handleSendMessage(ws: WebSocket, data: any) {
    const user = this.clients.get(ws);
    if (!user) {
      return this.sendError(ws, "Authentication required");
    }
    
    const { roomId, content, messageType = "text", replyTo } = data;
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return this.sendError(ws, "Room not found");
    }
    
    if (!room.hasUser(ws)) {
      return this.sendError(ws, "You are not a member of this room");
    }
    
    // Validate message content
    if (!content || content.trim().length === 0) {
      return this.sendError(ws, "Message content cannot be empty");
    }
    
    if (content.length > 2000) {
      return this.sendError(ws, "Message too long (max 2000 characters)");
    }
    
    // Create message
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    // Save to database
    this.db.query(`
      INSERT INTO messages (id, room_id, user_id, content, message_type, reply_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(messageId, roomId, user.id, content, messageType, replyTo, timestamp);
    
    const message: Message = {
      id: messageId,
      roomId,
      userId: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      content,
      messageType,
      replyTo,
      timestamp,
      edited: false
    };
    
    // Broadcast message to room
    room.broadcast({
      type: "new_message",
      data: { message }
    });
    
    console.log(`Message sent in room ${roomId} by ${user.username}`);
  }
  
  async handleTypingStart(ws: WebSocket, data: any) {
    const user = this.clients.get(ws);
    if (!user) return;
    
    const { roomId } = data;
    const room = this.rooms.get(roomId);
    
    if (room && room.hasUser(ws)) {
      room.broadcast({
        type: "user_typing",
        data: {
          userId: user.id,
          username: user.username,
          roomId,
          typing: true
        }
      }, ws);
    }
  }
  
  async handleTypingStop(ws: WebSocket, data: any) {
    const user = this.clients.get(ws);
    if (!user) return;
    
    const { roomId } = data;
    const room = this.rooms.get(roomId);
    
    if (room && room.hasUser(ws)) {
      room.broadcast({
        type: "user_typing",
        data: {
          userId: user.id,
          username: user.username,
          roomId,
          typing: false
        }
      }, ws);
    }
  }
  
  async handlePrivateMessage(ws: WebSocket, data: any) {
    const sender = this.clients.get(ws);
    if (!sender) {
      return this.sendError(ws, "Authentication required");
    }
    
    const { targetUserId, content } = data;
    
    // Find target user's websocket
    let targetWs: WebSocket | null = null;
    for (const [socket, user] of this.clients) {
      if (user.id === targetUserId) {
        targetWs = socket;
        break;
      }
    }
    
    if (!targetWs) {
      return this.sendError(ws, "Target user not online");
    }
    
    const message = {
      type: "private_message",
      data: {
        from: {
          id: sender.id,
          username: sender.username,
          avatar_url: sender.avatar_url
        },
        content,
        timestamp: new Date().toISOString()
      }
    };
    
    // Send to target user
    this.sendToClient(targetWs, message);
    
    // Send confirmation to sender
    this.sendToClient(ws, {
      type: "private_message_sent",
      data: {
        targetUserId,
        content,
        timestamp: message.data.timestamp
      }
    });
  }
  
  async handleGetRoomHistory(ws: WebSocket, data: any) {
    const user = this.clients.get(ws);
    if (!user) {
      return this.sendError(ws, "Authentication required");
    }
    
    const { roomId, limit = 50, before } = data;
    
    let query = `
      SELECT m.*, u.username, u.avatar_url
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
    `;
    
    const params = [roomId];
    
    if (before) {
      query += ` AND m.created_at < ?`;
      params.push(before);
    }
    
    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);
    
    const messages = this.db.query(query).all(...params);
    
    this.sendToClient(ws, {
      type: "room_history",
      data: {
        roomId,
        messages: messages.reverse().map(msg => ({
          id: msg.id,
          roomId: msg.room_id,
          userId: msg.user_id,
          username: msg.username,
          avatar_url: msg.avatar_url,
          content: msg.content,
          messageType: msg.message_type,
          replyTo: msg.reply_to,
          timestamp: msg.created_at,
          edited: !!msg.edited_at
        }))
      }
    });
  }
  
  handleDisconnection(ws: WebSocket, code: number, reason: string) {
    const user = this.clients.get(ws);
    if (user) {
      console.log(`User ${user.username} disconnected`);
      
      // Remove from all rooms
      for (const room of this.rooms.values()) {
        if (room.hasUser(ws)) {
          room.removeUser(ws);
          
          // Broadcast user left
          room.broadcast({
            type: "user_left",
            data: {
              user: {
                id: user.id,
                username: user.username
              },
              timestamp: new Date().toISOString()
            }
          });
        }
      }
      
      // Broadcast user offline status
      this.broadcastUserStatus(user, "offline");
      
      // Remove from clients
      this.clients.delete(ws);
      
      // Update last seen in database
      this.db.query(`
        UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?
      `).run(user.id);
    }
  }
  
  private sendToClient(ws: WebSocket, message: ChatEvent) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
  
  private sendError(ws: WebSocket, message: string, code?: string) {
    this.sendToClient(ws, {
      type: "error",
      data: { message, code }
    });
  }
  
  private broadcastUserStatus(user: User, status: "online" | "offline") {
    const statusMessage = {
      type: "user_status",
      data: {
        userId: user.id,
        username: user.username,
        status,
        timestamp: new Date().toISOString()
      }
    };
    
    // Broadcast to all connected clients
    for (const [ws, client] of this.clients) {
      if (client.id !== user.id) {
        this.sendToClient(ws, statusMessage);
      }
    }
  }
  
  private getAvailableRooms(userId: string) {
    const rooms = this.db.query(`
      SELECT r.id, r.name, r.description, r.is_private,
             (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count
      FROM rooms r
      LEFT JOIN room_members rm ON r.id = rm.room_id AND rm.user_id = ?
      WHERE r.is_private = FALSE OR rm.user_id IS NOT NULL
      ORDER BY r.name
    `).all(userId);
    
    return rooms;
  }
  
  private async canUserJoinRoom(userId: string, roomId: string): Promise<boolean> {
    const room = this.db.query(`
      SELECT is_private FROM rooms WHERE id = ?
    `).get(roomId) as any;
    
    if (!room) return false;
    
    // Public rooms can be joined by anyone
    if (!room.is_private) return true;
    
    // Private rooms require membership
    const membership = this.db.query(`
      SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ?
    `).get(roomId, userId);
    
    return !!membership;
  }
}
```

## Chat Room Management

```typescript
// src/ChatRoom.ts
import { Database } from "bun:sqlite";
import { User, ChatEvent } from "./types";

export class ChatRoom {
  private users = new Map<WebSocket, User>();
  private typingUsers = new Set<string>();
  
  constructor(
    public id: string,
    public name: string,
    private db: Database
  ) {}
  
  addUser(ws: WebSocket, user: User) {
    this.users.set(ws, user);
  }
  
  removeUser(ws: WebSocket) {
    const user = this.users.get(ws);
    if (user) {
      this.users.delete(ws);
      this.typingUsers.delete(user.id);
    }
  }
  
  hasUser(ws: WebSocket): boolean {
    return this.users.has(ws);
  }
  
  getMembers() {
    return Array.from(this.users.values()).map(user => ({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      role: user.role
    }));
  }
  
  broadcast(message: ChatEvent, excludeWs?: WebSocket) {
    for (const [ws, user] of this.users) {
      if (ws !== excludeWs && ws.readyState === 1) {
        ws.send(JSON.stringify(message));
      }
    }
  }
  
  getUserCount(): number {
    return this.users.size;
  }
  
  getUser(ws: WebSocket): User | undefined {
    return this.users.get(ws);
  }
}
```

## Type Definitions

```typescript
// src/types.ts
export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  role: "user" | "moderator" | "admin";
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatar_url?: string;
  content: string;
  messageType: "text" | "image" | "file" | "system";
  replyTo?: string;
  timestamp: string;
  edited: boolean;
}

export interface ChatEvent {
  type: string;
  data: any;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  memberCount: number;
}
```

## Frontend HTML Client

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verb Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            height: 100vh;
            display: flex;
            background: #f5f5f5;
        }
        
        .sidebar {
            width: 250px;
            background: #2c3e50;
            color: white;
            padding: 20px;
            overflow-y: auto;
        }
        
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
        }
        
        .chat-header {
            padding: 20px;
            border-bottom: 1px solid #eee;
            background: white;
        }
        
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .message {
            display: flex;
            gap: 10px;
            padding: 10px;
            border-radius: 8px;
            background: #f8f9fa;
        }
        
        .message.own {
            background: #007bff;
            color: white;
            margin-left: auto;
            max-width: 70%;
        }
        
        .message-input {
            padding: 20px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
        }
        
        .message-input input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .message-input button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .room {
            padding: 10px;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 5px;
        }
        
        .room:hover, .room.active {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .users-list {
            margin-top: 20px;
        }
        
        .user {
            padding: 5px 0;
            font-size: 14px;
            opacity: 0.8;
        }
        
        .user.online {
            opacity: 1;
        }
        
        .typing-indicator {
            font-style: italic;
            color: #666;
            padding: 5px 10px;
            font-size: 12px;
        }
        
        .login-form {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-form form {
            background: white;
            padding: 30px;
            border-radius: 8px;
            min-width: 300px;
        }
        
        .login-form input {
            width: 100%;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        .login-form button {
            width: 100%;
            padding: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div id="loginForm" class="login-form">
        <form onsubmit="login(event)">
            <h2>Join Chat</h2>
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Login</button>
            <p style="margin-top: 10px; font-size: 12px;">
                Demo: Use username "demo" and password "demo123"
            </p>
        </form>
    </div>

    <div id="chatApp" class="hidden">
        <div class="sidebar">
            <h3>Rooms</h3>
            <div id="roomsList"></div>
            
            <div class="users-list">
                <h3>Online Users</h3>
                <div id="usersList"></div>
            </div>
        </div>
        
        <div class="chat-container">
            <div class="chat-header">
                <h2 id="currentRoomName">Select a room</h2>
                <div id="roomInfo"></div>
            </div>
            
            <div id="messages" class="messages"></div>
            <div id="typingIndicator" class="typing-indicator hidden"></div>
            
            <div class="message-input">
                <input type="text" id="messageInput" placeholder="Type a message..." 
                       onkeypress="handleKeyPress(event)" oninput="handleTyping()">
                <button onclick="sendMessage()">Send</button>
            </div>
        </div>
    </div>

    <script>
        let ws = null;
        let currentUser = null;
        let currentRoom = null;
        let typingTimer = null;
        let isTyping = false;

        // Connect to WebSocket server
        function connect() {
            ws = new WebSocket('ws://localhost:3000');
            
            ws.onopen = () => {
                console.log('Connected to chat server');
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };
            
            ws.onclose = () => {
                console.log('Disconnected from chat server');
                setTimeout(connect, 3000); // Reconnect after 3 seconds
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }

        function handleMessage(message) {
            switch (message.type) {
                case 'connection_established':
                    console.log('Connection established');
                    break;
                    
                case 'authenticated':
                    currentUser = message.data.user;
                    displayRooms(message.data.rooms);
                    document.getElementById('loginForm').classList.add('hidden');
                    document.getElementById('chatApp').classList.remove('hidden');
                    break;
                    
                case 'room_joined':
                    currentRoom = message.data.roomId;
                    document.getElementById('currentRoomName').textContent = message.data.roomName;
                    displayUsers(message.data.members);
                    loadRoomHistory();
                    break;
                    
                case 'new_message':
                    displayMessage(message.data.message);
                    break;
                    
                case 'user_joined':
                    displaySystemMessage(`${message.data.user.username} joined the room`);
                    break;
                    
                case 'user_left':
                    displaySystemMessage(`${message.data.user.username} left the room`);
                    break;
                    
                case 'user_typing':
                    handleTypingIndicator(message.data);
                    break;
                    
                case 'room_history':
                    displayHistory(message.data.messages);
                    break;
                    
                case 'private_message':
                    displayPrivateMessage(message.data);
                    break;
                    
                case 'error':
                    console.error('Server error:', message.data.message);
                    alert(message.data.message);
                    break;
            }
        }

        async function login(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                // For demo purposes, we'll create a simple auth token
                // In a real app, you'd call your auth API
                const token = btoa(JSON.stringify({ username, userId: Date.now().toString() }));
                
                connect();
                
                // Wait for connection then authenticate
                setTimeout(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'authenticate',
                            token: token
                        }));
                    }
                }, 100);
                
            } catch (error) {
                console.error('Login failed:', error);
                alert('Login failed');
            }
        }

        function displayRooms(rooms) {
            const roomsList = document.getElementById('roomsList');
            roomsList.innerHTML = '';
            
            rooms.forEach(room => {
                const roomEl = document.createElement('div');
                roomEl.className = 'room';
                roomEl.textContent = `${room.name} (${room.member_count})`;
                roomEl.onclick = () => joinRoom(room.id);
                roomsList.appendChild(roomEl);
            });
            
            // Auto-join general room
            if (rooms.length > 0) {
                joinRoom(rooms[0].id);
            }
        }

        function joinRoom(roomId) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'join_room',
                    roomId: roomId
                }));
                
                // Update active room UI
                document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
                event.target.classList.add('active');
            }
        }

        function loadRoomHistory() {
            if (ws && ws.readyState === WebSocket.OPEN && currentRoom) {
                ws.send(JSON.stringify({
                    type: 'get_room_history',
                    roomId: currentRoom,
                    limit: 50
                }));
            }
        }

        function displayHistory(messages) {
            const messagesEl = document.getElementById('messages');
            messagesEl.innerHTML = '';
            
            messages.forEach(message => {
                displayMessage(message, false);
            });
            
            scrollToBottom();
        }

        function displayMessage(message, shouldScroll = true) {
            const messagesEl = document.getElementById('messages');
            const messageEl = document.createElement('div');
            messageEl.className = `message ${message.userId === currentUser.id ? 'own' : ''}`;
            
            const time = new Date(message.timestamp).toLocaleTimeString();
            
            messageEl.innerHTML = `
                <div>
                    <div style="font-weight: bold; margin-bottom: 5px;">
                        ${message.username} <span style="font-size: 12px; opacity: 0.7;">${time}</span>
                    </div>
                    <div>${escapeHtml(message.content)}</div>
                </div>
            `;
            
            messagesEl.appendChild(messageEl);
            
            if (shouldScroll) {
                scrollToBottom();
            }
        }

        function displaySystemMessage(text) {
            const messagesEl = document.getElementById('messages');
            const messageEl = document.createElement('div');
            messageEl.className = 'message system';
            messageEl.style.textAlign = 'center';
            messageEl.style.fontStyle = 'italic';
            messageEl.style.opacity = '0.7';
            messageEl.textContent = text;
            
            messagesEl.appendChild(messageEl);
            scrollToBottom();
        }

        function displayPrivateMessage(data) {
            const messagesEl = document.getElementById('messages');
            const messageEl = document.createElement('div');
            messageEl.className = 'message private';
            messageEl.style.background = '#ffecb3';
            messageEl.style.border = '1px solid #ffd54f';
            
            const time = new Date(data.timestamp).toLocaleTimeString();
            
            messageEl.innerHTML = `
                <div>
                    <div style="font-weight: bold; margin-bottom: 5px;">
                        Private from ${data.from.username} <span style="font-size: 12px; opacity: 0.7;">${time}</span>
                    </div>
                    <div>${escapeHtml(data.content)}</div>
                </div>
            `;
            
            messagesEl.appendChild(messageEl);
            scrollToBottom();
        }

        function displayUsers(users) {
            const usersList = document.getElementById('usersList');
            usersList.innerHTML = '';
            
            users.forEach(user => {
                const userEl = document.createElement('div');
                userEl.className = 'user online';
                userEl.textContent = user.username;
                usersList.appendChild(userEl);
            });
        }

        function sendMessage() {
            const input = document.getElementById('messageInput');
            const content = input.value.trim();
            
            if (content && ws && ws.readyState === WebSocket.OPEN && currentRoom) {
                ws.send(JSON.stringify({
                    type: 'send_message',
                    roomId: currentRoom,
                    content: content
                }));
                
                input.value = '';
                stopTyping();
            }
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }

        function handleTyping() {
            if (!isTyping) {
                isTyping = true;
                startTyping();
            }
            
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                stopTyping();
            }, 1000);
        }

        function startTyping() {
            if (ws && ws.readyState === WebSocket.OPEN && currentRoom) {
                ws.send(JSON.stringify({
                    type: 'typing_start',
                    roomId: currentRoom
                }));
            }
        }

        function stopTyping() {
            if (isTyping) {
                isTyping = false;
                if (ws && ws.readyState === WebSocket.OPEN && currentRoom) {
                    ws.send(JSON.stringify({
                        type: 'typing_stop',
                        roomId: currentRoom
                    }));
                }
            }
        }

        function handleTypingIndicator(data) {
            const indicator = document.getElementById('typingIndicator');
            
            if (data.typing && data.userId !== currentUser.id) {
                indicator.textContent = `${data.username} is typing...`;
                indicator.classList.remove('hidden');
                
                setTimeout(() => {
                    indicator.classList.add('hidden');
                }, 3000);
            }
        }

        function scrollToBottom() {
            const messagesEl = document.getElementById('messages');
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Initialize the app
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Chat app initialized');
        });
    </script>
</body>
</html>
```

## Authentication Routes

```typescript
// src/routes/auth.ts
import { createServer } from "verb";
import { hash, compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { Database } from "bun:sqlite";

const authRouter = createServer();
const db = new Database("chat.db");

// Register new user
authRouter.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // Check if user exists
    const existing = db.query("SELECT id FROM users WHERE email = ? OR username = ?").get(email, username);
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }
    
    // Hash password
    const passwordHash = await hash(password, 12);
    
    // Create user
    const userId = crypto.randomUUID();
    db.query(`
      INSERT INTO users (id, username, email, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(userId, username, email, passwordHash);
    
    // Generate token
    const token = sign({ userId, username }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    
    res.status(201).json({
      user: { id: userId, username, email },
      token
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login user
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Find user
    const user = db.query("SELECT * FROM users WHERE username = ? OR email = ?").get(username, username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Verify password
    const validPassword = await compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Generate token
    const token = sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

export { authRouter };
```

## Running the Application

```bash
# Set environment variables
export JWT_SECRET="your-secret-key-here"

# Start the server
bun run server.ts

# The app will be available at http://localhost:3000
```

## Features Demonstrated

This WebSocket chat example showcases:

1. **Real-time Communication**: Instant message delivery using WebSocket
2. **Room Management**: Multiple chat rooms with user presence
3. **User Authentication**: JWT-based authentication
4. **Message Persistence**: Database storage of chat history
5. **Typing Indicators**: Real-time typing status
6. **Private Messaging**: Direct user-to-user messages
7. **Connection Management**: Handling connect/disconnect events
8. **Error Handling**: Graceful error handling and user feedback
9. **Responsive UI**: Clean, modern chat interface
10. **Auto-reconnection**: Automatic reconnection on connection loss

## Advanced Features to Add

- File and image sharing
- Message reactions and emoji
- User mentions and notifications
- Message search and filtering
- Admin moderation tools
- Voice and video calling
- Message encryption
- Mobile app support
- Chatbots and integrations
- Analytics and metrics

## See Also

- [WebSocket Server API](/api/servers/websocket) - WebSocket server configuration
- [Real-time API Example](/examples/realtime-api) - Real-time data streaming
- [Authentication Example](/examples/authentication) - User authentication patterns
- [File Upload Example](/examples/file-upload) - File sharing in chat