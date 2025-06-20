---
title: Static Files
description: Learn how to serve static files with Verb
---

# Serving Static Files with Verb

Verb provides built-in support for serving static files like HTML, CSS, JavaScript, images, and other assets. This guide covers the various ways to serve static files in Verb.

## Basic Static File Serving

The simplest way to serve static files is using the `serveStatic` helper function:

```typescript
import { createServer, serveStatic } from "@verb/server";

const app = createServer();

// Serve static files from the 'public' directory
app.get("/static/*", (req) => {
  return serveStatic(req, {
    directory: "./public"
  });
});

console.log("Server running at http://localhost:3000");
```

With this setup, a request to `/static/styles.css` will serve the file at `./public/styles.css`.

## Configuration Options

The `serveStatic` function accepts several configuration options:

```typescript
app.get("/assets/*", (req) => {
  return serveStatic(req, {
    // Base directory for static files
    directory: "./assets",
    
    // Custom headers to add to responses
    headers: {
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    },
    
    // Whether to generate directory listings (default: false)
    directoryListing: false,
    
    // Custom 404 handler for missing files
    notFound: () => new Response("File not found", { status: 404 }),
    
    // Path rewriting
    rewritePath: (path) => path.replace(/^\/assets/, "")
  });
});
```

## Serving Files from Multiple Directories

You can serve files from multiple directories by defining multiple routes:

```typescript
// Serve static files from the 'public' directory
app.get("/static/*", (req) => {
  return serveStatic(req, {
    directory: "./public"
  });
});

// Serve static files from the 'assets' directory
app.get("/assets/*", (req) => {
  return serveStatic(req, {
    directory: "./assets"
  });
});

// Serve static files from the 'uploads' directory
app.get("/uploads/*", (req) => {
  return serveStatic(req, {
    directory: "./uploads"
  });
});
```

## Serving a Single File

You can serve a specific file by creating a custom request:

```typescript
// Serve a specific file
app.get("/favicon.ico", () => {
  return serveStatic(new Request("/favicon.ico"), {
    directory: "./public"
  });
});

// Serve a file with a different name
app.get("/download/report", () => {
  return serveStatic(new Request("/report.pdf"), {
    directory: "./files",
    headers: {
      "Content-Disposition": "attachment; filename=report.pdf"
    }
  });
});
```

## Serving Index Files

You can serve index files for directory requests:

```typescript
app.get("/*", (req) => {
  return serveStatic(req, {
    directory: "./public",
    // Serve index.html for directory requests
    indexFiles: ["index.html", "index.htm"]
  });
});
```

With this setup, a request to `/` or `/about/` will serve `./public/index.html` or `./public/about/index.html` respectively.

## Caching

You can add caching headers to static files:

```typescript
app.get("/static/*", (req) => {
  return serveStatic(req, {
    directory: "./public",
    headers: {
      // Cache for 1 hour
      "Cache-Control": "public, max-age=3600"
    }
  });
});
```

For more advanced caching, you can set different cache headers based on the file type:

```typescript
app.get("/static/*", (req) => {
  const path = new URL(req.url).pathname.replace("/static", "");
  
  // Set cache headers based on file extension
  const headers: Record<string, string> = {};
  
  if (path.endsWith(".css") || path.endsWith(".js")) {
    // Cache CSS and JS files for 1 week
    headers["Cache-Control"] = "public, max-age=604800";
  } else if (path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".webp")) {
    // Cache images for 1 month
    headers["Cache-Control"] = "public, max-age=2592000";
  } else {
    // Cache other files for 1 day
    headers["Cache-Control"] = "public, max-age=86400";
  }
  
  return serveStatic(req, {
    directory: "./public",
    headers
  });
});
```

## Content Type Detection

Verb automatically detects the content type of static files based on their extension. You can override this behavior by setting the `Content-Type` header:

```typescript
app.get("/data/config", () => {
  return serveStatic(new Request("/config.json"), {
    directory: "./data",
    headers: {
      "Content-Type": "application/json"
    }
  });
});
```

## Handling Missing Files

You can customize the response for missing files:

```typescript
app.get("/static/*", (req) => {
  return serveStatic(req, {
    directory: "./public",
    notFound: () => {
      // Custom 404 response
      return new Response("File not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" }
      });
    }
  });
});
```

## Serving Single-Page Applications

For single-page applications (SPAs), you often need to serve the `index.html` file for all routes that don't match a static file:

```typescript
import { createServer, serveStatic } from "@verb/server";

const app = createServer();

// Serve static files from the 'public' directory
app.get("/*", async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Try to serve a static file
  try {
    return await serveStatic(req, {
      directory: "./public"
    });
  } catch (err) {
    // If the file doesn't exist, serve index.html
    return serveStatic(new Request("/index.html"), {
      directory: "./public"
    });
  }
});

console.log("Server running at http://localhost:3000");
```

## Directory Listing

You can enable directory listing for browsing files:

```typescript
app.get("/files/*", (req) => {
  return serveStatic(req, {
    directory: "./files",
    directoryListing: true
  });
});
```

This will generate an HTML page listing all files and directories when a directory is requested.

## Path Rewriting

You can rewrite paths before serving files:

```typescript
app.get("/assets/*", (req) => {
  return serveStatic(req, {
    directory: "./public",
    rewritePath: (path) => {
      // Remove '/assets' prefix
      return path.replace(/^\/assets/, "");
    }
  });
});
```

With this setup, a request to `/assets/css/styles.css` will serve the file at `./public/css/styles.css`.

## Serving Files with Middleware

You can use middleware to add functionality to static file serving:

```typescript
import { createServer, serveStatic } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer();

// Logging middleware for static files
const logStaticRequests: Middleware = (req, next) => {
  console.log(`Static file request: ${req.url}`);
  return next();
};

// Apply middleware to static file routes
app.get("/static/*", [logStaticRequests], (req) => {
  return serveStatic(req, {
    directory: "./public"
  });
});
```

## Serving Files from Memory

You can serve files from memory by creating a custom response:

```typescript
// Serve a file from memory
app.get("/generated/report", () => {
  const content = generateReportContent(); // Function that generates report content
  
  return new Response(content, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=report.pdf"
    }
  });
});
```

## Best Practices

- **Security**: Be careful about which directories you expose
- **Caching**: Set appropriate cache headers for different types of files
- **Performance**: Consider using a CDN for static assets in production
- **Content Types**: Ensure correct content types are set for all files
- **Error Handling**: Provide helpful error messages for missing files
- **Path Normalization**: Normalize paths to prevent directory traversal attacks

## Next Steps

Now that you understand static file serving in Verb, you can explore related topics:

- [Compression](/server/compression) - Learn how to compress static files
- [Security](/server/security) - Learn about securing your static files
- [Middleware](/server/middleware) - Learn how to use middleware with static file serving