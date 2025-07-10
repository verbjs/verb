# Basic HTTP Server

This example demonstrates how to create a simple but complete HTTP server with Verb, including routing, middleware, and error handling.

## Overview

This basic HTTP server example covers:
- Creating an HTTP server
- Setting up routes
- Using middleware
- Handling errors
- Serving static files
- Request/response handling

## Complete Code

```typescript
import { createServer, middleware } from "verb";

const app = createServer();

// Built-in middleware
app.use(middleware.json());
app.use(middleware.cors());
app.use(middleware.staticFiles("public"));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Basic routes
app.get("/", (req, res) => {
  res.json({ 
    message: "Welcome to Verb HTTP Server!",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Route with parameters
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({ 
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`
  });
});

// Route with query parameters
app.get("/search", (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ 
      error: "Query parameter 'q' is required" 
    });
  }
  
  res.json({
    query: q,
    page: parseInt(page),
    limit: parseInt(limit),
    results: [`Result for "${q}"`, `Another result for "${q}"`]
  });
});

// POST route with body
app.post("/users", (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ 
      error: "Name and email are required" 
    });
  }
  
  // Simulate creating user
  const user = {
    id: Date.now().toString(),
    name,
    email,
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json(user);
});

// PUT route
app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  
  res.json({
    id,
    name,
    email,
    updatedAt: new Date().toISOString()
  });
});

// DELETE route
app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  
  res.json({
    message: `User ${id} deleted successfully`,
    deletedAt: new Date().toISOString()
  });
});

// Route demonstrating different response types
app.get("/examples/responses", (req, res) => {
  const { type = "json" } = req.query;
  
  switch (type) {
    case "json":
      res.json({ type: "json", data: "JSON response" });
      break;
    case "text":
      res.text("Plain text response");
      break;
    case "html":
      res.html("<h1>HTML Response</h1><p>This is HTML content</p>");
      break;
    case "redirect":
      res.redirect("/");
      break;
    default:
      res.status(400).json({ error: "Invalid type parameter" });
  }
});

// Error handling route (for demonstration)
app.get("/error", (req, res) => {
  throw new Error("This is a test error");
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Error:", error.message);
  
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
  });
});

// 404 handler (should be last)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";

app.listen(port, host);

console.log(`🚀 Server running at http://${host}:${port}`);
console.log("Available endpoints:");
console.log("  GET  /");
console.log("  GET  /health");
console.log("  GET  /users/:id");
console.log("  GET  /search?q=query");
console.log("  POST /users");
console.log("  PUT  /users/:id");
console.log("  DELETE /users/:id");
console.log("  GET  /examples/responses?type=json|text|html|redirect");
console.log("  GET  /error (demo error handling)");
```

## Step-by-Step Breakdown

### 1. Server Creation

```typescript
import { createServer, middleware } from "verb";

const app = createServer();
```

Create a basic HTTP server using the default protocol (HTTP).

### 2. Middleware Setup

```typescript
// Built-in middleware
app.use(middleware.json());
app.use(middleware.cors());
app.use(middleware.staticFiles("public"));

// Custom logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
```

Add middleware for JSON parsing, CORS support, static file serving, and request logging.

### 3. Basic Routes

```typescript
app.get("/", (req, res) => {
  res.json({ 
    message: "Welcome to Verb HTTP Server!",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});
```

Simple GET route returning JSON response.

### 4. Route Parameters

```typescript
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({ 
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`
  });
});
```

Route with URL parameters accessible via `req.params`.

### 5. Query Parameters

```typescript
app.get("/search", (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ 
      error: "Query parameter 'q' is required" 
    });
  }
  
  res.json({
    query: q,
    page: parseInt(page),
    limit: parseInt(limit),
    results: [`Result for "${q}"`, `Another result for "${q}"`]
  });
});
```

Route handling query parameters with validation.

### 6. POST with Body

```typescript
app.post("/users", (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ 
      error: "Name and email are required" 
    });
  }
  
  const user = {
    id: Date.now().toString(),
    name,
    email,
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json(user);
});
```

POST route with request body validation.

### 7. Error Handling

```typescript
// Global error handler
app.use((error, req, res, next) => {
  console.error("Error:", error.message);
  
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
  });
});
```

Global error handler for uncaught errors.

### 8. 404 Handler

```typescript
// 404 handler (should be last)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`
  });
});
```

Catch-all handler for unmatched routes.

## Running the Example

1. **Save the code** to a file called `server.ts`

2. **Install dependencies**:
   ```bash
   bun install verb
   ```

3. **Create public directory** (for static files):
   ```bash
   mkdir public
   echo "<h1>Static File</h1>" > public/index.html
   ```

4. **Run the server**:
   ```bash
   bun server.ts
   ```

5. **Test the endpoints**:
   ```bash
   # Basic route
   curl http://localhost:3000/
   
   # Health check
   curl http://localhost:3000/health
   
   # Route with parameters
   curl http://localhost:3000/users/123
   
   # Query parameters
   curl "http://localhost:3000/search?q=typescript&page=1&limit=5"
   
   # POST request
   curl -X POST http://localhost:3000/users \
     -H "Content-Type: application/json" \
     -d '{"name":"John Doe","email":"john@example.com"}'
   
   # Different response types
   curl "http://localhost:3000/examples/responses?type=text"
   curl "http://localhost:3000/examples/responses?type=html"
   ```

## Expected Output

### GET /
```json
{
  "message": "Welcome to Verb HTTP Server!",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### GET /health
```json
{
  "status": "healthy",
  "uptime": 42.5,
  "memory": {
    "rss": 25165824,
    "heapTotal": 7684096,
    "heapUsed": 4857136,
    "external": 1089470,
    "arrayBuffers": 18898
  }
}
```

### GET /users/123
```json
{
  "id": "123",
  "name": "User 123",
  "email": "user123@example.com"
}
```

### POST /users
```json
{
  "id": "1704110400000",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

## Key Features Demonstrated

1. **HTTP Methods**: GET, POST, PUT, DELETE
2. **Route Parameters**: `:id` parameter extraction
3. **Query Parameters**: URL query string parsing
4. **Request Body**: JSON body parsing
5. **Status Codes**: Proper HTTP status codes
6. **Middleware**: Built-in and custom middleware
7. **Error Handling**: Global error handling
8. **Static Files**: Serving static content
9. **Response Types**: JSON, text, HTML responses
10. **Validation**: Input validation and error responses

## Common Patterns

### Response Helper
```typescript
const sendSuccess = (res, data) => {
  res.json({ success: true, data });
};

const sendError = (res, message, status = 400) => {
  res.status(status).json({ success: false, error: message });
};
```

### Async Route Handler
```typescript
app.get("/async-example", async (req, res) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Route Validation
```typescript
const validateUser = (req, res, next) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ 
      error: "Name and email are required" 
    });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ 
      error: "Invalid email format" 
    });
  }
  
  next();
};

app.post("/users", validateUser, (req, res) => {
  // User data is validated
});
```

## Next Steps

- [Fullstack Application](/examples/fullstack) - Complete fullstack app with React
- [File Upload Guide](/guide/file-uploads) - Handle file uploads
- [Security Guide](/guide/security) - Add authentication and security
- [WebSocket Protocol](/guide/protocols/websocket) - Real-time features

## Troubleshooting

### Port Already in Use
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### CORS Issues
Add CORS middleware:
```typescript
app.use(middleware.cors({
  origin: ["http://localhost:3000", "http://localhost:8080"],
  credentials: true
}));
```

### JSON Body Not Parsed
Ensure JSON middleware is added:
```typescript
app.use(middleware.json());
```