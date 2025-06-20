---
title: Security
description: Learn how to secure your Verb applications
---

# Security in Verb

Security is a critical aspect of any web application. This guide covers best practices and tools for securing your Verb applications.

## Security Headers

Security headers are HTTP response headers that help protect against common web vulnerabilities. Verb provides a plugin to easily add these headers to your application:

```typescript
import { createServer } from "@verb/server";
import securityHeaders from "@verb/plugin-security-headers";

const app = createServer();

app.use(securityHeaders({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    }
  },
  xFrameOptions: "DENY",
  xContentTypeOptions: "nosniff",
  referrerPolicy: "no-referrer",
  permissionsPolicy: "camera=(), microphone=(), geolocation=()"
}));

app.get("/", () => {
  return new Response("Hello, World!");
});

app.listen(3000);
```

## CORS (Cross-Origin Resource Sharing)

CORS is a security feature implemented by browsers to restrict web pages from making requests to a different domain. Verb provides a CORS plugin:

```typescript
import { createServer } from "@verb/server";
import cors from "@verb/plugin-cors";

const app = createServer();

app.use(cors({
  origin: ["https://example.com", "https://www.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Custom-Header"],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

app.get("/api/data", () => {
  return new Response(JSON.stringify({ message: "Hello, World!" }), {
    headers: { "Content-Type": "application/json" }
  });
});

app.listen(3000);
```

## CSRF Protection

Cross-Site Request Forgery (CSRF) is an attack that forces authenticated users to execute unwanted actions. Verb provides a CSRF protection plugin:

```typescript
import { createServer } from "@verb/server";
import csrf from "@verb/plugin-csrf";
import sessions from "@verb/plugin-sessions";

const app = createServer();

// Sessions are required for CSRF protection
app.use(sessions({
  secret: "your-secret-key",
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict"
  }
}));

app.use(csrf({
  cookie: {
    key: "_csrf",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  }
}));

// Add CSRF token to forms
app.get("/form", (req) => {
  const csrfToken = (req as any).csrfToken();
  
  return new Response(`
    <form action="/submit" method="post">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <input type="text" name="name">
      <button type="submit">Submit</button>
    </form>
  `, {
    headers: { "Content-Type": "text/html" }
  });
});

// Validate CSRF token on form submission
app.post("/submit", async (req) => {
  const formData = await req.formData();
  const name = formData.get("name");
  
  return new Response(`Hello, ${name}!`, {
    headers: { "Content-Type": "text/plain" }
  });
});

app.listen(3000);
```

## Helmet Integration

Helmet is a collection of middleware functions that help secure Express apps by setting various HTTP headers. Verb provides a Helmet integration:

```typescript
import { createServer } from "@verb/server";
import helmet from "@verb/plugin-helmet";

const app = createServer();

app.use(helmet()); // Apply all default Helmet middleware

// Or configure specific middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "trusted-cdn.com"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: {
    action: "deny"
  }
}));

app.get("/", () => {
  return new Response("Hello, World!");
});

app.listen(3000);
```

## Authentication

Authentication is a crucial part of application security. Verb supports various authentication methods:

### JWT Authentication

```typescript
import { createServer } from "@verb/server";
import jwt from "@verb/plugin-jwt";

const app = createServer();

app.use(jwt({
  secret: "your-secret-key",
  algorithms: ["HS256"],
  credentialsRequired: false // Allow some routes to be accessed without a token
}));

// Protected route
app.get("/api/protected", (req) => {
  const user = (req as any).user;
  
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ message: `Hello, ${user.name}!` }), {
    headers: { "Content-Type": "application/json" }
  });
});

// Login route
app.post("/api/login", async (req) => {
  const body = await req.json();
  
  // Validate credentials (in a real app, you would check against a database)
  if (body.username === "admin" && body.password === "password") {
    // Generate a token
    const token = jwt.sign({ id: 1, name: "Admin" }, "your-secret-key", { expiresIn: "1h" });
    
    return new Response(JSON.stringify({ token }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ error: "Invalid credentials" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
});

app.listen(3000);
```

### OAuth Integration

```typescript
import { createServer } from "@verb/server";
import oauth from "@verb/plugin-oauth";

const app = createServer();

app.use(oauth({
  providers: {
    github: {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/callback"
    },
    google: {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback"
    }
  },
  session: {
    secret: "your-secret-key",
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax"
    }
  }
}));

// Auth routes are automatically created by the plugin
// /auth/github, /auth/github/callback, /auth/google, /auth/google/callback

// Protected route
app.get("/profile", (req) => {
  const user = (req as any).user;
  
  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Location": "/login" }
    });
  }
  
  return new Response(`
    <h1>Profile</h1>
    <p>Name: ${user.name}</p>
    <p>Email: ${user.email}</p>
    <a href="/logout">Logout</a>
  `, {
    headers: { "Content-Type": "text/html" }
  });
});

app.listen(3000);
```

## Input Validation

Validating user input is essential for preventing injection attacks. Verb provides integration with popular validation libraries:

```typescript
import { createServer } from "@verb/server";
import { z } from "zod";
import { validate } from "@verb/plugin-validation";

const app = createServer();

// Define a schema for user input
const userSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  age: z.number().int().min(18).optional()
});

app.post("/api/users", validate({ body: userSchema }), async (req) => {
  const user = await req.json();
  
  // At this point, the user data has been validated
  // If validation fails, the middleware will return a 400 response
  
  return new Response(JSON.stringify({ message: "User created", user }), {
    headers: { "Content-Type": "application/json" }
  });
});

app.listen(3000);
```

## Environment Variables

Sensitive information like API keys and database credentials should be stored in environment variables, not in your code:

```typescript
import { createServer } from "@verb/server";
import { config } from "dotenv";

// Load environment variables from .env file
config();

const app = createServer();

app.get("/api/data", () => {
  // Use environment variables for sensitive information
  const apiKey = process.env.API_KEY;
  
  // Use the API key to fetch data from an external service
  
  return new Response(JSON.stringify({ message: "Data fetched" }), {
    headers: { "Content-Type": "application/json" }
  });
});

app.listen(3000);
```

## Rate Limiting

Rate limiting helps protect your API from abuse. See the [Rate Limiting](/server/rate-limiting) guide for more information.

## Security Best Practices

- **Keep Dependencies Updated**: Regularly update your dependencies to patch security vulnerabilities
- **Use HTTPS**: Always use HTTPS in production
- **Implement Proper Authentication**: Use strong authentication mechanisms
- **Validate User Input**: Always validate and sanitize user input
- **Use Content Security Policy**: Implement a strict Content Security Policy
- **Set Secure Cookies**: Use secure, HTTP-only, and SameSite cookies
- **Implement Rate Limiting**: Protect against brute force attacks
- **Use Parameterized Queries**: Prevent SQL injection attacks
- **Implement Proper Error Handling**: Don't expose sensitive information in error messages
- **Regular Security Audits**: Conduct regular security audits of your application

## Next Steps

- [Rate Limiting](/server/rate-limiting) - Learn more about rate limiting in Verb
- [Sessions](/server/sessions) - Learn how to implement sessions in Verb
- [Middleware](/server/middleware) - Explore middleware in Verb