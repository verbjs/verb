# Chapter 6: Authentication

Our admin routes need protection. We'll implement session-based authentication with secure password hashing.

## Password Hashing

Bun includes a built-in password hashing API using bcrypt:

```typescript
// Hash a password
const hash = await Bun.password.hash("mypassword")

// Verify a password
const valid = await Bun.password.verify("mypassword", hash)
```

## User Repository

Create `src/data/users.ts`:

```typescript
import { db } from "./database"

export type User = {
  id: number
  username: string
  password_hash: string
  created_at: string
}

export type SafeUser = Omit<User, "password_hash">

// Get user by username
export const getUserByUsername = (username: string): User | null => {
  const stmt = db.prepare("SELECT * FROM users WHERE username = ?")
  return stmt.get(username) as User | null
}

// Get user by ID
export const getUserById = (id: number): User | null => {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?")
  return stmt.get(id) as User | null
}

// Create user
export const createUser = async (
  username: string,
  password: string
): Promise<SafeUser> => {
  const hash = await Bun.password.hash(password)

  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash)
    VALUES (?, ?)
  `)

  const result = stmt.run(username, hash)

  return {
    id: Number(result.lastInsertRowid),
    username,
    created_at: new Date().toISOString(),
  }
}

// Verify password
export const verifyPassword = async (
  user: User,
  password: string
): Promise<boolean> => {
  return Bun.password.verify(password, user.password_hash)
}

// Remove sensitive data
export const toSafeUser = (user: User): SafeUser => {
  const { password_hash, ...safe } = user
  return safe
}
```

## Session Management

Create `src/data/sessions.ts`:

```typescript
import { db } from "./database"

export type Session = {
  id: string
  user_id: number
  created_at: string
  expires_at: string
}

// Initialize sessions table
export const initSessions = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
}

// Create session
export const createSession = (userId: number, expiresIn = 86400000): Session => {
  const id = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresIn)

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `)

  stmt.run(id, userId, expiresAt.toISOString())

  return {
    id,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  }
}

// Get session
export const getSession = (id: string): Session | null => {
  const stmt = db.prepare(`
    SELECT * FROM sessions
    WHERE id = ? AND expires_at > datetime('now')
  `)
  return stmt.get(id) as Session | null
}

// Delete session
export const deleteSession = (id: string): void => {
  const stmt = db.prepare("DELETE FROM sessions WHERE id = ?")
  stmt.run(id)
}

// Delete expired sessions
export const cleanupSessions = (): void => {
  const stmt = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')")
  stmt.run()
}

// Delete all sessions for user
export const deleteUserSessions = (userId: number): void => {
  const stmt = db.prepare("DELETE FROM sessions WHERE user_id = ?")
  stmt.run(userId)
}
```

## Authentication Middleware

Create `src/middleware/auth.ts`:

```typescript
import type { Middleware, Request, Response } from "verb"
import { getSession } from "../data/sessions"
import { getUserById, toSafeUser, type SafeUser } from "../data/users"

// Extend request type to include user
declare module "verb" {
  interface Request {
    user?: SafeUser
    sessionId?: string
  }
}

// Extract session ID from cookie or header
const getSessionId = (req: Request): string | null => {
  // Check Authorization header first
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }

  // Check cookie
  const cookies = req.cookies
  return cookies?.session || null
}

// Require authentication
export const requireAuth: Middleware = (req, res, next) => {
  const sessionId = getSessionId(req)

  if (!sessionId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const session = getSession(sessionId)
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" })
  }

  const user = getUserById(session.user_id)
  if (!user) {
    return res.status(401).json({ error: "User not found" })
  }

  // Attach user to request
  req.user = toSafeUser(user)
  req.sessionId = sessionId

  next()
}

// Optional authentication (doesn't block request)
export const optionalAuth: Middleware = (req, res, next) => {
  const sessionId = getSessionId(req)

  if (sessionId) {
    const session = getSession(sessionId)
    if (session) {
      const user = getUserById(session.user_id)
      if (user) {
        req.user = toSafeUser(user)
        req.sessionId = sessionId
      }
    }
  }

  next()
}
```

## Auth Routes

Create `src/routes/auth.ts`:

```typescript
import { createServer } from "verb"
import {
  getUserByUsername,
  createUser,
  verifyPassword,
  toSafeUser,
} from "../data/users"
import {
  createSession,
  deleteSession,
  deleteUserSessions,
} from "../data/sessions"

export const registerAuthRoutes = (app: ReturnType<typeof createServer>) => {
  // Register new user
  app.post("/auth/register", async (req, res) => {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" })
    }

    // Check if username exists
    if (getUserByUsername(username)) {
      return res.status(400).json({ error: "Username already taken" })
    }

    try {
      const user = await createUser(username, password)
      const session = createSession(user.id)

      res
        .status(201)
        .cookie("session", session.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 86400, // 1 day
        })
        .json({ user, token: session.id })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({ error: "Registration failed" })
    }
  })

  // Login
  app.post("/auth/login", async (req, res) => {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" })
    }

    const user = getUserByUsername(username)
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const valid = await verifyPassword(user, password)
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const session = createSession(user.id)

    res
      .cookie("session", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400,
      })
      .json({ user: toSafeUser(user), token: session.id })
  })

  // Logout
  app.post("/auth/logout", (req, res) => {
    const sessionId = req.cookies?.session

    if (sessionId) {
      deleteSession(sessionId)
    }

    res
      .clearCookie("session")
      .json({ message: "Logged out" })
  })

  // Get current user
  app.get("/auth/me", (req, res) => {
    // This route uses requireAuth middleware in the main file
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" })
    }

    res.json({ user: req.user })
  })

  // Change password
  app.post("/auth/change-password", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" })
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" })
    }

    const user = getUserByUsername(req.user.username)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const valid = await verifyPassword(user, currentPassword)
    if (!valid) {
      return res.status(401).json({ error: "Current password incorrect" })
    }

    // Update password
    const hash = await Bun.password.hash(newPassword)
    const stmt = require("../data/database").db.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ?"
    )
    stmt.run(hash, user.id)

    // Invalidate all other sessions
    deleteUserSessions(user.id)

    // Create new session
    const session = createSession(user.id)

    res
      .cookie("session", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400,
      })
      .json({ message: "Password changed", token: session.id })
  })
}
```

## Protecting Admin Routes

Update `src/index.ts`:

```typescript
import { createServer, middleware } from "verb"
import { initDatabase } from "./data/database"
import { initSessions, cleanupSessions } from "./data/sessions"
import { registerPostRoutes } from "./routes/posts"
import { registerAuthRoutes } from "./routes/auth"
import { logger } from "./middleware/logger"
import { errorHandler } from "./middleware/error"
import { requireAuth } from "./middleware/auth"

// Initialize database
initDatabase()
initSessions()

// Cleanup expired sessions periodically
setInterval(cleanupSessions, 3600000) // Every hour

const app = createServer()

// Global middleware
app.use(errorHandler)
app.use(logger)
app.use(middleware.json())
app.use(middleware.static("./public"))

// Public routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

// Auth routes
registerAuthRoutes(app)

// Protected admin routes
app.use("/admin", requireAuth)
app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// Post routes (includes public and admin)
registerPostRoutes(app)

// Start server
const port = Number(process.env.PORT) || 3000
app.listen(port)

console.log(`Blog running on http://localhost:${port}`)
```

## Creating an Admin User

Create a setup script `scripts/create-admin.ts`:

```typescript
import { initDatabase } from "../src/data/database"
import { initSessions } from "../src/data/sessions"
import { createUser, getUserByUsername } from "../src/data/users"

const main = async () => {
  initDatabase()
  initSessions()

  const username = process.argv[2] || "admin"
  const password = process.argv[3] || "adminpass"

  if (getUserByUsername(username)) {
    console.log(`User '${username}' already exists`)
    process.exit(1)
  }

  const user = await createUser(username, password)
  console.log(`Created admin user: ${user.username}`)
}

main().catch(console.error)
```

Run it:

```bash
$ bun scripts/create-admin.ts admin securepassword123
Created admin user: admin
```

## Testing Authentication

```bash
# Register
$ curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# Login
$ curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"securepassword123"}'
# Returns: { "user": {...}, "token": "uuid-session-id" }

# Use token for admin routes
$ curl http://localhost:3000/admin/posts \
  -H "Authorization: Bearer uuid-session-id"

# Or with cookie
$ curl -X POST http://localhost:3000/admin/posts \
  -H "Content-Type: application/json" \
  -H "Cookie: session=uuid-session-id" \
  -d '{"title":"Protected Post","content":"Only admins can create"}'

# Logout
$ curl -X POST http://localhost:3000/auth/logout \
  -H "Cookie: session=uuid-session-id"
```

## Summary

You've learned:

- Password hashing with Bun
- Session-based authentication
- Auth middleware for protecting routes
- Login, logout, and registration flows
- Cookie and Bearer token authentication

Next, we'll bring everything together into the final blog application.

[← Previous: Working with Data](05-data-layer.md) | [Next: Building the Blog →](07-building-the-blog.md)
