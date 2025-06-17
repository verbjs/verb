import { createServer, createPlugin, plugin, json, text } from "../src/index.ts";

/**
 * Example 1: Simple Logging Plugin
 * Demonstrates basic plugin functionality with lifecycle hooks
 */
const loggingPlugin = createPlugin(
  {
    name: "request-logger",
    version: "1.0.0",
    description: "Logs all incoming requests with timestamps",
    author: "Verb Team"
  },
  async (context) => {
    // Add request logging middleware
    context.addMiddleware(async (req, next) => {
      const start = Date.now();
      context.log(`${req.method} ${new URL(req.url).pathname} - Started`);
      
      const response = await next();
      
      const duration = Date.now() - start;
      context.log(`${req.method} ${new URL(req.url).pathname} - ${response.status} (${duration}ms)`);
      
      return response;
    });
  },
  {
    beforeStart: (context) => {
      context.log("Request logger plugin starting...");
    },
    afterStart: (context) => {
      context.log("Request logger plugin started successfully");
    }
  }
);

/**
 * Example 2: API Key Authentication Plugin
 * Demonstrates middleware registration and service provision
 */
const authPlugin = createPlugin(
  {
    name: "api-auth",
    version: "1.0.0",
    description: "Provides API key authentication",
    author: "Verb Team",
    tags: ["auth", "security"]
  },
  async (context) => {
    const { apiKeys = ["default-key"], protectedPaths = ["/api"] } = context.config;
    
    // Register authentication service
    context.registerService("auth", {
      validateApiKey: (key: string) => apiKeys.includes(key),
      isProtectedPath: (path: string) => protectedPaths.some((p: string) => path.startsWith(p))
    });
    
    // Add authentication middleware
    context.addMiddleware(async (req, next) => {
      const url = new URL(req.url);
      const authService = context.getService("auth");
      
      if (authService.isProtectedPath(url.pathname)) {
        const apiKey = req.headers.get("x-api-key");
        
        if (!apiKey || !authService.validateApiKey(apiKey)) {
          return new Response("Unauthorized", { status: 401 });
        }
        
        context.log(`API key authenticated for ${url.pathname}`);
      }
      
      return next();
    });
    
    // Add auth status route
    context.addRoute("GET", "/auth/status", async (req) => {
      const apiKey = req.headers.get("x-api-key");
      const authService = context.getService("auth");
      
      return json({
        authenticated: apiKey ? authService.validateApiKey(apiKey) : false,
        timestamp: new Date().toISOString()
      });
    });
  },
  {
    beforeStart: (context) => {
      context.log("Authentication plugin initializing...");
    }
  },
  {
    apiKeys: ["secret-key-1", "secret-key-2"],
    protectedPaths: ["/api", "/admin"]
  }
);

/**
 * Example 3: Health Check Plugin
 * Demonstrates route registration and plugin dependencies
 */
const healthPlugin = createPlugin(
  {
    name: "health-check",
    version: "1.0.0",
    description: "Provides health check endpoints",
    author: "Verb Team",
    dependencies: ["request-logger"], // Depends on logging plugin
    tags: ["monitoring", "health"]
  },
  async (context) => {
    const startTime = Date.now();
    
    // Store health metrics
    context.storage.set("startTime", startTime);
    context.storage.set("requestCount", 0);
    
    // Add request counter middleware
    context.addMiddleware(async (req, next) => {
      const count = context.storage.get("requestCount") || 0;
      context.storage.set("requestCount", count + 1);
      return next();
    });
    
    // Health check endpoint
    context.addRoute("GET", "/health", async () => {
      const uptime = Date.now() - context.storage.get("startTime");
      const requestCount = context.storage.get("requestCount");
      
      return json({
        status: "healthy",
        uptime: `${Math.floor(uptime / 1000)}s`,
        requests: requestCount,
        timestamp: new Date().toISOString(),
        plugin: context.plugin.name
      });
    });
    
    // Detailed health endpoint
    context.addRoute("GET", "/health/detailed", async () => {
      const uptime = Date.now() - context.storage.get("startTime");
      const requestCount = context.storage.get("requestCount");
      
      return json({
        status: "healthy",
        uptime: {
          ms: uptime,
          seconds: Math.floor(uptime / 1000),
          minutes: Math.floor(uptime / 60000)
        },
        metrics: {
          totalRequests: requestCount,
          averageRequestsPerMinute: Math.round((requestCount / (uptime / 60000)) * 100) / 100
        },
        system: {
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        plugins: context.server.plugins.getPluginMetadata().map((p: any) => ({
          name: p.name,
          version: p.version
        }))
      });
    });
  }
);

/**
 * Example 4: Plugin using the builder pattern
 */
const corsPlugin = plugin("cors-middleware", "1.0.0")
  .setDescription("Adds CORS headers to responses")
  .setConfig({
    origins: ["*"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    headers: ["Content-Type", "Authorization"]
  })
  .addHooks({
    beforeStart: (context) => {
      context.log("CORS plugin starting with config:", context.config);
    }
  })
  .onRegister(async (context) => {
    const { origins, methods, headers } = context.config;
    
    context.addMiddleware(async (req, next) => {
      const response = await next();
      
      // Add CORS headers
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", origins.join(", "));
      newHeaders.set("Access-Control-Allow-Methods", methods.join(", "));
      newHeaders.set("Access-Control-Allow-Headers", headers.join(", "));
      
      const corsResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
      
      return corsResponse;
    });
    
    // Handle preflight requests
    context.addRoute("OPTIONS", "*", async () => {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origins.join(", "),
          "Access-Control-Allow-Methods": methods.join(", "),
          "Access-Control-Allow-Headers": headers.join(", "),
          "Access-Control-Max-Age": "86400"
        }
      });
    });
  })
  .build();

/**
 * Example usage with a server
 */
async function runExampleServer() {
  const app = createServer({ port: 3000 });
  
  // Register plugins in dependency order
  await app.register(loggingPlugin);
  await app.register(authPlugin);
  await app.register(healthPlugin);
  await app.register(corsPlugin, {
    config: {
      origins: ["http://localhost:3000", "https://example.com"]
    }
  });
  
  // Add some regular routes
  app.get("/", () => text("Hello from Verb with Plugins!"));
  
  app.get("/api/users", () => json([
    { id: 1, name: "John Doe" },
    { id: 2, name: "Jane Smith" }
  ]));
  
  app.post("/api/users", async (req) => {
    const body = await req.json();
    return json({ id: 3, ...body }, 201);
  });
  
  // Start plugins
  await app.startPlugins();
  
  console.log("Server with plugins is running!");
  console.log("Try these endpoints:");
  console.log("- GET /health - Basic health check");
  console.log("- GET /health/detailed - Detailed health info");
  console.log("- GET /auth/status - Authentication status");
  console.log("- GET /api/users - Protected API endpoint (requires x-api-key header)");
  console.log("- GET / - Basic route");
  
  return app;
}

// Export for use in other examples
export {
  loggingPlugin,
  authPlugin,
  healthPlugin,
  corsPlugin,
  runExampleServer
};

// Run example if this file is executed directly
if (import.meta.main) {
  runExampleServer().catch(console.error);
}
