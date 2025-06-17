/**
 * Filesystem Routing Example
 * 
 * This example demonstrates how to use Verb's filesystem-based routing
 * similar to Nitro.build and Hono's filesystem routing.
 * 
 * Run with: bun run examples/filesystem-routing.ts
 * 
 * Route files should be placed in a `routes/` directory with the following structure:
 * 
 * routes/
 * ├── index.ts              -> GET /
 * ├── about.ts              -> GET /about
 * ├── get.contact.ts        -> GET /contact
 * ├── post.contact.ts       -> POST /contact
 * ├── api/
 * │   ├── users/
 * │   │   ├── index.ts      -> GET /api/users
 * │   │   ├── [id].ts       -> GET /api/users/:id
 * │   │   └── post.index.ts -> POST /api/users
 * │   └── [...rest].ts      -> GET /api/* (catch-all)
 * └── health.ts             -> GET /health
 */

import {
  createServer,
  RouterType,
  json,
  text,
  type Handler,
} from "../src/index.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

console.log("🚀 Starting Filesystem Routing example...\n");

// Create example route files
const exampleRoutes = [
  {
    path: "routes/index.ts",
    content: `// Root route: GET /
export default async (req: Request) => {
  return new Response(JSON.stringify({
    message: "Welcome to Verb filesystem routing!",
    timestamp: Date.now(),
    method: req.method,
    url: req.url
  }), {
    headers: { "Content-Type": "application/json" }
  });
};`,
  },
  {
    path: "routes/about.ts",
    content: `// About page: GET /about
export default async (req: Request) => {
  return new Response(\`
    <html>
      <head><title>About - Verb</title></head>
      <body>
        <h1>About Verb</h1>
        <p>High-performance HTTP server framework for TypeScript and Bun.</p>
        <p>Requested at: \${new Date().toISOString()}</p>
        <a href="/">← Back to home</a>
      </body>
    </html>
  \`, {
    headers: { "Content-Type": "text/html" }
  });
};`,
  },
  {
    path: "routes/get.contact.ts",
    content: `// Contact form: GET /contact
export default async (req: Request) => {
  return new Response(\`
    <html>
      <head><title>Contact - Verb</title></head>
      <body>
        <h1>Contact Us</h1>
        <form method="POST" action="/contact">
          <div>
            <label>Name: <input type="text" name="name" required></label>
          </div>
          <div>
            <label>Email: <input type="email" name="email" required></label>
          </div>
          <div>
            <label>Message: <textarea name="message" required></textarea></label>
          </div>
          <button type="submit">Send Message</button>
        </form>
        <a href="/">← Back to home</a>
      </body>
    </html>
  \`, {
    headers: { "Content-Type": "text/html" }
  });
};`,
  },
  {
    path: "routes/post.contact.ts",
    content: `// Handle contact form: POST /contact
import { parseBody } from "../src/index.ts";

export default async (req: Request) => {
  try {
    const body = await parseBody(req);
    
    // In a real app, you'd save this to a database
    console.log("📧 Contact form submission:", body);
    
    return new Response(\`
      <html>
        <head><title>Thank You - Verb</title></head>
        <body>
          <h1>Thank You!</h1>
          <p>Your message has been received. We'll get back to you soon.</p>
          <a href="/">← Back to home</a>
        </body>
      </html>
    \`, {
      headers: { "Content-Type": "text/html" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to process form submission",
      details: error.message
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
};`,
  },
  {
    path: "routes/api/users/index.ts",
    content: `// Users API: GET /api/users
const users = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
  { id: 3, name: "Charlie", email: "charlie@example.com" }
];

export default async (req: Request) => {
  return new Response(JSON.stringify({
    users,
    total: users.length,
    timestamp: Date.now()
  }), {
    headers: { "Content-Type": "application/json" }
  });
};`,
  },
  {
    path: "routes/api/users/[id].ts",
    content: `// User detail: GET /api/users/:id
const users = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
  { id: 3, name: "Charlie", email: "charlie@example.com" }
];

export default async (req: Request, params: Record<string, string>) => {
  const userId = parseInt(params.id);
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return new Response(JSON.stringify({
      error: "User not found",
      id: userId
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({
    user,
    timestamp: Date.now()
  }), {
    headers: { "Content-Type": "application/json" }
  });
};`,
  },
  {
    path: "routes/api/users/post.index.ts",
    content: `// Create user: POST /api/users
import { parseBody } from "../../../src/index.ts";

export default async (req: Request) => {
  try {
    const body = await parseBody(req);
    
    // Validate required fields
    if (!body.name || !body.email) {
      return new Response(JSON.stringify({
        error: "Missing required fields: name, email"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // In a real app, you'd save to database
    const newUser = {
      id: Date.now(), // Simple ID generation
      name: body.name,
      email: body.email,
      createdAt: new Date().toISOString()
    };
    
    console.log("👤 New user created:", newUser);
    
    return new Response(JSON.stringify({
      message: "User created successfully",
      user: newUser
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to create user",
      details: error.message
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
};`,
  },
  {
    path: "routes/api/[...rest].ts",
    content: `// API catch-all: GET /api/*
export default async (req: Request, params: Record<string, string>) => {
  const path = params["*"] || "";
  
  return new Response(JSON.stringify({
    message: "API endpoint not found",
    requestedPath: \`/api/\${path}\`,
    availableEndpoints: [
      "GET /api/users",
      "GET /api/users/:id", 
      "POST /api/users"
    ],
    timestamp: Date.now()
  }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
};`,
  },
  {
    path: "routes/health.ts",
    content: `// Health check: GET /health
export default async (req: Request) => {
  return new Response(JSON.stringify({
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
    version: "1.0.0"
  }), {
    headers: { "Content-Type": "application/json" }
  });
};`,
  },
];

// Create routes directory and example files
async function setupExampleRoutes() {
  console.log("📁 Creating example routes...");
  
  try {
    // Create routes directory structure
    await mkdir("routes", { recursive: true });
    await mkdir("routes/api", { recursive: true });
    await mkdir("routes/api/users", { recursive: true });
    
    // Write route files
    for (const route of exampleRoutes) {
      await writeFile(route.path, route.content);
      console.log(`✅ Created ${route.path}`);
    }
    
    console.log("🎉 Example routes created successfully!\n");
  } catch (error) {
    console.error("❌ Failed to create example routes:", error);
    process.exit(1);
  }
}

// Main server setup
async function startServer() {
  await setupExampleRoutes();
  
  console.log("🚀 Starting Verb server with filesystem routing...");
  
  // Create server with filesystem router
  const app = createServer({
    port: 3000,
    router: {
      type: RouterType.FILESYSTEM,
      options: {
        routesDir: "./routes",
        extensions: [".ts", ".js"],
        hotReload: true,
      }
    }
  });
  
  // Add global middleware
  app.use(async (req, next) => {
    const start = Date.now();
    console.log(\`📨 \${req.method} \${new URL(req.url).pathname}\`);
    
    const response = await next();
    const duration = Date.now() - start;
    
    console.log(\`📤 \${response.status} (\${duration}ms)\`);
    return response;
  });
  
  console.log(\`
🌟 Filesystem Routing Server Running!

📚 Available Routes:
├── GET  /              - Home page
├── GET  /about         - About page  
├── GET  /contact       - Contact form
├── POST /contact       - Submit contact form
├── GET  /health        - Health check
└── API Routes:
    ├── GET  /api/users     - List all users
    ├── GET  /api/users/:id - Get user by ID
    ├── POST /api/users     - Create new user
    └── GET  /api/*         - API catch-all

🧪 Test Commands:
curl http://localhost:3000/
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/1
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"Dave","email":"dave@example.com"}'

🔄 Hot Reload: Enabled (modify route files and see changes immediately)
📁 Routes Directory: ./routes

Press Ctrl+C to stop the server
  \`);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down filesystem routing server...");
  process.exit(0);
});

// Start the server
startServer().catch(console.error);