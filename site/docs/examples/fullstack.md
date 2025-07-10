# Fullstack Application

This example demonstrates how to build a complete fullstack application using Verb's Bun native routes with HTML imports, automatic bundling, and real-time features.

## Overview

This fullstack example includes:
- HTML imports with automatic bundling
- React frontend with TypeScript
- CSS bundling and hot reloading
- API routes for data management
- Real-time WebSocket communication
- Development optimizations

## Project Structure

```
fullstack-app/
├── src/
│   ├── server.ts          # Main server file
│   ├── frontend/
│   │   ├── index.html     # Main HTML entry
│   │   ├── app.tsx        # React application
│   │   ├── styles.css     # Application styles
│   │   └── types.d.ts     # TypeScript definitions
│   ├── api/
│   │   ├── users.ts       # User API handlers
│   │   └── websocket.ts   # WebSocket handlers
│   └── data/
│       └── store.ts       # In-memory data store
├── package.json
└── tsconfig.json
```

## Server Implementation

### Main Server (src/server.ts)

```typescript
import { createServer } from "verb";
import homepage from "./frontend/index.html";
import { userHandlers } from "./api/users";
import { setupWebSocket } from "./api/websocket";

const app = createServer();

// Configure Bun native routes
app.withRoutes({
  // HTML imports - Bun handles bundling automatically
  "/": homepage,
  
  // API routes
  "/api/users": userHandlers,
  "/api/users/:id": userHandlers.byId,
  
  // Health check
  "/api/health": {
    GET: () => Response.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString() 
    })
  },
  
  // WebSocket endpoint info
  "/api/ws-info": {
    GET: () => Response.json({
      wsUrl: "ws://localhost:3000/ws",
      protocols: ["chat", "notifications"]
    })
  }
});

// Configure development options
app.withOptions({
  port: 3000,
  hostname: "localhost",
  development: {
    hmr: true,      // Hot module reloading
    console: true   // Enhanced console logging
  },
  showRoutes: true  // Show routes on startup
});

// Setup WebSocket for real-time features
setupWebSocket(app);

// Start server
app.listen();

console.log("🚀 Fullstack app running on http://localhost:3000");
console.log("Features:");
console.log("  - HTML imports with automatic bundling");
console.log("  - React with TypeScript");
console.log("  - CSS bundling");
console.log("  - Hot module reloading");
console.log("  - Real-time WebSocket communication");
```

## Frontend Implementation

### HTML Entry Point (src/frontend/index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verb Fullstack App</title>
  <!-- CSS is automatically bundled by Bun -->
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="root">
    <div class="loading">Loading...</div>
  </div>
  
  <!-- TypeScript/React is automatically bundled by Bun -->
  <script type="module" src="./app.tsx"></script>
</body>
</html>
```

### React Application (src/frontend/app.tsx)

```tsx
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Message {
  type: string;
  data: any;
  timestamp: string;
}

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:3000");
    
    websocket.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
      setWs(websocket);
    };
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
      
      // Handle real-time user updates
      if (message.type === "user_created") {
        setUsers(prev => [...prev, message.data]);
      } else if (message.type === "user_updated") {
        setUsers(prev => prev.map(user => 
          user.id === message.data.id ? message.data : user
        ));
      } else if (message.type === "user_deleted") {
        setUsers(prev => prev.filter(user => user.id !== message.data.id));
      }
    };
    
    websocket.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };
    
    return () => {
      websocket.close();
    };
  }, []);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const userData = await response.json();
      setUsers(userData);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.name || !newUser.email) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        const user = await response.json();
        // User will be added via WebSocket message
        setNewUser({ name: "", email: "" });
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error("Failed to create user:", error);
      alert("Failed to create user");
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
      // User will be removed via WebSocket message
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Failed to delete user");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Verb Fullstack App</h1>
        <div className="status">
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
      </header>

      <main className="main">
        <section className="user-form">
          <h2>Add New User</h2>
          <form onSubmit={createUser}>
            <div className="form-group">
              <input
                type="text"
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <button type="submit">Add User</button>
          </form>
        </section>

        <section className="users-list">
          <h2>Users ({users.length})</h2>
          <div className="users-grid">
            {users.map((user) => (
              <div key={user.id} className="user-card">
                <h3>{user.name}</h3>
                <p>{user.email}</p>
                <small>Created: {new Date(user.createdAt).toLocaleString()}</small>
                <button 
                  className="delete-btn"
                  onClick={() => deleteUser(user.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="messages">
          <h2>Real-time Messages</h2>
          <div className="messages-list">
            {messages.slice(-5).map((message, index) => (
              <div key={index} className="message">
                <span className="message-type">{message.type}</span>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

// Mount React app
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

### Styles (src/frontend/styles.css)

```css
/* CSS is automatically bundled by Bun */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f5f5f5;
  color: #333;
  line-height: 1.6;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.header h1 {
  color: #2563eb;
}

.connection-status {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
}

.connection-status.connected {
  background-color: #dcfce7;
  color: #166534;
}

.connection-status.disconnected {
  background-color: #fef2f2;
  color: #dc2626;
}

.main {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
}

.user-form {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  height: fit-content;
}

.user-form h2 {
  margin-bottom: 20px;
  color: #1f2937;
}

.form-group {
  margin-bottom: 15px;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 16px;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

button {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #1d4ed8;
}

.delete-btn {
  background-color: #dc2626;
  padding: 8px 16px;
  font-size: 14px;
  margin-top: 10px;
}

.delete-btn:hover {
  background-color: #b91c1c;
}

.users-list {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.users-list h2 {
  margin-bottom: 20px;
  color: #1f2937;
}

.users-grid {
  display: grid;
  gap: 15px;
}

.user-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 15px;
  background: #f9fafb;
}

.user-card h3 {
  margin-bottom: 5px;
  color: #1f2937;
}

.user-card p {
  color: #6b7280;
  margin-bottom: 10px;
}

.user-card small {
  color: #9ca3af;
  font-size: 12px;
}

.messages {
  grid-column: 1 / -1;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-top: 20px;
}

.messages h2 {
  margin-bottom: 15px;
  color: #1f2937;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 14px;
}

.message-type {
  font-weight: 500;
  color: #2563eb;
}

.message-time {
  color: #6b7280;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  color: #6b7280;
}

@media (max-width: 768px) {
  .main {
    grid-template-columns: 1fr;
  }
  
  .app {
    padding: 10px;
  }
}
```

## API Implementation

### User API (src/api/users.ts)

```typescript
import { store } from "../data/store";
import { broadcastMessage } from "./websocket";

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export const userHandlers = {
  // GET /api/users
  async GET(req: Request) {
    const users = store.getUsers();
    return Response.json(users);
  },

  // POST /api/users
  async POST(req: Request) {
    try {
      const { name, email } = await req.json();

      if (!name || !email) {
        return Response.json(
          { error: "Name and email are required" },
          { status: 400 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return Response.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      const user: User = {
        id: Date.now().toString(),
        name,
        email,
        createdAt: new Date().toISOString(),
      };

      store.addUser(user);

      // Broadcast to WebSocket clients
      broadcastMessage({
        type: "user_created",
        data: user,
        timestamp: new Date().toISOString(),
      });

      return Response.json(user, { status: 201 });
    } catch (error) {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }
  },

  // Individual user handlers
  byId: {
    // GET /api/users/:id
    async GET(req: Request) {
      const { id } = req.params;
      const user = store.getUser(id);

      if (!user) {
        return Response.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      return Response.json(user);
    },

    // PUT /api/users/:id
    async PUT(req: Request) {
      try {
        const { id } = req.params;
        const { name, email } = await req.json();

        const user = store.getUser(id);
        if (!user) {
          return Response.json(
            { error: "User not found" },
            { status: 404 }
          );
        }

        const updatedUser = store.updateUser(id, { name, email });

        // Broadcast to WebSocket clients
        broadcastMessage({
          type: "user_updated",
          data: updatedUser,
          timestamp: new Date().toISOString(),
        });

        return Response.json(updatedUser);
      } catch (error) {
        return Response.json(
          { error: "Invalid JSON" },
          { status: 400 }
        );
      }
    },

    // DELETE /api/users/:id
    async DELETE(req: Request) {
      const { id } = req.params;
      const user = store.getUser(id);

      if (!user) {
        return Response.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      store.deleteUser(id);

      // Broadcast to WebSocket clients
      broadcastMessage({
        type: "user_deleted",
        data: { id },
        timestamp: new Date().toISOString(),
      });

      return new Response(null, { status: 204 });
    },
  },
};
```

### WebSocket Handler (src/api/websocket.ts)

```typescript
import { ServerProtocol } from "verb";

const connections = new Set<WebSocket>();

export function setupWebSocket(app: any) {
  // Create WebSocket server
  const wsServer = app.createServer?.(ServerProtocol.WEBSOCKET);
  
  if (wsServer) {
    wsServer.websocket({
      open: (ws) => {
        console.log("WebSocket client connected");
        connections.add(ws);
        
        // Send welcome message
        ws.send(JSON.stringify({
          type: "connected",
          message: "Welcome to Verb Fullstack App",
          timestamp: new Date().toISOString(),
        }));
      },

      message: (ws, message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log("WebSocket message:", data);
          
          // Echo message back to client
          ws.send(JSON.stringify({
            type: "echo",
            data,
            timestamp: new Date().toISOString(),
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Invalid JSON",
            timestamp: new Date().toISOString(),
          }));
        }
      },

      close: (ws) => {
        console.log("WebSocket client disconnected");
        connections.delete(ws);
      },
    });
  }
}

export function broadcastMessage(message: any) {
  const messageStr = JSON.stringify(message);
  
  for (const ws of connections) {
    try {
      ws.send(messageStr);
    } catch (error) {
      // Remove broken connections
      connections.delete(ws);
    }
  }
}
```

### Data Store (src/data/store.ts)

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

class InMemoryStore {
  private users: Map<string, User> = new Map();

  getUsers(): User[] {
    return Array.from(this.users.values());
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  addUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }
}

export const store = new InMemoryStore();

// Add some sample data
store.addUser({
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  createdAt: new Date().toISOString(),
});

store.addUser({
  id: "2",
  name: "Jane Smith",
  email: "jane@example.com",
  createdAt: new Date().toISOString(),
});
```

## Configuration Files

### package.json

```json
{
  "name": "verb-fullstack-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun --hot src/server.ts",
    "start": "bun src/server.ts",
    "build": "bun build src/server.ts --outdir=dist",
    "test": "bun test"
  },
  "dependencies": {
    "verb": "latest",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### TypeScript Definitions (src/frontend/types.d.ts)

```typescript
declare module "*.html" {
  const content: any;
  export default content;
}

declare module "*.css" {
  const content: any;
  export default content;
}
```

## Running the Application

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Start development server**:
   ```bash
   bun run dev
   ```

3. **Open browser**:
   Navigate to `http://localhost:3000`

4. **Test features**:
   - Add new users via the form
   - Watch real-time updates
   - Delete users and see immediate updates
   - Check WebSocket connection status

## Key Features

1. **Bun Native Routes**: HTML imports with automatic bundling
2. **React Integration**: Full React app with TypeScript
3. **Hot Module Reloading**: Real-time development updates
4. **CSS Bundling**: Automatic CSS processing
5. **Real-time Updates**: WebSocket communication
6. **API Routes**: RESTful API with proper error handling
7. **Type Safety**: Full TypeScript support
8. **Development Mode**: Enhanced development features

## Deployment

### Production Build

```bash
# Build for production
bun build src/server.ts --outdir=dist --minify

# Run production server
NODE_ENV=production bun dist/server.js
```

### Docker Deployment

```docker
FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY src/ ./src/
COPY tsconfig.json ./

EXPOSE 3000

CMD ["bun", "src/server.ts"]
```

## Next Steps

- Add database integration
- Implement user authentication
- Add more real-time features
- Deploy to production
- Add automated testing

This example demonstrates the power of Verb's Bun native routes for building modern fullstack applications with minimal configuration and maximum performance.