---
title: Quick Start
description: Learn the basics of Verb and build your first application
---

# Quick Start

This guide will help you get started with Verb by building a simple API server. We'll cover the basics of routing, request handling, and response types.

## Creating a Basic Server

First, let's create a basic server that responds with a simple message:

```typescript
import { createServer } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

app.get("/", () => {
  return new Response("Hello from Verb!");
});

console.log("Server running at http://localhost:3000");
```

Save this code to a file named `src/index.ts` and run it with:

```bash
bun run src/index.ts
```

Visit `http://localhost:3000` in your browser, and you should see "Hello from Verb!" displayed.

## Adding Routes

Verb makes it easy to define routes for different HTTP methods. Let's add some more routes to our server:

```typescript
import { createServer, json } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

// Basic route returning text
app.get("/", () => {
  return new Response("Hello from Verb!");
});

// Route returning JSON data
app.get("/api/users", () => {
  const users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" }
  ];
  
  return json(users);
});

// Route with URL parameters
app.get("/api/users/:id", (req, params) => {
  const userId = parseInt(params.id);
  
  // Simulate fetching a user from a database
  const user = { id: userId, name: `User ${userId}` };
  
  return json(user);
});

// POST route for creating data
app.post("/api/users", async (req) => {
  // Parse the request body as JSON
  const body = await req.json();
  
  // Validate the request body
  if (!body.name) {
    return new Response("Name is required", { status: 400 });
  }
  
  // Simulate creating a user in a database
  const newUser = {
    id: 4,
    name: body.name,
    createdAt: new Date().toISOString()
  };
  
  return json(newUser, 201);
});

console.log("Server running at http://localhost:3000");
```

## Using Middleware

Middleware functions in Verb allow you to execute code before the route handler. Let's add a simple logging middleware:

```typescript
import { createServer, json } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

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

// Routes
app.get("/", () => {
  return new Response("Hello from Verb!");
});

app.get("/api/users", () => {
  return json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" }
  ]);
});

console.log("Server running at http://localhost:3000");
```

## Serving Static Files

Verb makes it easy to serve static files from a directory:

```typescript
import { createServer, serveStatic } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

// Serve static files from the 'public' directory
app.get("/static/*", (req) => {
  return serveStatic(req, {
    directory: "./public"
  });
});

// Other routes
app.get("/", () => {
  return new Response("Hello from Verb!");
});

console.log("Server running at http://localhost:3000");
```

## Error Handling

Verb provides a simple way to handle errors in your application:

```typescript
import { createServer, json, error } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

app.get("/api/users/:id", (req, params) => {
  const userId = parseInt(params.id);
  
  // Simulate a database lookup
  if (userId <= 0 || userId > 100) {
    // Return an error response
    return error(`User with id ${userId} not found`, 404);
  }
  
  return json({ id: userId, name: `User ${userId}` });
});

// Global error handler
app.onError((err, req) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);
  
  return new Response("An unexpected error occurred", {
    status: 500
  });
});

console.log("Server running at http://localhost:3000");
```

## Next Steps

Now that you've learned the basics of Verb, you can explore more advanced features:

- [Routing](/server/routing) - Learn more about routing in Verb
- [Middleware](/server/middleware) - Dive deeper into middleware
- [Request Handling](/server/request-handling) - Learn how to handle different types of requests
- [Response Types](/server/response-types) - Explore the different response types available in Verb