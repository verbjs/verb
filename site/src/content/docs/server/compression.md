---
title: Compression
description: Learn how to compress responses in Verb
---

# Response Compression in Verb

Compressing HTTP responses can significantly reduce bandwidth usage and improve load times for your web applications. Verb provides several approaches for compressing responses. This guide covers response compression in detail.

## Why Use Compression?

Compressing HTTP responses offers several benefits:

- **Reduced Bandwidth Usage**: Compressed responses use less bandwidth, reducing costs and improving performance.
- **Faster Load Times**: Smaller responses download faster, improving the user experience.
- **Improved Scalability**: Reduced bandwidth usage allows your server to handle more concurrent requests.

## Basic Compression

The simplest way to add compression to your Verb application is to use a compression middleware:

```typescript
import { createServer } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer();

// Compression middleware
const compression: Middleware = (req, next) => {
  // Check if the client accepts gzip encoding
  const acceptEncoding = req.headers.get("Accept-Encoding") || "";
  const supportsGzip = acceptEncoding.includes("gzip");
  
  // Get the response from the next middleware or route handler
  const response = next();
  
  if (response instanceof Promise) {
    return response.then(async (res) => {
      // Skip compression for certain content types
      const contentType = res.headers.get("Content-Type") || "";
      const shouldCompress = contentType.includes("text/") || 
                             contentType.includes("application/json") ||
                             contentType.includes("application/javascript") ||
                             contentType.includes("application/xml");
      
      if (!supportsGzip || !shouldCompress) {
        return res;
      }
      
      // Get the response body
      const body = await res.text();
      
      // Compress the body
      const compressed = await compress(body);
      
      // Create a new response with the compressed body
      return new Response(compressed, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers({
          ...Object.fromEntries(res.headers.entries()),
          "Content-Encoding": "gzip",
          "Content-Length": String(compressed.byteLength)
        })
      });
    });
  } else {
    // Handle synchronous responses
    // (Similar logic as above, but for synchronous responses)
    return response;
  }
};

// Apply compression middleware
app.use(compression);

// Helper function to compress text using gzip
async function compress(text: string): Promise<Uint8Array> {
  // In a real implementation, you would use a compression library
  // This is a placeholder
  return new TextEncoder().encode(text);
}
```

## Using a Compression Plugin

For a more robust solution, you can use a compression plugin:

```typescript
import { createServer } from "@verb/server";
import compression from "@verb/plugin-compression";

const app = createServer();

// Use the compression plugin
app.use(compression({
  level: 6, // Compression level (1-9)
  threshold: 1024, // Minimum size to compress (in bytes)
  filter: (req, res) => {
    // Only compress certain content types
    const contentType = res.headers.get("Content-Type") || "";
    return contentType.includes("text/") || 
           contentType.includes("application/json") ||
           contentType.includes("application/javascript") ||
           contentType.includes("application/xml");
  }
}));

// Define routes
app.get("/", () => {
  return new Response("Hello from Verb!");
});

app.get("/api/data", () => {
  return new Response(JSON.stringify({
    message: "Hello, World!",
    items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Compression Options

When using a compression plugin, you can configure various options:

```typescript
app.use(compression({
  // Compression level (1-9, where 9 is maximum compression)
  level: 6,
  
  // Minimum size to compress (in bytes)
  threshold: 1024,
  
  // Compression algorithms to use
  algorithms: ["gzip", "deflate", "br"],
  
  // Function to determine if a response should be compressed
  filter: (req, res) => {
    // Only compress GET and POST requests
    if (req.method !== "GET" && req.method !== "POST") {
      return false;
    }
    
    // Only compress certain content types
    const contentType = res.headers.get("Content-Type") || "";
    return contentType.includes("text/") || 
           contentType.includes("application/json") ||
           contentType.includes("application/javascript") ||
           contentType.includes("application/xml");
  },
  
  // Cache compressed responses
  cache: true,
  
  // Cache size (number of responses to cache)
  cacheSize: 100
}));
```

## Content Types to Compress

Not all content types benefit from compression. Here are some content types that typically benefit from compression:

- `text/plain`
- `text/html`
- `text/css`
- `text/javascript`
- `application/json`
- `application/javascript`
- `application/xml`
- `application/xhtml+xml`
- `application/rss+xml`
- `application/atom+xml`

Content types that are already compressed, such as images (JPEG, PNG, GIF), videos (MP4, WebM), and audio (MP3, AAC), should not be compressed again.

## Conditional Compression

You might want to compress responses only under certain conditions:

```typescript
app.use(compression({
  filter: (req, res) => {
    // Only compress responses larger than 1KB
    const contentLength = parseInt(res.headers.get("Content-Length") || "0");
    if (contentLength < 1024) {
      return false;
    }
    
    // Only compress certain content types
    const contentType = res.headers.get("Content-Type") || "";
    return contentType.includes("text/") || 
           contentType.includes("application/json") ||
           contentType.includes("application/javascript") ||
           contentType.includes("application/xml");
  }
}));
```

## Compression Algorithms

There are several compression algorithms available for HTTP responses:

- **Gzip**: The most widely supported compression algorithm.
- **Deflate**: Similar to Gzip but with less overhead.
- **Brotli**: A newer algorithm that offers better compression ratios than Gzip and Deflate.

You can support multiple algorithms and select the best one based on the client's capabilities:

```typescript
app.use(compression({
  algorithms: ["br", "gzip", "deflate"],
  selectAlgorithm: (req) => {
    const acceptEncoding = req.headers.get("Accept-Encoding") || "";
    
    if (acceptEncoding.includes("br")) {
      return "br";
    }
    
    if (acceptEncoding.includes("gzip")) {
      return "gzip";
    }
    
    if (acceptEncoding.includes("deflate")) {
      return "deflate";
    }
    
    return null; // No compression
  }
}));
```

## Caching Compressed Responses

Compressing responses can be CPU-intensive, so you might want to cache compressed responses:

```typescript
app.use(compression({
  cache: true,
  cacheSize: 100, // Cache up to 100 responses
  cacheTTL: 3600 * 1000 // Cache for 1 hour
}));
```

## Compression and Static Files

When serving static files, you can pre-compress them and serve the compressed versions directly:

```typescript
import { createServer, serveStatic } from "@verb/server";

const app = createServer();

// Serve static files with compression
app.get("/static/*", (req) => {
  // Check if the client accepts gzip encoding
  const acceptEncoding = req.headers.get("Accept-Encoding") || "";
  const supportsGzip = acceptEncoding.includes("gzip");
  
  if (supportsGzip) {
    // Try to serve the pre-compressed version
    try {
      return serveStatic(req, {
        directory: "./public",
        rewritePath: (path) => `${path}.gz`,
        headers: {
          "Content-Encoding": "gzip",
          "Vary": "Accept-Encoding"
        }
      });
    } catch (err) {
      // If the pre-compressed version doesn't exist, serve the original
      return serveStatic(req, {
        directory: "./public"
      });
    }
  } else {
    // Serve the original file
    return serveStatic(req, {
      directory: "./public"
    });
  }
});
```

## Best Practices

- **Compress Text-Based Content**: Focus on compressing text-based content like HTML, CSS, JavaScript, and JSON.
- **Skip Already Compressed Content**: Don't compress content that's already compressed, like images and videos.
- **Set Appropriate Headers**: Set the `Content-Encoding` and `Vary: Accept-Encoding` headers.
- **Use a Threshold**: Only compress responses larger than a certain size (e.g., 1KB).
- **Cache Compressed Responses**: Cache compressed responses to reduce CPU usage.
- **Consider Pre-Compression**: Pre-compress static files for better performance.
- **Monitor Performance**: Monitor the impact of compression on server performance.

## Next Steps

Now that you understand response compression in Verb, you can explore related topics:

- [Static Files](/server/static-files) - Learn more about serving static files
- [Middleware](/server/middleware) - Learn how to use middleware for response processing
- [Performance](/server/performance) - Learn about optimizing performance in Verb
- [Plugins](/server/plugins) - Learn about using plugins in Verb