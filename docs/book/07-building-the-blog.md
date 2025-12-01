# Chapter 7: Building the Blog

Let's bring everything together into a complete blog application.

## Final Project Structure

```
blog/
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── routes/
│   │   ├── posts.ts
│   │   ├── categories.ts
│   │   ├── auth.ts
│   │   └── pages.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── logger.ts
│   │   └── error.ts
│   ├── data/
│   │   ├── database.ts
│   │   ├── posts.ts
│   │   ├── categories.ts
│   │   ├── users.ts
│   │   └── sessions.ts
│   └── utils/
│       └── markdown.ts
├── public/
│   ├── styles.css
│   └── favicon.ico
├── scripts/
│   └── create-admin.ts
├── package.json
└── tsconfig.json
```

## Configuration

Create `src/config.ts`:

```typescript
export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV !== "production",

  blog: {
    name: process.env.BLOG_NAME || "My Blog",
    description: process.env.BLOG_DESCRIPTION || "A blog built with Verb",
    postsPerPage: 10,
  },

  session: {
    name: "session",
    maxAge: 86400000, // 1 day in ms
    secure: process.env.NODE_ENV === "production",
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },
}
```

## Markdown Support

Create `src/utils/markdown.ts`:

```typescript
// Simple markdown to HTML converter
// For production, consider using a library like marked or remark

export const markdownToHtml = (markdown: string): string => {
  let html = markdown

  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>")
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>")
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>")

  // Bold
  html = html.replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")

  // Italic
  html = html.replace(/\*(.*)\*/gim, "<em>$1</em>")

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/gim, "<pre><code>$2</code></pre>")

  // Inline code
  html = html.replace(/`(.*?)`/gim, "<code>$1</code>")

  // Line breaks
  html = html.replace(/\n/gim, "<br>")

  // Paragraphs
  html = html.replace(/<br><br>/gim, "</p><p>")
  html = `<p>${html}</p>`

  return html
}

// Generate excerpt from content
export const generateExcerpt = (content: string, length = 200): string => {
  // Strip markdown syntax
  let text = content
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")

  if (text.length <= length) return text

  return text.slice(0, length).trim() + "..."
}
```

## Category Routes

Create `src/routes/categories.ts`:

```typescript
import { createServer } from "verb"
import {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  getPostsByCategory,
} from "../data/categories"
import { slugify } from "../data/posts"

export const registerCategoryRoutes = (app: ReturnType<typeof createServer>) => {
  // List all categories
  app.get("/categories", (req, res) => {
    const categories = getAllCategories()
    res.json({ categories })
  })

  // Get category with posts
  app.get("/categories/:slug", (req, res) => {
    const { slug } = req.params
    const category = getCategoryBySlug(slug)

    if (!category) {
      return res.status(404).json({ error: "Category not found" })
    }

    const posts = getPostsByCategory(category.id)
    res.json({ category, posts })
  })

  // Create category (admin only)
  app.post("/admin/categories", async (req, res) => {
    const body = await req.json()
    const { name } = body

    if (!name) {
      return res.status(400).json({ error: "Name required" })
    }

    const slug = slugify(name)

    try {
      const category = createCategory(name, slug)
      res.status(201).json({ category })
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "Category already exists" })
      }
      throw error
    }
  })
}
```

## HTML Pages

Create `src/routes/pages.ts`:

```typescript
import { createServer } from "verb"
import { getPublishedPosts, getPostBySlug } from "../data/posts"
import { getAllCategories } from "../data/categories"
import { markdownToHtml } from "../utils/markdown"
import { config } from "../config"

const layout = (title: string, content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${config.blog.name}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header>
    <nav>
      <a href="/" class="logo">${config.blog.name}</a>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/categories">Categories</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${config.blog.name}</p>
  </footer>
</body>
</html>
`

export const registerPageRoutes = (app: ReturnType<typeof createServer>) => {
  // Home page
  app.get("/", (req, res) => {
    const posts = getPublishedPosts()

    const postList = posts
      .map(
        (post) => `
        <article class="post-card">
          <h2><a href="/blog/${post.slug}">${post.title}</a></h2>
          <p class="excerpt">${post.excerpt || ""}</p>
          <time>${new Date(post.created_at).toLocaleDateString()}</time>
        </article>
      `
      )
      .join("")

    const content = `
      <h1>Latest Posts</h1>
      <div class="posts">
        ${postList || "<p>No posts yet.</p>"}
      </div>
    `

    res.html(layout("Home", content))
  })

  // Single post page
  app.get("/blog/:slug", (req, res) => {
    const { slug } = req.params
    const post = getPostBySlug(slug)

    if (!post || !post.published) {
      return res.status(404).html(
        layout("Not Found", "<h1>Post Not Found</h1><p>The post you're looking for doesn't exist.</p>")
      )
    }

    const content = `
      <article class="post">
        <header>
          <h1>${post.title}</h1>
          <time>${new Date(post.created_at).toLocaleDateString()}</time>
        </header>
        <div class="content">
          ${markdownToHtml(post.content)}
        </div>
      </article>
    `

    res.html(layout(post.title, content))
  })

  // Categories page
  app.get("/categories", (req, res) => {
    const categories = getAllCategories()

    const categoryList = categories
      .map(
        (cat) => `
        <li><a href="/categories/${cat.slug}">${cat.name}</a></li>
      `
      )
      .join("")

    const content = `
      <h1>Categories</h1>
      <ul class="categories">
        ${categoryList || "<p>No categories yet.</p>"}
      </ul>
    `

    res.html(layout("Categories", content))
  })

  // About page
  app.get("/about", (req, res) => {
    const content = `
      <h1>About</h1>
      <p>${config.blog.description}</p>
      <p>Built with <a href="https://github.com/verbjs/verb">Verb</a> and <a href="https://bun.sh">Bun</a>.</p>
    `

    res.html(layout("About", content))
  })
}
```

## Styles

Create `public/styles.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

header {
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  text-decoration: none;
  color: #333;
}

nav ul {
  display: flex;
  list-style: none;
  gap: 20px;
}

nav a {
  text-decoration: none;
  color: #666;
}

nav a:hover {
  color: #000;
}

main {
  min-height: 60vh;
}

h1 {
  margin-bottom: 20px;
}

.posts {
  display: grid;
  gap: 30px;
}

.post-card {
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.post-card h2 {
  margin-bottom: 10px;
}

.post-card h2 a {
  text-decoration: none;
  color: #333;
}

.post-card h2 a:hover {
  color: #0066cc;
}

.excerpt {
  color: #666;
  margin-bottom: 10px;
}

time {
  color: #999;
  font-size: 0.9rem;
}

.post header {
  margin-bottom: 30px;
}

.post .content {
  font-size: 1.1rem;
}

.post .content h2,
.post .content h3 {
  margin-top: 30px;
  margin-bottom: 15px;
}

.post .content p {
  margin-bottom: 15px;
}

.post .content code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.post .content pre {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 20px 0;
}

.post .content pre code {
  background: none;
  padding: 0;
}

.categories {
  list-style: none;
}

.categories li {
  margin-bottom: 10px;
}

.categories a {
  text-decoration: none;
  color: #0066cc;
}

footer {
  margin-top: 60px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  text-align: center;
  color: #999;
}
```

## Final Entry Point

Update `src/index.ts`:

```typescript
import { createServer, middleware } from "verb"
import { config } from "./config"
import { initDatabase } from "./data/database"
import { initSessions, cleanupSessions } from "./data/sessions"
import { registerPostRoutes } from "./routes/posts"
import { registerCategoryRoutes } from "./routes/categories"
import { registerAuthRoutes } from "./routes/auth"
import { registerPageRoutes } from "./routes/pages"
import { logger } from "./middleware/logger"
import { errorHandler } from "./middleware/error"
import { requireAuth } from "./middleware/auth"

// Initialize
initDatabase()
initSessions()
setInterval(cleanupSessions, 3600000)

const app = createServer()

// Global middleware
app.use(errorHandler)
app.use(logger)
app.use(middleware.json())
app.use(middleware.cors({ origin: config.cors.origin }))

// Static files
app.use(middleware.static("./public"))

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    name: config.blog.name,
    env: config.env,
  })
})

// API routes
app.get("/api/info", (req, res) => {
  res.json({
    name: config.blog.name,
    description: config.blog.description,
  })
})

// Auth routes
registerAuthRoutes(app)

// Protected admin routes
app.use("/admin", requireAuth)

// Post and category routes
registerPostRoutes(app)
registerCategoryRoutes(app)

// HTML pages (should be last to not conflict with API routes)
registerPageRoutes(app)

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: "Not found", path: req.path })
})

// Start server
app.listen(config.port)

console.log(`
${config.blog.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: ${config.env}
Server:      http://localhost:${config.port}
API:         http://localhost:${config.port}/api/info
Health:      http://localhost:${config.port}/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
```

## Seeding Data

Create `scripts/seed.ts`:

```typescript
import { initDatabase } from "../src/data/database"
import { initSessions } from "../src/data/sessions"
import { createUser } from "../src/data/users"
import { createPost, updatePost } from "../src/data/posts"
import { createCategory, addCategoryToPost } from "../src/data/categories"

const seed = async () => {
  initDatabase()
  initSessions()

  console.log("Seeding database...")

  // Create admin user
  const admin = await createUser("admin", "adminpass123")
  console.log("Created admin user")

  // Create categories
  const techCat = createCategory("Technology", "technology")
  const tutorialCat = createCategory("Tutorials", "tutorials")
  console.log("Created categories")

  // Create posts
  const post1 = createPost({
    title: "Welcome to My Blog",
    slug: "welcome",
    content: `# Welcome!

This is my new blog built with **Verb** and **Bun**.

## What to expect

I'll be writing about:
- Web development
- TypeScript
- Performance optimization

Stay tuned for more posts!`,
    excerpt: "Welcome to my new blog built with Verb and Bun.",
  })
  updatePost(post1.id, { published: true })
  addCategoryToPost(post1.id, techCat.id)

  const post2 = createPost({
    title: "Getting Started with Verb",
    slug: "getting-started-with-verb",
    content: `# Getting Started with Verb

Verb is a fast server framework for Bun. Here's how to get started:

\`\`\`typescript
import { createServer } from "verb"

const app = createServer()

app.get("/", (req, res) => {
  res.json({ hello: "world" })
})

app.listen(3000)
\`\`\`

That's it! Your server is running.`,
    excerpt: "Learn how to build web applications with Verb and Bun.",
  })
  updatePost(post2.id, { published: true })
  addCategoryToPost(post2.id, tutorialCat.id)
  addCategoryToPost(post2.id, techCat.id)

  console.log("Created posts")
  console.log("Seeding complete!")
}

seed().catch(console.error)
```

Run it:

```bash
$ bun scripts/seed.ts
```

## Running the Blog

```bash
$ bun run dev
```

Visit:
- Home page: http://localhost:3000
- API posts: http://localhost:3000/posts
- Single post: http://localhost:3000/blog/welcome
- Categories: http://localhost:3000/categories

## Summary

You've built a complete blog with:

- Public pages with HTML rendering
- JSON API endpoints
- Markdown content
- Categories
- Admin authentication
- CRUD operations
- Static file serving

Next, we'll deploy it to production.

[← Previous: Authentication](06-authentication.md) | [Next: Deployment →](08-deployment.md)
