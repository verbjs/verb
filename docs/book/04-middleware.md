# Chapter 4: Middleware

Middleware functions run before your route handlers. They're used for logging, authentication, parsing, validation, and more.

## How Middleware Works

A middleware function receives three arguments:

```typescript
const middleware = (req, res, next) => {
  // Do something with req or res
  next() // Call next() to continue to the next middleware/handler
}
```

If you don't call `next()`, the request stops there. This is useful for authentication checks.

## Global Middleware

Register middleware that runs on every request:

```typescript
import { createServer } from "verb"

const app = createServer()

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

// All routes below will have logging
app.get("/posts", (req, res) => {
  res.json({ posts: [] })
})
```

## Path-Specific Middleware

Run middleware only for certain paths:

```typescript
// Only run for /api/* routes
app.use("/api", (req, res, next) => {
  console.log("API request")
  next()
})

// Only run for /admin/* routes
app.use("/admin", (req, res, next) => {
  // Check admin access
  next()
})
```

## Route-Specific Middleware

Add middleware to individual routes:

```typescript
const checkAuth = (req, res, next) => {
  const token = req.headers.get("authorization")
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

// Only this route requires auth
app.post("/posts", checkAuth, (req, res) => {
  res.json({ created: true })
})

// Multiple middleware
const validate = (req, res, next) => {
  // validation logic
  next()
}

app.post("/posts", checkAuth, validate, (req, res) => {
  res.json({ created: true })
})
```

## Built-in Middleware

Verb includes common middleware:

### JSON Body Parser

```typescript
import { createServer, middleware } from "verb"

const app = createServer()

// Parse JSON bodies
app.use(middleware.json())

app.post("/posts", async (req, res) => {
  // req.body is now parsed
  const { title, content } = req.body
  res.json({ title, content })
})
```

### URL-Encoded Parser

```typescript
// Parse form data
app.use(middleware.urlencoded())

app.post("/login", (req, res) => {
  const { username, password } = req.body
  res.json({ username })
})
```

### Static Files

```typescript
// Serve files from public/
app.use(middleware.static("./public"))

// Now GET /styles.css serves public/styles.css
```

### CORS

```typescript
app.use(middleware.cors({
  origin: "https://example.com",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}))
```

### Rate Limiting

```typescript
app.use(middleware.rateLimit({
  windowMs: 60000,  // 1 minute
  max: 100,         // 100 requests per minute
}))
```

## Creating Custom Middleware

### Request Timer

```typescript
const timer = (req, res, next) => {
  const start = Date.now()

  // Store original json method
  const originalJson = res.json.bind(res)

  // Override to add timing
  res.json = (data) => {
    const duration = Date.now() - start
    console.log(`${req.method} ${req.path} - ${duration}ms`)
    return originalJson(data)
  }

  next()
}

app.use(timer)
```

### Request ID

```typescript
const requestId = (req, res, next) => {
  const id = crypto.randomUUID()
  req.id = id
  res.header("X-Request-ID", id)
  next()
}

app.use(requestId)
```

### Error Handler

```typescript
const errorHandler = (req, res, next) => {
  try {
    next()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Internal server error" })
  }
}

app.use(errorHandler)
```

## Middleware Order

Middleware runs in the order registered:

```typescript
app.use(logger)       // 1st
app.use(cors)         // 2nd
app.use(json)         // 3rd
app.use("/api", auth) // 4th (only for /api)

app.get("/api/posts", handler) // Handler runs last
```

## Building Blog Middleware

Create `src/middleware/logger.ts`:

```typescript
import type { Middleware } from "verb"

export const logger: Middleware = (req, res, next) => {
  const start = Date.now()
  const { method, path } = req

  // Hook into response completion
  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)
  const originalEnd = res.end.bind(res)

  const logRequest = (status: number) => {
    const duration = Date.now() - start
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${method} ${path} ${status} ${duration}ms`)
  }

  res.json = (data) => {
    logRequest(200)
    return originalJson(data)
  }

  res.send = (data) => {
    logRequest(200)
    return originalSend(data)
  }

  res.end = () => {
    logRequest(204)
    return originalEnd()
  }

  next()
}
```

Create `src/middleware/error.ts`:

```typescript
import type { Middleware } from "verb"

export const errorHandler: Middleware = async (req, res, next) => {
  try {
    await next()
  } catch (error) {
    console.error("Unhandled error:", error)

    const isDev = process.env.NODE_ENV === "development"
    const message = isDev && error instanceof Error
      ? error.message
      : "Internal server error"

    res.status(500).json({ error: message })
  }
}
```

Create `src/middleware/notfound.ts`:

```typescript
import type { Middleware } from "verb"

export const notFound: Middleware = (req, res, next) => {
  // This runs if no route matched
  res.status(404).json({
    error: "Not found",
    path: req.path,
  })
}
```

## Updated Entry Point

Update `src/index.ts`:

```typescript
import { createServer, middleware } from "verb"
import { registerPostRoutes } from "./routes/posts"
import { logger } from "./middleware/logger"
import { errorHandler } from "./middleware/error"

const app = createServer()

// Global middleware
app.use(errorHandler)
app.use(logger)
app.use(middleware.json())

// Static files
app.use(middleware.static("./public"))

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

registerPostRoutes(app)

// Start server
const port = Number(process.env.PORT) || 3000
app.listen(port)

console.log(`Blog running on http://localhost:${port}`)
```

## Summary

You've learned:

- Global, path, and route middleware
- Built-in middleware (JSON, static, CORS)
- Creating custom middleware
- Middleware ordering

Next, we'll add a database to persist our blog posts.

[← Previous: Routing](03-routing.md) | [Next: Working with Data →](05-data-layer.md)
