/**
 * HTTP Server Example with Verb
 * 
 * This example demonstrates how to create a standard HTTP server
 * and utilize all the core features of the Verb library.
 */

import { 
  createServer, 
  json, 
  text, 
  html, 
  error,
  parseBody,
  getQuery,
  getCookies,
  serveStatic,
  staticFiles
} from "../src/index.ts";
import type { Handler, Middleware } from "../src/index.ts";

const app = createServer({
  port: 3000,
  development: true
});

// Custom middleware for logging
const logger: Middleware = (req, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.url} - Started`);
  
  const result = next();
  
  // Handle both sync and async responses
  if (result instanceof Promise) {
    return result.then(response => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} - ${response.status} (${duration}ms)`);
      return response;
    });
  } else {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${result.status} (${duration}ms)`);
    return result;
  }
};

// Apply global middleware
app.use(logger);

// Home page with HTML response
app.get("/", () => {
  return html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Verb HTTP Server</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          color: #333;
        }
        .endpoint {
          background: #f8fafc;
          padding: 15px;
          margin: 10px 0;
          border-radius: 8px;
          border-left: 4px solid #2563eb;
        }
        .method {
          font-weight: bold;
          color: #2563eb;
        }
        code {
          background: #e5e7eb;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <h1>🚀 Welcome to Verb HTTP Server!</h1>
      <p>This example demonstrates all the core features of the Verb library.</p>
      
      <h2>Available Endpoints:</h2>
      
      <div class="endpoint">
        <div class="method">GET /api/users</div>
        <p>Returns a list of sample users as JSON</p>
      </div>
      
      <div class="endpoint">
        <div class="method">POST /api/users</div>
        <p>Create a new user (send JSON body with name and email)</p>
      </div>
      
      <div class="endpoint">
        <div class="method">GET /api/users/:id</div>
        <p>Get a specific user by ID</p>
      </div>
      
      <div class="endpoint">
        <div class="method">PUT /api/users/:id</div>
        <p>Update a user by ID</p>
      </div>
      
      <div class="endpoint">
        <div class="method">DELETE /api/users/:id</div>
        <p>Delete a user by ID</p>
      </div>
      
      <div class="endpoint">
        <div class="method">GET /search</div>
        <p>Search with query parameters: <code>?q=term&category=type</code></p>
      </div>
      
      <div class="endpoint">
        <div class="method">GET /cookies</div>
        <p>Demonstrates cookie parsing and setting</p>
      </div>
      
      <div class="endpoint">
        <div class="method">GET /files/*</div>
        <p>Static file serving</p>
      </div>
      
      <div class="endpoint">
        <div class="method">GET /health</div>
        <p>Health check endpoint</p>
      </div>
      
      <h2>Try it out:</h2>
      <p>Use curl, Postman, or your browser to test these endpoints!</p>
      
      <h3>Example Commands:</h3>
      <pre><code>curl http://localhost:3000/api/users
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'
curl http://localhost:3000/search?q=example&category=demo</code></pre>
    </body>
    </html>
  `);
});

// Sample data store (in-memory for demo purposes)
const users = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com", createdAt: new Date().toISOString() },
  { id: 2, name: "Bob Smith", email: "bob@example.com", createdAt: new Date().toISOString() },
  { id: 3, name: "Carol Davis", email: "carol@example.com", createdAt: new Date().toISOString() }
];
let nextId = 4;

// REST API endpoints
app.get("/api/users", () => {
  return json({
    users,
    total: users.length,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/users", async (req) => {
  try {
    const body = await parseBody(req);
    
    if (!body.name || !body.email) {
      return error("Name and email are required", 400);
    }
    
    const newUser = {
      id: nextId++,
      name: body.name,
      email: body.email,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    return json(newUser, 201);
  } catch (err) {
    return error("Invalid JSON body", 400);
  }
});

app.get("/api/users/:id", (req, params) => {
  const id = Number.parseInt(params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return error(`User with id ${id} not found`, 404);
  }
  
  return json(user);
});

app.put("/api/users/:id", async (req, params) => {
  try {
    const id = Number.parseInt(params.id);
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return error(`User with id ${id} not found`, 404);
    }
    
    const body = await parseBody(req);
    const updatedUser = {
      ...users[userIndex],
      ...body,
      id, // Prevent ID changes
      updatedAt: new Date().toISOString()
    };
    
    users[userIndex] = updatedUser;
    
    return json(updatedUser);
  } catch (err) {
    return error("Invalid JSON body", 400);
  }
});

app.delete("/api/users/:id", (req, params) => {
  const id = Number.parseInt(params.id);
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return error(`User with id ${id} not found`, 404);
  }
  
  const deletedUser = users.splice(userIndex, 1)[0];
  
  return json({
    message: "User deleted successfully",
    user: deletedUser
  });
});

// Query parameter example
app.get("/search", (req) => {
  const query = getQuery(req);
  const { q, category, limit = "10" } = query;
  
  if (!q) {
    return error("Query parameter 'q' is required", 400);
  }
  
  // Simulate search results
  const results = [
    { id: 1, title: `Result for "${q}"`, category: category || "general", relevance: 0.95 },
    { id: 2, title: `Another result for "${q}"`, category: category || "general", relevance: 0.87 },
    { id: 3, title: `Related to "${q}"`, category: category || "general", relevance: 0.76 }
  ].slice(0, Number.parseInt(limit));
  
  return json({
    query: q,
    category: category || "all",
    results,
    total: results.length,
    timestamp: new Date().toISOString()
  });
});

// Cookie handling example
app.get("/cookies", (req) => {
  const cookies = getCookies(req);
  const visitCount = Number.parseInt(cookies.visits || "0") + 1;
  
  const response = json({
    message: "Cookie demo",
    currentVisit: visitCount,
    allCookies: cookies,
    timestamp: new Date().toISOString()
  });
  
  // Set a cookie for visit tracking
  response.headers.set("Set-Cookie", `visits=${visitCount}; Path=/; Max-Age=3600`);
  
  return response;
});

// Static file serving
app.get("/files/*", (req) => {
  // In a real application, you would have actual static files
  // This is just a demonstration
  const filepath = req.url.replace("/files", "");
  
  if (filepath === "/sample.txt") {
    return text("This is a sample text file served statically!");
  } else if (filepath === "/data.json") {
    return json({ message: "This is a sample JSON file", served: "statically" });
  } else {
    return error("File not found", 404);
  }
});

// Health check endpoint
app.get("/health", () => {
  return json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Error handling example
app.get("/error", () => {
  throw new Error("This is a test error");
});

// Async handler example
app.get("/async", async () => {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return json({
    message: "This response was generated asynchronously",
    delay: 100,
    timestamp: new Date().toISOString()
  });
});

// Helper function to create protected handlers
const withAuth = (handler: Handler): Handler => {
  return (req, params) => {
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return error("Authorization required", 401);
    }
    
    // Simulate token validation
    const token = authHeader.replace("Bearer ", "");
    if (token !== "demo-token") {
      return error("Invalid token", 403);
    }
    
    return handler(req, params);
  };
};

// Protected endpoint
app.get("/protected", withAuth((req, params) => {
  return json({
    message: "This is a protected endpoint",
    user: "authenticated-user",
    timestamp: new Date().toISOString()
  });
}));

// Start the server
console.log("🚀 HTTP server starting...");
console.log("📍 Visit http://localhost:3000/ to see the demo");
console.log("📚 Try the various endpoints listed on the home page");
console.log("🔒 For /protected endpoint, use: Authorization: Bearer demo-token");
