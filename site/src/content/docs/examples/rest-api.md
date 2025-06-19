---
title: Building a REST API
description: Learn how to build a complete REST API with Verb
---

# Building a REST API with Verb

This example demonstrates how to build a complete REST API using Verb. We'll create a simple user management API with CRUD operations.

## Project Setup

First, create a new Verb project using the API template:

```bash
verb init user-api --template api
cd user-api
```

## Basic Server Setup

Let's start by setting up our server in `src/index.ts`:

```typescript
import { createServer, json } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

// We'll add our routes here

console.log("Server running at http://localhost:3000");
```

## Data Model

For this example, we'll use an in-memory data store for our users:

```typescript
// Add this to src/index.ts

// User type definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
}

// In-memory data store
const users: User[] = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob@example.com",
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    name: "Charlie Davis",
    email: "charlie@example.com",
    createdAt: new Date().toISOString()
  }
];

// Track the next available ID
let nextId = 4;
```

## CRUD Routes

Now, let's add routes for creating, reading, updating, and deleting users:

```typescript
// GET /api/users - Get all users
app.get("/api/users", () => {
  return json({
    users,
    total: users.length,
    timestamp: new Date().toISOString()
  });
});

// GET /api/users/:id - Get a specific user
app.get("/api/users/:id", (req, params) => {
  const id = Number.parseInt(params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return new Response(`User with id ${id} not found`, { status: 404 });
  }
  
  return json(user);
});

// POST /api/users - Create a new user
app.post("/api/users", async (req) => {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.name || !body.email) {
      return new Response("Name and email are required", { status: 400 });
    }
    
    // Create new user
    const newUser: User = {
      id: nextId++,
      name: body.name,
      email: body.email,
      createdAt: new Date().toISOString()
    };
    
    // Add to our data store
    users.push(newUser);
    
    // Return the created user
    return json(newUser, 201);
  } catch (err) {
    return new Response("Invalid JSON body", { status: 400 });
  }
});

// PUT /api/users/:id - Update a user
app.put("/api/users/:id", async (req, params) => {
  try {
    const id = Number.parseInt(params.id);
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return new Response(`User with id ${id} not found`, { status: 404 });
    }
    
    const body = await req.json();
    
    // Update user
    const updatedUser: User = {
      ...users[userIndex],
      ...body,
      id, // Prevent ID changes
      updatedAt: new Date().toISOString()
    };
    
    users[userIndex] = updatedUser;
    
    return json(updatedUser);
  } catch (err) {
    return new Response("Invalid JSON body", { status: 400 });
  }
});

// DELETE /api/users/:id - Delete a user
app.delete("/api/users/:id", (req, params) => {
  const id = Number.parseInt(params.id);
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return new Response(`User with id ${id} not found`, { status: 404 });
  }
  
  // Remove the user
  const deletedUser = users.splice(userIndex, 1)[0];
  
  return json({
    message: "User deleted successfully",
    user: deletedUser
  });
});
```

## Adding Middleware

Let's add some middleware for logging and error handling:

```typescript
import { createServer, json } from "@verb/server";
import type { Middleware } from "@verb/server";

// Logging middleware
const logger: Middleware = (req, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.url} - Started`);
  
  const result = next();
  
  if (result instanceof Promise) {
    return result.then(response => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} - ${response.status} (${duration}ms)`);
      return response;
    });
  } else {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${result.status} (${duration}ms)`);
    return result;
  }
};

// Apply middleware to all routes
app.use(logger);

// Global error handler
app.onError((err, req) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);
  
  return new Response("An unexpected error occurred", {
    status: 500,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      error: "Internal Server Error",
      message: err.message,
      timestamp: new Date().toISOString()
    })
  });
});
```

## Testing the API

You can test your API using curl or any API client:

```bash
# Get all users
curl http://localhost:3000/api/users

# Get a specific user
curl http://localhost:3000/api/users/1

# Create a new user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"David Wilson","email":"david@example.com"}'

# Update a user
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Johnson Updated"}'

# Delete a user
curl -X DELETE http://localhost:3000/api/users/2
```

## Complete Example

Here's the complete code for our REST API:

```typescript
import { createServer, json } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

// User type definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
}

// In-memory data store
const users: User[] = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob@example.com",
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    name: "Charlie Davis",
    email: "charlie@example.com",
    createdAt: new Date().toISOString()
  }
];

// Track the next available ID
let nextId = 4;

// Logging middleware
const logger: Middleware = (req, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.url} - Started`);
  
  const result = next();
  
  if (result instanceof Promise) {
    return result.then(response => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} - ${response.status} (${duration}ms)`);
      return response;
    });
  } else {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${result.status} (${duration}ms)`);
    return result;
  }
};

// Apply middleware to all routes
app.use(logger);

// GET /api/users - Get all users
app.get("/api/users", () => {
  return json({
    users,
    total: users.length,
    timestamp: new Date().toISOString()
  });
});

// GET /api/users/:id - Get a specific user
app.get("/api/users/:id", (req, params) => {
  const id = Number.parseInt(params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return new Response(`User with id ${id} not found`, { status: 404 });
  }
  
  return json(user);
});

// POST /api/users - Create a new user
app.post("/api/users", async (req) => {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.name || !body.email) {
      return new Response("Name and email are required", { status: 400 });
    }
    
    // Create new user
    const newUser: User = {
      id: nextId++,
      name: body.name,
      email: body.email,
      createdAt: new Date().toISOString()
    };
    
    // Add to our data store
    users.push(newUser);
    
    // Return the created user
    return json(newUser, 201);
  } catch (err) {
    return new Response("Invalid JSON body", { status: 400 });
  }
});

// PUT /api/users/:id - Update a user
app.put("/api/users/:id", async (req, params) => {
  try {
    const id = Number.parseInt(params.id);
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return new Response(`User with id ${id} not found`, { status: 404 });
    }
    
    const body = await req.json();
    
    // Update user
    const updatedUser: User = {
      ...users[userIndex],
      ...body,
      id, // Prevent ID changes
      updatedAt: new Date().toISOString()
    };
    
    users[userIndex] = updatedUser;
    
    return json(updatedUser);
  } catch (err) {
    return new Response("Invalid JSON body", { status: 400 });
  }
});

// DELETE /api/users/:id - Delete a user
app.delete("/api/users/:id", (req, params) => {
  const id = Number.parseInt(params.id);
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return new Response(`User with id ${id} not found`, { status: 404 });
  }
  
  // Remove the user
  const deletedUser = users.splice(userIndex, 1)[0];
  
  return json({
    message: "User deleted successfully",
    user: deletedUser
  });
});

// Global error handler
app.onError((err, req) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);
  
  return new Response("An unexpected error occurred", {
    status: 500,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      error: "Internal Server Error",
      message: err.message,
      timestamp: new Date().toISOString()
    })
  });
});

console.log("Server running at http://localhost:3000");
```

## Next Steps

This example demonstrates a basic REST API with Verb. You can extend it by:

- Adding authentication and authorization
- Connecting to a real database
- Adding validation using a schema validation library
- Implementing pagination for the list endpoint
- Adding filtering and sorting options
- Creating API documentation

For more examples and advanced features, check out:

- [Authentication](/examples/authentication)
- [Database Integration](/examples/database-integration)
- [Validation](/server/validation)
- [Middleware](/server/middleware)