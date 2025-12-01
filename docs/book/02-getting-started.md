# Chapter 2: Getting Started

## Installing Bun

Verb requires Bun v1.0.0 or higher. Install Bun:

```bash
# macOS/Linux
$ curl -fsSL https://bun.sh/install | bash

# Windows
$ powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify installation:

```bash
$ bun --version
1.2.0
```

## Creating the Project

Create a new directory for your blog:

```bash
$ mkdir blog
$ cd blog
$ bun init -y
```

This creates a basic `package.json`. Now install Verb:

```bash
$ bun add verb
```

## Project Structure

Create the following structure:

```
blog/
├── src/
│   ├── index.ts        # Entry point
│   ├── routes/         # Route handlers
│   │   ├── posts.ts
│   │   └── admin.ts
│   ├── middleware/     # Custom middleware
│   │   └── auth.ts
│   └── data/           # Data layer
│       └── posts.ts
├── public/             # Static files
│   └── styles.css
├── package.json
└── tsconfig.json
```

Create directories:

```bash
$ mkdir -p src/routes src/middleware src/data public
```

## TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

## Your First Server

Create `src/index.ts`:

```typescript
import { createServer } from "verb"

const app = createServer()

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() })
})

// Start server
const port = Number(process.env.PORT) || 3000
app.listen(port)

console.log(`Blog running on http://localhost:${port}`)
```

## Running the Server

Add scripts to `package.json`:

```json
{
  "name": "blog",
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts"
  },
  "dependencies": {
    "verb": "^1.0.0"
  }
}
```

Start the development server:

```bash
$ bun run dev
Blog running on http://localhost:3000
```

The `--hot` flag enables hot reloading. Changes to your code automatically restart the server.

## Testing the Endpoint

```bash
$ curl http://localhost:3000/health
{"status":"ok","timestamp":1701234567890}
```

## Environment Variables

Create `.env` for configuration:

```
PORT=3000
NODE_ENV=development
```

Bun automatically loads `.env` files. Access variables via `process.env`:

```typescript
const port = Number(process.env.PORT) || 3000
const isDev = process.env.NODE_ENV === "development"
```

## Summary

You now have:

- Bun installed
- A project structure
- A running Verb server
- Hot reloading for development

Next, we'll add routes for our blog posts.

[← Previous: Introduction](01-introduction.md) | [Next: Routing →](03-routing.md)
