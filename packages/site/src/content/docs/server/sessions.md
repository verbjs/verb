---
title: Sessions
description: Learn how to implement sessions in Verb applications
---

# Sessions in Verb

Sessions allow you to store user data between HTTP requests, which is essential for features like authentication, shopping carts, and user preferences. Verb provides a flexible session management system through its plugin architecture.

## Basic Session Setup

The `@verb/plugin-sessions` plugin provides a straightforward way to add session support to your Verb application:

```typescript
import { createServer } from "@verb/server";
import sessions from "@verb/plugin-sessions";

const app = createServer();

app.use(sessions({
  secret: "your-secret-key", // Used to sign the session ID cookie
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Use secure cookies in production
    sameSite: "lax"
  }
}));

app.get("/", (req) => {
  const session = (req as any).session;
  
  // Initialize visit count if it doesn't exist
  if (!session.visits) {
    session.visits = 0;
  }
  
  // Increment visit count
  session.visits++;
  
  return new Response(`You have visited this page ${session.visits} times.`, {
    headers: { "Content-Type": "text/plain" }
  });
});

app.listen(3000);
```

## Configuration Options

The sessions plugin accepts the following options:

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `secret` | `string` | Secret used to sign the session ID cookie | Required |
| `name` | `string` | Name of the session ID cookie | `"verb.sid"` |
| `cookie` | `object` | Cookie options | See below |
| `resave` | `boolean` | Force session to be saved back to the store | `false` |
| `saveUninitialized` | `boolean` | Save uninitialized sessions | `true` |
| `rolling` | `boolean` | Force a cookie to be set on every response | `false` |
| `store` | `object` | Session store instance | Memory store |

### Cookie Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `path` | `string` | Cookie path | `"/"` |
| `httpOnly` | `boolean` | Restrict cookie access to HTTP(S) requests | `true` |
| `secure` | `boolean` | Only send cookie over HTTPS | `false` |
| `maxAge` | `number` | Cookie expiration time in milliseconds | `null` |
| `domain` | `string` | Cookie domain | `null` |
| `sameSite` | `string` | SameSite cookie attribute | `"lax"` |

## Session Stores

By default, sessions are stored in memory, which is not suitable for production environments. For production, you should use a persistent store:

### Redis Store

```typescript
import { createServer } from "@verb/server";
import sessions from "@verb/plugin-sessions";
import RedisStore from "@verb/plugin-sessions-redis";
import Redis from "ioredis";

const app = createServer();

const client = new Redis({
  host: "redis-server",
  port: 6379
});

app.use(sessions({
  secret: "your-secret-key",
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  },
  store: new RedisStore({
    client: client,
    prefix: "verb-session:"
  })
}));

app.listen(3000);
```

### MongoDB Store

```typescript
import { createServer } from "@verb/server";
import sessions from "@verb/plugin-sessions";
import MongoStore from "@verb/plugin-sessions-mongo";
import { MongoClient } from "mongodb";

const app = createServer();

const client = new MongoClient("mongodb://localhost:27017");
await client.connect();
const db = client.db("verb-sessions");

app.use(sessions({
  secret: "your-secret-key",
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  },
  store: new MongoStore({
    client: client,
    collection: "sessions"
  })
}));

app.listen(3000);
```

## Working with Sessions

### Storing Data in a Session

```typescript
app.post("/login", async (req) => {
  const body = await req.json();
  
  // Validate user credentials (in a real app, you would check against a database)
  if (body.username === "admin" && body.password === "password") {
    // Store user data in the session
    (req as any).session.user = {
      id: 1,
      username: "admin",
      role: "admin"
    };
    
    return new Response(JSON.stringify({ message: "Login successful" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ error: "Invalid credentials" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
});
```

### Retrieving Data from a Session

```typescript
app.get("/profile", (req) => {
  const session = (req as any).session;
  
  // Check if user is logged in
  if (!session.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ user: session.user }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

### Modifying Session Data

```typescript
app.post("/update-preferences", async (req) => {
  const session = (req as any).session;
  const body = await req.json();
  
  // Check if user is logged in
  if (!session.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Update user preferences
  session.preferences = {
    ...session.preferences,
    ...body
  };
  
  return new Response(JSON.stringify({ message: "Preferences updated" }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

### Destroying a Session

```typescript
app.post("/logout", (req) => {
  // Destroy the session
  (req as any).session.destroy((err: Error) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
  });
  
  return new Response(JSON.stringify({ message: "Logout successful" }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Session-Based Authentication

Sessions are commonly used for authentication. Here's a simple example:

```typescript
import { createServer } from "@verb/server";
import sessions from "@verb/plugin-sessions";

const app = createServer();

app.use(sessions({
  secret: "your-secret-key",
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  }
}));

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, next: () => Response | Promise<Response>) => {
  const session = (req as any).session;
  
  if (!session.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return next();
};

// Login route
app.post("/login", async (req) => {
  const body = await req.json();
  
  // Validate user credentials (in a real app, you would check against a database)
  if (body.username === "admin" && body.password === "password") {
    // Store user data in the session
    (req as any).session.user = {
      id: 1,
      username: "admin",
      role: "admin"
    };
    
    return new Response(JSON.stringify({ message: "Login successful" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ error: "Invalid credentials" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
});

// Protected route
app.get("/profile", isAuthenticated, (req) => {
  const session = (req as any).session;
  
  return new Response(JSON.stringify({ user: session.user }), {
    headers: { "Content-Type": "application/json" }
  });
});

// Logout route
app.post("/logout", (req) => {
  // Destroy the session
  (req as any).session.destroy((err: Error) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
  });
  
  return new Response(JSON.stringify({ message: "Logout successful" }), {
    headers: { "Content-Type": "application/json" }
  });
});

app.listen(3000);
```

## Best Practices

- **Use a Persistent Store in Production**: Memory store is not suitable for production environments
- **Set Secure Cookies**: Use secure, HTTP-only, and SameSite cookies
- **Use a Strong Secret**: Use a strong, unique secret for signing session cookies
- **Limit Session Data**: Store only necessary data in the session
- **Set Appropriate Expiration**: Set an appropriate session expiration time
- **Implement CSRF Protection**: Use CSRF tokens to protect against CSRF attacks
- **Regenerate Session IDs**: Regenerate session IDs after authentication to prevent session fixation attacks

## Next Steps

- [Security](/server/security) - Learn about security best practices in Verb
- [Authentication](/server/authentication) - Learn more about authentication in Verb
- [Middleware](/server/middleware) - Explore middleware in Verb