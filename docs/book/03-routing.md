# Chapter 3: Routing

Routing maps URLs to handler functions. Verb provides a simple, intuitive routing API.

## Basic Routes

Register routes with HTTP method functions:

```typescript
import { createServer } from "verb"

const app = createServer()

app.get("/posts", (req, res) => {
  res.json({ posts: [] })
})

app.post("/posts", (req, res) => {
  res.status(201).json({ created: true })
})

app.put("/posts/:id", (req, res) => {
  res.json({ updated: true })
})

app.delete("/posts/:id", (req, res) => {
  res.status(204).end()
})
```

Available methods: `get`, `post`, `put`, `delete`, `patch`, `head`, `options`.

## Route Parameters

Capture dynamic segments with `:param`:

```typescript
// Single parameter
app.get("/posts/:id", (req, res) => {
  const { id } = req.params
  res.json({ postId: id })
})

// Multiple parameters
app.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params
  res.json({ userId, postId })
})
```

### Parameter Constraints

Add regex constraints to parameters:

```typescript
// Only match numeric IDs
app.get("/posts/:id(\\d+)", (req, res) => {
  const id = Number(req.params.id)
  res.json({ id })
})

// This won't match /posts/abc, only /posts/123
```

## Wildcard Routes

Capture everything with `*`:

```typescript
app.get("/files/*", (req, res) => {
  const path = req.params["*"]
  res.json({ filePath: path })
})

// GET /files/images/photo.jpg
// { filePath: "images/photo.jpg" }
```

## Route Chaining

Chain methods for the same path:

```typescript
app.route("/posts/:id")
  .get((req, res) => {
    res.json({ action: "get post" })
  })
  .put((req, res) => {
    res.json({ action: "update post" })
  })
  .delete((req, res) => {
    res.status(204).end()
  })
```

## Multiple Paths

Register a handler for multiple paths:

```typescript
app.get(["/posts", "/articles"], (req, res) => {
  res.json({ posts: [] })
})
```

## Request Object

The request object provides:

```typescript
app.get("/example", (req, res) => {
  // URL and path
  req.url        // "http://localhost:3000/example?page=1"
  req.path       // "/example"

  // Parameters
  req.params     // Route params: { id: "123" }
  req.query      // Query string: { page: "1" }

  // Headers
  req.headers.get("content-type")
  req.get("content-type")  // Shorthand

  // Body (for POST/PUT)
  const body = await req.json()

  // Client info
  req.ip         // Client IP address
  req.hostname   // Request hostname
  req.protocol   // "http" or "https"
  req.secure     // true if HTTPS
  req.xhr        // true if XMLHttpRequest

  // Content negotiation
  req.accepts("json")           // Check Accept header
  req.acceptsCharsets("utf-8")
  req.acceptsEncodings("gzip")
  req.acceptsLanguages("en")
})
```

## Response Object

The response object is chainable:

```typescript
app.get("/example", (req, res) => {
  // JSON response
  res.json({ data: "value" })

  // Text response
  res.send("Hello")

  // HTML response
  res.html("<h1>Hello</h1>")

  // Status codes
  res.status(201).json({ created: true })

  // Headers
  res.header("X-Custom", "value")
  res.headers({ "X-One": "1", "X-Two": "2" })

  // Redirects
  res.redirect("/new-location")
  res.redirect(301, "/permanent-location")

  // Cookies
  res.cookie("session", "abc123", { httpOnly: true })
  res.clearCookie("session")

  // End without body
  res.status(204).end()
})
```

## Building Blog Routes

Let's create routes for our blog. Create `src/routes/posts.ts`:

```typescript
import { createServer } from "verb"

// In-memory posts for now (we'll add a database later)
const posts = [
  { id: 1, title: "First Post", content: "Hello world!", published: true },
  { id: 2, title: "Draft Post", content: "Work in progress", published: false },
]

export const registerPostRoutes = (app: ReturnType<typeof createServer>) => {
  // List all published posts
  app.get("/posts", (req, res) => {
    const published = posts.filter(p => p.published)
    res.json({ posts: published })
  })

  // Get single post
  app.get("/posts/:id(\\d+)", (req, res) => {
    const id = Number(req.params.id)
    const post = posts.find(p => p.id === id && p.published)

    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    res.json({ post })
  })

  // Create post (will add auth later)
  app.post("/posts", async (req, res) => {
    const body = await req.json()
    const { title, content } = body

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content required" })
    }

    const newPost = {
      id: posts.length + 1,
      title,
      content,
      published: false,
    }

    posts.push(newPost)
    res.status(201).json({ post: newPost })
  })

  // Update post
  app.put("/posts/:id(\\d+)", async (req, res) => {
    const id = Number(req.params.id)
    const post = posts.find(p => p.id === id)

    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    const body = await req.json()
    Object.assign(post, body)

    res.json({ post })
  })

  // Delete post
  app.delete("/posts/:id(\\d+)", (req, res) => {
    const id = Number(req.params.id)
    const index = posts.findIndex(p => p.id === id)

    if (index === -1) {
      return res.status(404).json({ error: "Post not found" })
    }

    posts.splice(index, 1)
    res.status(204).end()
  })
}
```

## Updating the Entry Point

Update `src/index.ts`:

```typescript
import { createServer } from "verb"
import { registerPostRoutes } from "./routes/posts"

const app = createServer()

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

// Register routes
registerPostRoutes(app)

// Start server
const port = Number(process.env.PORT) || 3000
app.listen(port)

console.log(`Blog running on http://localhost:${port}`)
```

## Testing the Routes

```bash
# List posts
$ curl http://localhost:3000/posts

# Get single post
$ curl http://localhost:3000/posts/1

# Create post
$ curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"New Post","content":"Content here"}'

# Update post
$ curl -X PUT http://localhost:3000/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"published":true}'

# Delete post
$ curl -X DELETE http://localhost:3000/posts/1
```

## Summary

You've learned:

- Basic route registration
- Route parameters and constraints
- Request and response objects
- Building CRUD routes

Next, we'll add middleware for logging, error handling, and more.

[← Previous: Getting Started](02-getting-started.md) | [Next: Middleware →](04-middleware.md)
