# Chapter 5: Working with Data

Our blog needs persistent storage. We'll use SQLite with Bun's built-in driver - no external dependencies required.

## SQLite with Bun

Bun includes a native SQLite driver that's fast and simple:

```typescript
import { Database } from "bun:sqlite"

const db = new Database("blog.db")
```

## Setting Up the Database

Create `src/data/database.ts`:

```typescript
import { Database } from "bun:sqlite"

// Create or open database
export const db = new Database("blog.db")

// Enable WAL mode for better performance
db.run("PRAGMA journal_mode = WAL")

// Initialize schema
export const initDatabase = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      published INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS post_categories (
      post_id INTEGER,
      category_id INTEGER,
      PRIMARY KEY (post_id, category_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  console.log("Database initialized")
}
```

## Creating the Post Repository

Create `src/data/posts.ts`:

```typescript
import { db } from "./database"

export type Post = {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export type CreatePost = {
  title: string
  slug: string
  content: string
  excerpt?: string
}

export type UpdatePost = Partial<CreatePost> & {
  published?: boolean
}

// Generate slug from title
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// Get all published posts
export const getPublishedPosts = (): Post[] => {
  const stmt = db.prepare(`
    SELECT * FROM posts
    WHERE published = 1
    ORDER BY created_at DESC
  `)
  return stmt.all() as Post[]
}

// Get all posts (including drafts)
export const getAllPosts = (): Post[] => {
  const stmt = db.prepare(`
    SELECT * FROM posts
    ORDER BY created_at DESC
  `)
  return stmt.all() as Post[]
}

// Get post by ID
export const getPostById = (id: number): Post | null => {
  const stmt = db.prepare("SELECT * FROM posts WHERE id = ?")
  return stmt.get(id) as Post | null
}

// Get post by slug
export const getPostBySlug = (slug: string): Post | null => {
  const stmt = db.prepare("SELECT * FROM posts WHERE slug = ?")
  return stmt.get(slug) as Post | null
}

// Create post
export const createPost = (data: CreatePost): Post => {
  const stmt = db.prepare(`
    INSERT INTO posts (title, slug, content, excerpt)
    VALUES (?, ?, ?, ?)
  `)

  const slug = data.slug || slugify(data.title)
  const result = stmt.run(data.title, slug, data.content, data.excerpt || null)

  return getPostById(Number(result.lastInsertRowid))!
}

// Update post
export const updatePost = (id: number, data: UpdatePost): Post | null => {
  const post = getPostById(id)
  if (!post) return null

  const updates: string[] = []
  const values: any[] = []

  if (data.title !== undefined) {
    updates.push("title = ?")
    values.push(data.title)
  }
  if (data.slug !== undefined) {
    updates.push("slug = ?")
    values.push(data.slug)
  }
  if (data.content !== undefined) {
    updates.push("content = ?")
    values.push(data.content)
  }
  if (data.excerpt !== undefined) {
    updates.push("excerpt = ?")
    values.push(data.excerpt)
  }
  if (data.published !== undefined) {
    updates.push("published = ?")
    values.push(data.published ? 1 : 0)
  }

  if (updates.length === 0) return post

  updates.push("updated_at = CURRENT_TIMESTAMP")
  values.push(id)

  const stmt = db.prepare(`
    UPDATE posts SET ${updates.join(", ")}
    WHERE id = ?
  `)

  stmt.run(...values)
  return getPostById(id)
}

// Delete post
export const deletePost = (id: number): boolean => {
  const stmt = db.prepare("DELETE FROM posts WHERE id = ?")
  const result = stmt.run(id)
  return result.changes > 0
}

// Search posts
export const searchPosts = (query: string): Post[] => {
  const stmt = db.prepare(`
    SELECT * FROM posts
    WHERE published = 1
    AND (title LIKE ? OR content LIKE ?)
    ORDER BY created_at DESC
  `)
  const pattern = `%${query}%`
  return stmt.all(pattern, pattern) as Post[]
}
```

## Creating the Category Repository

Create `src/data/categories.ts`:

```typescript
import { db } from "./database"

export type Category = {
  id: number
  name: string
  slug: string
}

// Get all categories
export const getAllCategories = (): Category[] => {
  const stmt = db.prepare("SELECT * FROM categories ORDER BY name")
  return stmt.all() as Category[]
}

// Get category by slug
export const getCategoryBySlug = (slug: string): Category | null => {
  const stmt = db.prepare("SELECT * FROM categories WHERE slug = ?")
  return stmt.get(slug) as Category | null
}

// Create category
export const createCategory = (name: string, slug: string): Category => {
  const stmt = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
  const result = stmt.run(name, slug)

  return {
    id: Number(result.lastInsertRowid),
    name,
    slug,
  }
}

// Get posts by category
export const getPostsByCategory = (categoryId: number) => {
  const stmt = db.prepare(`
    SELECT p.* FROM posts p
    JOIN post_categories pc ON p.id = pc.post_id
    WHERE pc.category_id = ? AND p.published = 1
    ORDER BY p.created_at DESC
  `)
  return stmt.all(categoryId)
}

// Add category to post
export const addCategoryToPost = (postId: number, categoryId: number) => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO post_categories (post_id, category_id)
    VALUES (?, ?)
  `)
  stmt.run(postId, categoryId)
}

// Remove category from post
export const removeCategoryFromPost = (postId: number, categoryId: number) => {
  const stmt = db.prepare(`
    DELETE FROM post_categories
    WHERE post_id = ? AND category_id = ?
  `)
  stmt.run(postId, categoryId)
}

// Get categories for post
export const getCategoriesForPost = (postId: number): Category[] => {
  const stmt = db.prepare(`
    SELECT c.* FROM categories c
    JOIN post_categories pc ON c.id = pc.category_id
    WHERE pc.post_id = ?
  `)
  return stmt.all(postId) as Category[]
}
```

## Updating Routes

Update `src/routes/posts.ts`:

```typescript
import { createServer } from "verb"
import {
  getPublishedPosts,
  getAllPosts,
  getPostById,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  searchPosts,
  slugify,
} from "../data/posts"

export const registerPostRoutes = (app: ReturnType<typeof createServer>) => {
  // List published posts
  app.get("/posts", (req, res) => {
    const posts = getPublishedPosts()
    res.json({ posts })
  })

  // Search posts
  app.get("/posts/search", (req, res) => {
    const query = req.query.q
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' required" })
    }
    const posts = searchPosts(query)
    res.json({ posts })
  })

  // Get post by slug
  app.get("/posts/:slug", (req, res) => {
    const { slug } = req.params

    // Check if it's a numeric ID
    if (/^\d+$/.test(slug)) {
      const post = getPostById(Number(slug))
      if (!post || !post.published) {
        return res.status(404).json({ error: "Post not found" })
      }
      return res.json({ post })
    }

    // Otherwise treat as slug
    const post = getPostBySlug(slug)
    if (!post || !post.published) {
      return res.status(404).json({ error: "Post not found" })
    }
    res.json({ post })
  })

  // Admin routes (we'll add auth later)
  // List all posts including drafts
  app.get("/admin/posts", (req, res) => {
    const posts = getAllPosts()
    res.json({ posts })
  })

  // Create post
  app.post("/admin/posts", async (req, res) => {
    const body = await req.json()
    const { title, content, excerpt } = body

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content required" })
    }

    try {
      const post = createPost({
        title,
        content,
        excerpt,
        slug: slugify(title),
      })
      res.status(201).json({ post })
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "Slug already exists" })
      }
      throw error
    }
  })

  // Update post
  app.put("/admin/posts/:id(\\d+)", async (req, res) => {
    const id = Number(req.params.id)
    const body = await req.json()

    const post = updatePost(id, body)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    res.json({ post })
  })

  // Publish/unpublish post
  app.patch("/admin/posts/:id(\\d+)/publish", (req, res) => {
    const id = Number(req.params.id)
    const post = updatePost(id, { published: true })

    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    res.json({ post })
  })

  app.patch("/admin/posts/:id(\\d+)/unpublish", (req, res) => {
    const id = Number(req.params.id)
    const post = updatePost(id, { published: false })

    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    res.json({ post })
  })

  // Delete post
  app.delete("/admin/posts/:id(\\d+)", (req, res) => {
    const id = Number(req.params.id)

    if (!deletePost(id)) {
      return res.status(404).json({ error: "Post not found" })
    }

    res.status(204).end()
  })
}
```

## Initializing the Database

Update `src/index.ts`:

```typescript
import { createServer, middleware } from "verb"
import { initDatabase } from "./data/database"
import { registerPostRoutes } from "./routes/posts"
import { logger } from "./middleware/logger"
import { errorHandler } from "./middleware/error"

// Initialize database
initDatabase()

const app = createServer()

// Middleware
app.use(errorHandler)
app.use(logger)
app.use(middleware.json())
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

## Testing the Data Layer

```bash
# Create a post
$ curl -X POST http://localhost:3000/admin/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Post","content":"This is the content"}'

# List all posts
$ curl http://localhost:3000/admin/posts

# Publish the post
$ curl -X PATCH http://localhost:3000/admin/posts/1/publish

# View published posts
$ curl http://localhost:3000/posts

# Get by slug
$ curl http://localhost:3000/posts/my-first-post

# Search
$ curl "http://localhost:3000/posts/search?q=first"
```

## Summary

You've learned:

- Setting up SQLite with Bun
- Creating database schemas
- Building repository functions
- CRUD operations with prepared statements
- Connecting routes to the database

Next, we'll add authentication to protect admin routes.

[← Previous: Middleware](04-middleware.md) | [Next: Authentication →](06-authentication.md)
