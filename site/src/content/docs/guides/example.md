---
title: Building Your First API
description: A complete guide to building a RESTful API with Verb library.
---

This guide walks you through building a complete RESTful API with the Verb library, from setup to deployment.

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or higher installed
- Basic knowledge of TypeScript/JavaScript
- Understanding of REST API concepts

## Setting Up Your Project

First, create a new Verb project:

```bash
bunx @verb/cli init my-api --template api
cd my-api
```

This creates a new project with the API template, including:
- Server configuration
- Example routes
- Type definitions
- Development scripts

## Creating Your First Route

Let's create a simple user management API. Start by defining your user model:

```typescript
// src/types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}
```

Now create your user routes:

```typescript
// src/routes/users.ts
import { createServer, json, error } from '@verb/server';
import type { User } from '../types';

// In-memory storage (use a database in production)
const users: User[] = [];
let nextId = 1;

export const userRoutes = (server: ReturnType<typeof createServer>) => {
  // Get all users
  server.get('/api/users', () => {
    return json(users);
  });

  // Get user by ID
  server.get('/api/users/:id', (req, params) => {
    const user = users.find(u => u.id === params.id);
    if (!user) {
      return error('User not found', 404);
    }
    return json(user);
  });

  // Create new user
  server.post('/api/users', async (req) => {
    const body = await req.json();
    
    const user: User = {
      id: String(nextId++),
      name: body.name,
      email: body.email,
      createdAt: new Date(),
    };
    
    users.push(user);
    return json(user, 201);
  });

  // Update user
  server.put('/api/users/:id', async (req, params) => {
    const userIndex = users.findIndex(u => u.id === params.id);
    if (userIndex === -1) {
      return error('User not found', 404);
    }
    
    const body = await req.json();
    users[userIndex] = { ...users[userIndex], ...body };
    
    return json(users[userIndex]);
  });

  // Delete user
  server.delete('/api/users/:id', (req, params) => {
    const userIndex = users.findIndex(u => u.id === params.id);
    if (userIndex === -1) {
      return error('User not found', 404);
    }
    
    users.splice(userIndex, 1);
    return json({ message: 'User deleted successfully' });
  });
};
```

## Setting Up Your Server

Create your main server file:

```typescript
// src/server.ts
import { createServer } from '@verb/server';
import { userRoutes } from './routes/users';

const server = createServer({
  port: 3000,
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },
});

// Add JSON parsing middleware
server.use(async (req, next) => {
  if (req.headers.get('content-type')?.includes('application/json')) {
    try {
      (req as any).body = await req.json();
    } catch (e) {
      // Handle invalid JSON
    }
  }
  return next();
});

// Register user routes
userRoutes(server);

// Health check endpoint
server.get('/health', () => {
  return json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default server;
```

## Adding Validation

Add input validation using Verb's built-in validation:

```typescript
import { createServer, json, validate } from '@verb/server';

const userSchema = {
  name: { type: 'string', required: true, minLength: 2 },
  email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
};

server.post('/api/users', validate(userSchema), async (req) => {
  // Validation passed, safe to use req.body
  const { name, email } = req.body;
  
  const user: User = {
    id: String(nextId++),
    name,
    email,
    createdAt: new Date(),
  };
  
  users.push(user);
  return json(user, 201);
});
```

## Testing Your API

Start your development server:

```bash
bun run dev
```

Test your endpoints:

```bash
# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Get all users
curl http://localhost:3000/api/users

# Get specific user
curl http://localhost:3000/api/users/1
```

## Next Steps

Now that you have a basic API, consider adding:

- [Authentication and authorization](/server/security)
- [Database integration](/server/plugins)
- [Rate limiting](/server/rate-limiting)
- [Logging and monitoring](/server/middleware)
- [File uploads](/server/file-uploads)
- [WebSocket support](/server/websockets)

## Production Deployment

When ready for production:

1. Build your project: `bun run build`
2. Set environment variables
3. Use a process manager like PM2
4. Set up reverse proxy (nginx/Apache)
5. Configure SSL certificates

Your API is now ready for production use with Verb's high-performance server!
