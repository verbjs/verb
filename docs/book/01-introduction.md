# Chapter 1: Introduction

## What is Verb?

Verb is a fast, lightweight server framework built exclusively for the Bun runtime. It provides a familiar Express-like API while leveraging Bun's native performance.

### Key Features

- **Zero dependencies** - Uses only Bun's built-in APIs
- **Multi-protocol** - HTTP, HTTPS, HTTP/2, WebSocket, gRPC, and more
- **Type-safe** - Full TypeScript support
- **Simple routing** - Intuitive path matching with parameters
- **Middleware support** - Global, path-based, and route-specific

### Why Verb?

Verb is designed for developers who want:

1. **Simplicity** - One router, one API, no complexity
2. **Performance** - Native Bun APIs, no overhead
3. **Familiarity** - Express-like patterns you already know
4. **Type safety** - Full TypeScript from the ground up

## A Quick Example

```typescript
import { createServer } from "verb"

const app = createServer()

app.get("/", (req, res) => {
  res.json({ message: "Hello, Verb!" })
})

app.listen(3000)
console.log("Server running on http://localhost:3000")
```

Run it:

```bash
bun run server.ts
```

That's it. No configuration, no boilerplate.

## How This Book Works

Each chapter builds on the previous one. We start with basics and progressively add features until we have a complete blog application.

**Chapter 2** covers project setup and installation.

**Chapter 3** dives into routing - the core of any web application.

**Chapter 4** explains middleware for cross-cutting concerns.

**Chapter 5** adds data persistence with SQLite.

**Chapter 6** implements authentication.

**Chapter 7** brings everything together into the final blog.

**Chapter 8** covers deployment to production.

## Conventions Used

Code examples use TypeScript. File paths are shown relative to the project root:

```
blog/
├── src/
│   ├── index.ts
│   ├── routes/
│   └── middleware/
├── public/
└── package.json
```

Terminal commands are prefixed with `$`:

```bash
$ bun install
$ bun run dev
```

Let's get started.

[Next: Getting Started →](02-getting-started.md)
