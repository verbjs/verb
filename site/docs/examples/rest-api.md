# REST API Example

Complete example of building a RESTful API with Verb, including CRUD operations, validation, authentication, and database integration.

## Overview

This example demonstrates how to build a complete REST API for a blog platform with users, posts, and comments. It includes:

- User authentication and authorization
- CRUD operations for resources
- Input validation and error handling
- Database integration
- API documentation
- Testing

## Project Setup

```bash
# Create new project
mkdir blog-api
cd blog-api
bun init -y

# Install dependencies
bun install verb
bun install -D @types/bun typescript

# Install additional packages
bun install bcryptjs jsonwebtoken zod
```

## Database Schema

```typescript
// db/schema.ts
export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  authorId: string;
  published: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  parentId?: string; // For nested comments
  createdAt: Date;
  updatedAt: Date;
}
```

## Server Setup

```typescript
// server.ts
import { createServer } from "verb";
import { cors, json, rateLimit, helmet } from "verb/middleware";
import { authRouter } from "./routes/auth";
import { postsRouter } from "./routes/posts";
import { usersRouter } from "./routes/users";
import { commentsRouter } from "./routes/comments";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./middleware/logger";

const app = createServer();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true
}));
app.use(json({ limit: "10mb" }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // requests per window
}));
app.use(logger);

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/posts", postsRouter);
app.use("/api/comments", commentsRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API documentation
app.get("/", (req, res) => {
  res.json({
    name: "Blog REST API",
    version: "1.0.0",
    description: "RESTful API for blog platform",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      posts: "/api/posts",
      comments: "/api/comments"
    },
    documentation: "/docs"
  });
});

// Error handling (must be last)
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port);

console.log(`🚀 Blog API server running on port ${port}`);
```

## Authentication

```typescript
// routes/auth.ts
import { createServer } from "verb";
import { hash, compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { z } from "zod";
import { validate } from "../middleware/validation";
import { asyncHandler } from "../middleware/asyncHandler";
import { UserService } from "../services/UserService";

const authRouter = createServer();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Register
authRouter.post("/register", 
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, username, password, firstName, lastName } = req.body;
    
    // Check if user exists
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: "User already exists",
        code: "USER_EXISTS"
      });
    }
    
    // Check username availability
    const existingUsername = await UserService.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        error: "Username already taken",
        code: "USERNAME_TAKEN"
      });
    }
    
    // Hash password
    const passwordHash = await hash(password, 12);
    
    // Create user
    const user = await UserService.create({
      email,
      username,
      passwordHash,
      firstName,
      lastName,
      role: "user"
    });
    
    // Generate JWT
    const token = sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      token
    });
  })
);

// Login
authRouter.post("/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    // Find user
    const user = await UserService.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }
    
    // Verify password
    const validPassword = await compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }
    
    // Generate JWT
    const token = sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      token
    });
  })
);

// Get current user
authRouter.get("/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await UserService.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  })
);

// Refresh token
authRouter.post("/refresh",
  authenticate,
  asyncHandler(async (req, res) => {
    const token = sign(
      { userId: req.user.userId, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    
    res.json({ token });
  })
);

export { authRouter };
```

## Posts CRUD API

```typescript
// routes/posts.ts
import { createServer } from "verb";
import { z } from "zod";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { PostService } from "../services/PostService";
import { slugify } from "../utils/slugify";

const postsRouter = createServer();

// Validation schemas
const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional()
});

const updatePostSchema = createPostSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
  published: z.coerce.boolean().optional()
});

// Get all posts
postsRouter.get("/",
  validate(querySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, limit, search, tag, author, published } = req.query;
    
    const result = await PostService.findMany({
      page,
      limit,
      search,
      tag,
      author,
      published: published ?? true // Default to published posts only
    });
    
    res.json({
      posts: result.posts,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit)
      }
    });
  })
);

// Get post by ID or slug
postsRouter.get("/:identifier",
  asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let post = await PostService.findById(identifier);
    if (!post) {
      post = await PostService.findBySlug(identifier);
    }
    
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
        code: "POST_NOT_FOUND"
      });
    }
    
    // Only show unpublished posts to authors and admins
    if (!post.published && (!req.user || (req.user.userId !== post.authorId && req.user.role !== "admin"))) {
      return res.status(404).json({
        error: "Post not found",
        code: "POST_NOT_FOUND"
      });
    }
    
    res.json({ post });
  })
);

// Create post
postsRouter.post("/",
  authenticate,
  validate(createPostSchema),
  asyncHandler(async (req, res) => {
    const { title, content, excerpt, tags = [], published = false } = req.body;
    const authorId = req.user.userId;
    
    // Generate slug
    const baseSlug = slugify(title);
    const slug = await PostService.generateUniqueSlug(baseSlug);
    
    const post = await PostService.create({
      title,
      content,
      excerpt: excerpt || content.substring(0, 200) + "...",
      slug,
      authorId,
      published,
      tags
    });
    
    res.status(201).json({
      message: "Post created successfully",
      post
    });
  })
);

// Update post
postsRouter.put("/:id",
  authenticate,
  validate(updatePostSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    
    const post = await PostService.findById(id);
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
        code: "POST_NOT_FOUND"
      });
    }
    
    // Check ownership
    if (post.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized to update this post",
        code: "NOT_AUTHORIZED"
      });
    }
    
    // Update slug if title changed
    if (updateData.title && updateData.title !== post.title) {
      const baseSlug = slugify(updateData.title);
      updateData.slug = await PostService.generateUniqueSlug(baseSlug, id);
    }
    
    const updatedPost = await PostService.update(id, updateData);
    
    res.json({
      message: "Post updated successfully",
      post: updatedPost
    });
  })
);

// Delete post
postsRouter.delete("/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const post = await PostService.findById(id);
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
        code: "POST_NOT_FOUND"
      });
    }
    
    // Check ownership
    if (post.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized to delete this post",
        code: "NOT_AUTHORIZED"
      });
    }
    
    await PostService.delete(id);
    
    res.json({
      message: "Post deleted successfully"
    });
  })
);

// Publish/unpublish post
postsRouter.patch("/:id/publish",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { published } = req.body;
    
    const post = await PostService.findById(id);
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
        code: "POST_NOT_FOUND"
      });
    }
    
    // Check ownership
    if (post.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized to modify this post",
        code: "NOT_AUTHORIZED"
      });
    }
    
    const updatedPost = await PostService.update(id, { published });
    
    res.json({
      message: `Post ${published ? "published" : "unpublished"} successfully`,
      post: updatedPost
    });
  })
);

export { postsRouter };
```

## Comments API

```typescript
// routes/comments.ts
import { createServer } from "verb";
import { z } from "zod";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { CommentService } from "../services/CommentService";
import { PostService } from "../services/PostService";

const commentsRouter = createServer();

// Validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  postId: z.string(),
  parentId: z.string().optional()
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(1000)
});

// Get comments for a post
commentsRouter.get("/post/:postId",
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Verify post exists
    const post = await PostService.findById(postId);
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
        code: "POST_NOT_FOUND"
      });
    }
    
    const result = await CommentService.findByPost(postId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      comments: result.comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit))
      }
    });
  })
);

// Create comment
commentsRouter.post("/",
  authenticate,
  validate(createCommentSchema),
  asyncHandler(async (req, res) => {
    const { content, postId, parentId } = req.body;
    const authorId = req.user.userId;
    
    // Verify post exists
    const post = await PostService.findById(postId);
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
        code: "POST_NOT_FOUND"
      });
    }
    
    // Verify parent comment exists if provided
    if (parentId) {
      const parentComment = await CommentService.findById(parentId);
      if (!parentComment || parentComment.postId !== postId) {
        return res.status(404).json({
          error: "Parent comment not found",
          code: "PARENT_COMMENT_NOT_FOUND"
        });
      }
    }
    
    const comment = await CommentService.create({
      content,
      postId,
      authorId,
      parentId
    });
    
    res.status(201).json({
      message: "Comment created successfully",
      comment
    });
  })
);

// Update comment
commentsRouter.put("/:id",
  authenticate,
  validate(updateCommentSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    
    const comment = await CommentService.findById(id);
    if (!comment) {
      return res.status(404).json({
        error: "Comment not found",
        code: "COMMENT_NOT_FOUND"
      });
    }
    
    // Check ownership
    if (comment.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized to update this comment",
        code: "NOT_AUTHORIZED"
      });
    }
    
    const updatedComment = await CommentService.update(id, { content });
    
    res.json({
      message: "Comment updated successfully",
      comment: updatedComment
    });
  })
);

// Delete comment
commentsRouter.delete("/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const comment = await CommentService.findById(id);
    if (!comment) {
      return res.status(404).json({
        error: "Comment not found",
        code: "COMMENT_NOT_FOUND"
      });
    }
    
    // Check ownership
    if (comment.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Not authorized to delete this comment",
        code: "NOT_AUTHORIZED"
      });
    }
    
    await CommentService.delete(id);
    
    res.json({
      message: "Comment deleted successfully"
    });
  })
);

export { commentsRouter };
```

## Middleware

```typescript
// middleware/auth.ts
import { verify } from "jsonwebtoken";
import { asyncHandler } from "./asyncHandler";

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }
  
  try {
    const decoded = verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN"
    });
  }
});

export const authorize = (roles: string[]) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS"
      });
    }
    
    next();
  };
};

// middleware/validation.ts
export const validate = (schema, source = "body") => {
  return (req, res, next) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);
      req[source] = validated;
      next();
    } catch (error) {
      return res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }
  };
};

// middleware/asyncHandler.ts
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// middleware/errorHandler.ts
export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);
  
  // Database errors
  if (err.code === "23505") { // Unique constraint violation
    return res.status(409).json({
      error: "Resource already exists",
      code: "DUPLICATE_RESOURCE"
    });
  }
  
  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.details
    });
  }
  
  // Default error
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
};
```

## Database Services

```typescript
// services/PostService.ts
import { Database } from "bun:sqlite";

const db = new Database("blog.db");

export class PostService {
  static async findMany(options: {
    page: number;
    limit: number;
    search?: string;
    tag?: string;
    author?: string;
    published?: boolean;
  }) {
    let query = `
      SELECT p.*, u.username as authorUsername, u.firstName, u.lastName
      FROM posts p
      JOIN users u ON p.authorId = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (options.published !== undefined) {
      query += ` AND p.published = ?`;
      params.push(options.published);
    }
    
    if (options.search) {
      query += ` AND (p.title LIKE ? OR p.content LIKE ?)`;
      params.push(`%${options.search}%`, `%${options.search}%`);
    }
    
    if (options.tag) {
      query += ` AND p.tags LIKE ?`;
      params.push(`%${options.tag}%`);
    }
    
    if (options.author) {
      query += ` AND u.username = ?`;
      params.push(options.author);
    }
    
    // Count total
    const countQuery = query.replace("SELECT p.*, u.username as authorUsername, u.firstName, u.lastName", "SELECT COUNT(*) as count");
    const countResult = db.query(countQuery).get(...params) as any;
    const total = countResult.count;
    
    // Add pagination
    query += ` ORDER BY p.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(options.limit, (options.page - 1) * options.limit);
    
    const posts = db.query(query).all(...params);
    
    return {
      posts: posts.map(post => ({
        ...post,
        tags: JSON.parse(post.tags || "[]"),
        author: {
          username: post.authorUsername,
          firstName: post.firstName,
          lastName: post.lastName
        }
      })),
      total
    };
  }
  
  static async findById(id: string) {
    const post = db.query(`
      SELECT p.*, u.username as authorUsername, u.firstName, u.lastName
      FROM posts p
      JOIN users u ON p.authorId = u.id
      WHERE p.id = ?
    `).get(id);
    
    if (!post) return null;
    
    return {
      ...post,
      tags: JSON.parse(post.tags || "[]"),
      author: {
        username: post.authorUsername,
        firstName: post.firstName,
        lastName: post.lastName
      }
    };
  }
  
  static async create(data: Omit<Post, "id" | "createdAt" | "updatedAt">) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    db.query(`
      INSERT INTO posts (id, title, content, excerpt, slug, authorId, published, tags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.content,
      data.excerpt,
      data.slug,
      data.authorId,
      data.published,
      JSON.stringify(data.tags),
      now,
      now
    );
    
    return this.findById(id);
  }
  
  static async update(id: string, data: Partial<Post>) {
    const updates = Object.keys(data).map(key => `${key} = ?`).join(", ");
    const values = Object.values(data);
    
    if (data.tags) {
      data.tags = JSON.stringify(data.tags);
    }
    
    db.query(`
      UPDATE posts 
      SET ${updates}, updatedAt = ?
      WHERE id = ?
    `).run(...values, new Date().toISOString(), id);
    
    return this.findById(id);
  }
  
  static async delete(id: string) {
    return db.query("DELETE FROM posts WHERE id = ?").run(id);
  }
  
  static async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
      let query = "SELECT id FROM posts WHERE slug = ?";
      const params = [slug];
      
      if (excludeId) {
        query += " AND id != ?";
        params.push(excludeId);
      }
      
      const existing = db.query(query).get(...params);
      
      if (!existing) {
        return slug;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
}
```

## Testing

```typescript
// tests/posts.test.ts
import { test, expect, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import { app } from "../server";
import { Database } from "bun:sqlite";

let authToken: string;
let testUserId: string;

beforeAll(async () => {
  // Create test user and get auth token
  const registerResponse = await request(app)
    .post("/api/auth/register")
    .send({
      email: "test@example.com",
      username: "testuser",
      password: "password123",
      firstName: "Test",
      lastName: "User"
    });
    
  authToken = registerResponse.body.token;
  testUserId = registerResponse.body.user.id;
});

test("POST /api/posts - creates a new post", async () => {
  const response = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      title: "Test Post",
      content: "This is a test post content",
      tags: ["test", "example"],
      published: true
    })
    .expect(201);
    
  expect(response.body.message).toBe("Post created successfully");
  expect(response.body.post.title).toBe("Test Post");
  expect(response.body.post.slug).toBe("test-post");
  expect(response.body.post.authorId).toBe(testUserId);
});

test("GET /api/posts - returns paginated posts", async () => {
  const response = await request(app)
    .get("/api/posts")
    .query({ page: 1, limit: 10 })
    .expect(200);
    
  expect(response.body.posts).toBeDefined();
  expect(Array.isArray(response.body.posts)).toBe(true);
  expect(response.body.pagination).toBeDefined();
  expect(response.body.pagination.page).toBe(1);
  expect(response.body.pagination.limit).toBe(10);
});

test("GET /api/posts/:id - returns specific post", async () => {
  // First create a post
  const createResponse = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      title: "Specific Test Post",
      content: "Content for specific test",
      published: true
    });
    
  const postId = createResponse.body.post.id;
  
  // Then retrieve it
  const response = await request(app)
    .get(`/api/posts/${postId}`)
    .expect(200);
    
  expect(response.body.post.id).toBe(postId);
  expect(response.body.post.title).toBe("Specific Test Post");
});

test("PUT /api/posts/:id - updates post", async () => {
  // Create post first
  const createResponse = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      title: "Update Test Post",
      content: "Original content",
      published: false
    });
    
  const postId = createResponse.body.post.id;
  
  // Update the post
  const response = await request(app)
    .put(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      title: "Updated Test Post",
      content: "Updated content",
      published: true
    })
    .expect(200);
    
  expect(response.body.post.title).toBe("Updated Test Post");
  expect(response.body.post.content).toBe("Updated content");
  expect(response.body.post.published).toBe(true);
});

test("DELETE /api/posts/:id - deletes post", async () => {
  // Create post first
  const createResponse = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      title: "Delete Test Post",
      content: "To be deleted",
      published: true
    });
    
  const postId = createResponse.body.post.id;
  
  // Delete the post
  await request(app)
    .delete(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${authToken}`)
    .expect(200);
    
  // Verify it's deleted
  await request(app)
    .get(`/api/posts/${postId}`)
    .expect(404);
});

afterAll(async () => {
  // Clean up test data
  const db = new Database("blog.db");
  db.query("DELETE FROM posts WHERE authorId = ?").run(testUserId);
  db.query("DELETE FROM users WHERE id = ?").run(testUserId);
  db.close();
});
```

## Environment Configuration

```bash
# .env
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=./blog.db

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Documentation

```typescript
// docs/api.md
# Blog API Documentation

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token

### Posts
- `GET /api/posts` - Get all posts (paginated)
- `GET /api/posts/:id` - Get specific post
- `POST /api/posts` - Create new post (auth required)
- `PUT /api/posts/:id` - Update post (auth required, owner only)
- `DELETE /api/posts/:id` - Delete post (auth required, owner only)
- `PATCH /api/posts/:id/publish` - Publish/unpublish post

### Comments
- `GET /api/comments/post/:postId` - Get comments for post
- `POST /api/comments` - Create comment (auth required)
- `PUT /api/comments/:id` - Update comment (auth required, owner only)
- `DELETE /api/comments/:id` - Delete comment (auth required, owner only)

### Query Parameters

#### Posts
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `search` - Search in title and content
- `tag` - Filter by tag
- `author` - Filter by author username
- `published` - Filter by published status

## Error Responses

All errors follow this format:
```json
{
  "error": "Human readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {} // Additional error details if applicable
}
```

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Higher limits may apply for authenticated users
```

## Running the Application

```bash
# Start development server
bun run dev

# Run tests
bun test

# Build for production
bun run build

# Start production server
bun start
```

This complete REST API example demonstrates:

- **Clean Architecture**: Separation of routes, services, and middleware
- **Authentication & Authorization**: JWT-based auth with role-based access
- **Input Validation**: Using Zod for request validation
- **Error Handling**: Comprehensive error handling and responses
- **Database Integration**: SQLite with type-safe queries
- **Testing**: Unit and integration tests
- **Documentation**: API documentation and examples
- **Security**: Rate limiting, CORS, security headers
- **Performance**: Pagination, query optimization

The API provides a solid foundation for building production-ready REST services with Verb.

## See Also

- [Authentication Example](/examples/authentication) - Detailed authentication patterns
- [File Upload Example](/examples/file-upload) - Handling file uploads in REST APIs
- [WebSocket Chat Example](/examples/websocket-chat) - Real-time features
- [Testing Guide](/guide/testing) - Testing strategies for APIs