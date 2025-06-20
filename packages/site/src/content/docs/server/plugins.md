---
title: Plugins
description: Learn how to extend Verb with plugins
---

# Plugins in Verb

Verb's plugin system allows you to extend the library's functionality in a modular way. This guide covers how to use and create plugins for Verb.

## What are Plugins?

Plugins are modules that add functionality to Verb. They can:

- Add middleware
- Add new response types
- Add utility functions
- Integrate with other services
- Modify the server behavior

## Using Plugins

To use a plugin in your Verb application, you can either:

1. Create the plugin locally in your project
2. Import it from a local module

### Using a Local Plugin

Create your plugin in a local file:

```typescript
// plugins/logger.ts
import type { Middleware } from "@verb/server";

export default function logger(options = {}): Middleware {
  return (req, next) => {
    const start = Date.now();
    console.log(`${req.method} ${req.url} - Started`);
    
    const result = next();
    
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
}
```

Then import and use it in your application:

```typescript
import { createServer } from "@verb/server";
import logger from "./plugins/logger";

const app = createServer();

// Use the plugin
app.use(logger({
  // Plugin options
}));

// Define routes
app.get("/", () => {
  return new Response("Hello from Verb!");
});

console.log("Server running at http://localhost:3000");
```

## Common Plugins

Here are some common plugins for Verb:

### CORS Plugin

The CORS plugin adds Cross-Origin Resource Sharing support:

```typescript
import { createServer } from "@verb/server";
import cors from "./plugins/cors";  // Import from your local plugins directory

const app = createServer();

// Use the CORS plugin
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Define routes
app.get("/api/data", () => {
  return new Response(JSON.stringify({ message: "Hello, World!" }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

### Compression Plugin

The compression plugin adds response compression:

```typescript
import { createServer } from "@verb/server";
import compression from "./plugins/compression";  // Import from your local plugins directory

const app = createServer();

// Use the compression plugin
app.use(compression({
  level: 6, // Compression level (1-9)
  threshold: 1024 // Minimum size to compress (in bytes)
}));

// Define routes
app.get("/", () => {
  return new Response("Hello from Verb!");
});
```

### Rate Limiting Plugin

The rate limiting plugin adds request rate limiting:

```typescript
import { createServer } from "@verb/server";
import rateLimit from "./plugins/rate-limit";  // Import from your local plugins directory

const app = createServer();

// Use the rate limiting plugin
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Too many requests, please try again later"
}));

// Define routes
app.get("/api/data", () => {
  return new Response(JSON.stringify({ message: "Hello, World!" }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

### JWT Authentication Plugin

The JWT authentication plugin adds JSON Web Token authentication:

```typescript
import { createServer } from "@verb/server";
import jwt from "./plugins/jwt";  // Import from your local plugins directory

const app = createServer();

// Use the JWT plugin
app.use(jwt({
  secret: "your-secret-key",
  algorithms: ["HS256"],
  credentialsRequired: true
}));

// Protected route
app.get("/api/protected", (req) => {
  // The JWT plugin adds the decoded token to the request
  const user = (req as any).user;
  
  return new Response(JSON.stringify({ message: `Hello, ${user.name}!` }), {
    headers: { "Content-Type": "application/json" }
  });
});

// Login route
app.post("/api/login", async (req) => {
  const body = await req.json();
  
  // Validate credentials (in a real app, you would check against a database)
  if (body.username === "admin" && body.password === "password") {
    // Generate a token
    const token = jwt.sign({ id: 1, name: "Admin" }, "your-secret-key", { expiresIn: "1h" });
    
    return new Response(JSON.stringify({ token }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ error: "Invalid credentials" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
});
```

## Creating Plugins

You can create your own plugins to extend Verb's functionality. A plugin is a function that returns a middleware function or an object with a `setup` method.

### Simple Plugin

Here's a simple plugin that adds a logging middleware:

```typescript
import type { Middleware } from "@verb/server";

// Plugin function
export default function logger(options = {}): Middleware {
  return (req, next) => {
    const start = Date.now();
    console.log(`${req.method} ${req.url} - Started`);
    
    const result = next();
    
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
}
```

### Complex Plugin

For more complex plugins, you can use an object with a `setup` method:

```typescript
import type { Plugin, Server } from "@verb/server";

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

export default function cache(options: CacheOptions = {}): Plugin {
  const ttl = options.ttl || 60 * 1000; // 1 minute
  const maxSize = options.maxSize || 100;
  
  // Create a cache
  const cache = new Map<string, { value: Response, expires: number }>();
  
  return {
    name: "cache",
    version: "1.0.0",
    
    setup(server: Server) {
      // Add middleware to the server
      server.use((req, next) => {
        // Only cache GET requests
        if (req.method !== "GET") {
          return next();
        }
        
        const key = req.url;
        
        // Check if the response is in the cache
        const cached = cache.get(key);
        
        if (cached && cached.expires > Date.now()) {
          // Return a clone of the cached response
          return cached.value.clone();
        }
        
        // Get the response from the next middleware or route handler
        const result = next();
        
        if (result instanceof Promise) {
          return result.then(response => {
            // Cache the response
            if (response.status === 200 && cache.size < maxSize) {
              cache.set(key, {
                value: response.clone(),
                expires: Date.now() + ttl
              });
            }
            
            return response;
          });
        } else {
          // Cache the response
          if (result.status === 200 && cache.size < maxSize) {
            cache.set(key, {
              value: result.clone(),
              expires: Date.now() + ttl
            });
          }
          
          return result;
        }
      });
      
      // Add cache control methods to the server
      server.cache = {
        get: (key: string) => {
          const cached = cache.get(key);
          return cached && cached.expires > Date.now() ? cached.value.clone() : null;
        },
        set: (key: string, value: Response, customTtl?: number) => {
          if (cache.size < maxSize) {
            cache.set(key, {
              value: value.clone(),
              expires: Date.now() + (customTtl || ttl)
            });
          }
        },
        clear: () => {
          cache.clear();
        },
        delete: (key: string) => {
          cache.delete(key);
        },
        size: () => {
          return cache.size;
        }
      };
    }
  };
}
```

## Organizing Plugins

To organize your plugins effectively, you can:

1. Create a dedicated plugins directory in your project:

```bash
mkdir -p src/plugins
```

2. Implement your plugin in a dedicated file:

```typescript
// src/plugins/my-plugin.ts
import type { Middleware } from "@verb/server";

export default function myPlugin(options = {}): Middleware {
  return (req, next) => {
    // Plugin implementation
    return next();
  };
}
```

3. Create an index file to export all your plugins:

```typescript
// src/plugins/index.ts
export { default as myPlugin } from './my-plugin';
export { default as logger } from './logger';
// Export other plugins
```

4. Import and use your plugins in your application:

```typescript
import { createServer } from "@verb/server";
import { myPlugin, logger } from "./plugins";

const app = createServer();

// Use the plugins
app.use(logger());
app.use(myPlugin({
  // Plugin options
}));

// Define routes
app.get("/", () => {
  return new Response("Hello from Verb!");
});
```

## Best Practices

- **Keep Plugins Focused**: Each plugin should have a single responsibility
- **Document Your Plugins**: Provide clear documentation for your plugins
- **Version Your Plugins**: Use semantic versioning for your plugins
- **Test Your Plugins**: Write tests for your plugins
- **Provide TypeScript Types**: Include TypeScript type definitions for your plugins

## Next Steps

Now that you understand plugins in Verb, you can explore related topics:

- [Middleware](/server/middleware) - Learn more about middleware
- [Creating Plugins](/server/creating-plugins) - Learn more about creating plugins
- [Advanced Server Configuration](/server/configuration) - Learn about configuring your Verb server