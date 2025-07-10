# Request & Response

This guide covers Verb's enhanced request and response objects, providing a comprehensive API for handling HTTP communication.

## Request Object

Verb enhances the standard Request object with additional properties and methods for easier access to common data.

### Enhanced Properties

```typescript
interface VerbRequest extends globalThis.Request {
  params?: Record<string, string>;     // Route parameters
  query?: Record<string, string>;      // Query string parameters
  body?: any;                          // Parsed request body
  cookies?: Record<string, string>;    // Parsed cookies
  ip?: string;                         // Client IP address
  path?: string;                       // URL path
  hostname?: string;                   // Request hostname
  protocol?: string;                   // http/https
  secure?: boolean;                    // HTTPS check
  xhr?: boolean;                       // XMLHttpRequest check
  get?: (header: string) => string | undefined;
  accepts?: (types?: string | string[]) => string | string[] | null;
  acceptsCharsets?: (charsets?: string | string[]) => string | string[] | null;
  acceptsEncodings?: (encodings?: string | string[]) => string | string[] | null;
  acceptsLanguages?: (languages?: string | string[]) => string | string[] | null;
}
```

### Basic Request Properties

```typescript
app.get("/request-info", (req, res) => {
  res.json({
    method: req.method,           // HTTP method
    url: req.url,                 // Full URL
    path: req.path,               // URL path
    hostname: req.hostname,       // Request hostname
    protocol: req.protocol,       // http/https
    secure: req.secure,           // true for HTTPS
    ip: req.ip,                   // Client IP
    xhr: req.xhr,                 // XMLHttpRequest check
    headers: Object.fromEntries(req.headers.entries())
  });
});
```

### Route Parameters

```typescript
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({ userId: id });
});

app.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});
```

### Query Parameters

```typescript
app.get("/search", (req, res) => {
  const { 
    q,              // Search query
    page = 1,       // Page number with default
    limit = 10,     // Results per page with default
    sort = "name"   // Sort field with default
  } = req.query;
  
  res.json({
    query: q,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit)
    },
    sort
  });
});

// Example URL: /search?q=typescript&page=2&limit=20&sort=date
```

### Request Body

```typescript
// JSON body (with json middleware)
app.post("/users", (req, res) => {
  const { name, email } = req.body;
  res.json({ received: { name, email } });
});

// URL-encoded body (with urlencoded middleware)
app.post("/form", (req, res) => {
  const { username, password } = req.body;
  res.json({ received: { username, password } });
});

// Raw body
app.post("/raw", (req, res) => {
  const rawData = req.body;
  res.json({ length: rawData.length });
});
```

### Headers

```typescript
app.get("/headers", (req, res) => {
  // Get specific header
  const userAgent = req.get("user-agent");
  const authorization = req.get("authorization");
  
  // Get all headers
  const allHeaders = Object.fromEntries(req.headers.entries());
  
  res.json({
    userAgent,
    authorization,
    allHeaders
  });
});
```

### Cookies

```typescript
app.get("/cookies", (req, res) => {
  const { sessionId, preferences } = req.cookies;
  
  res.json({
    sessionId,
    preferences,
    allCookies: req.cookies
  });
});
```

### Content Negotiation

```typescript
app.get("/content-negotiation", (req, res) => {
  // Check what client accepts
  const acceptsJSON = req.accepts("application/json");
  const acceptsHTML = req.accepts("text/html");
  const acceptsXML = req.accepts("application/xml");
  
  // Multiple types
  const bestMatch = req.accepts(["json", "html", "xml"]);
  
  // Charset negotiation
  const charset = req.acceptsCharsets(["utf-8", "iso-8859-1"]);
  
  // Encoding negotiation
  const encoding = req.acceptsEncodings(["gzip", "deflate"]);
  
  // Language negotiation
  const language = req.acceptsLanguages(["en", "es", "fr"]);
  
  res.json({
    acceptsJSON,
    acceptsHTML,
    acceptsXML,
    bestMatch,
    charset,
    encoding,
    language
  });
});
```

## Response Object

Verb provides a fluent response API with methods for common response operations.

### Response Methods

```typescript
interface VerbResponse {
  send(data: string | object | number | boolean): VerbResponse;
  json(data: any): VerbResponse;
  status(code: number): VerbResponse;
  redirect(url: string, code?: number): VerbResponse;
  html(content: string): VerbResponse;
  text(content: string): VerbResponse;
  header(name: string, value: string): VerbResponse;
  headers(headers: Record<string, string>): VerbResponse;
  cookie(name: string, value: string, options?: CookieOptions): VerbResponse;
  clearCookie(name: string): VerbResponse;
  type(contentType: string): VerbResponse;
  attachment(filename?: string): VerbResponse;
  download(path: string, filename?: string): Promise<VerbResponse>;
  sendFile(path: string): Promise<VerbResponse>;
  vary(header: string): VerbResponse;
  end(): VerbResponse;
}
```

### JSON Responses

```typescript
app.get("/json", (req, res) => {
  res.json({ 
    message: "JSON response",
    timestamp: new Date().toISOString(),
    data: [1, 2, 3, 4, 5]
  });
});

// With status code
app.post("/users", (req, res) => {
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

### Text Responses

```typescript
app.get("/text", (req, res) => {
  res.text("Plain text response");
});

app.get("/csv", (req, res) => {
  const csv = "name,email\nJohn,john@example.com\nJane,jane@example.com";
  res.type("text/csv")
     .attachment("users.csv")
     .text(csv);
});
```

### HTML Responses

```typescript
app.get("/html", (req, res) => {
  res.html(`
    <html>
      <head><title>HTML Response</title></head>
      <body>
        <h1>Hello from Verb!</h1>
        <p>This is an HTML response.</p>
      </body>
    </html>
  `);
});
```

### Status Codes

```typescript
app.get("/status-examples", (req, res) => {
  const { code = "200" } = req.query;
  
  switch (code) {
    case "200":
      res.status(200).json({ status: "OK" });
      break;
    case "201":
      res.status(201).json({ status: "Created" });
      break;
    case "400":
      res.status(400).json({ error: "Bad Request" });
      break;
    case "401":
      res.status(401).json({ error: "Unauthorized" });
      break;
    case "404":
      res.status(404).json({ error: "Not Found" });
      break;
    case "500":
      res.status(500).json({ error: "Internal Server Error" });
      break;
    default:
      res.status(200).json({ status: "OK" });
  }
});
```

### Headers

```typescript
app.get("/headers-example", (req, res) => {
  // Single header
  res.header("X-Custom-Header", "custom-value");
  
  // Multiple headers
  res.headers({
    "X-API-Version": "1.0",
    "X-Request-ID": "abc-123",
    "Cache-Control": "no-cache"
  });
  
  // Content type
  res.type("application/json");
  
  // Vary header
  res.vary("Accept-Encoding");
  
  res.json({ message: "Headers set" });
});
```

### Cookies

```typescript
app.get("/set-cookies", (req, res) => {
  // Basic cookie
  res.cookie("sessionId", "abc123");
  
  // Cookie with options
  res.cookie("preferences", "dark-mode", {
    maxAge: 86400000,     // 24 hours
    httpOnly: true,       // HTTP only (not accessible via JS)
    secure: true,         // HTTPS only
    sameSite: "strict",   // CSRF protection
    domain: ".example.com", // Domain scope
    path: "/"             // Path scope
  });
  
  res.json({ message: "Cookies set" });
});

app.get("/clear-cookies", (req, res) => {
  res.clearCookie("sessionId");
  res.clearCookie("preferences");
  res.json({ message: "Cookies cleared" });
});
```

### Redirects

```typescript
app.get("/redirect-examples", (req, res) => {
  const { type = "temp" } = req.query;
  
  switch (type) {
    case "temp":
      res.redirect("/new-location"); // 302 temporary
      break;
    case "perm":
      res.redirect("/new-location", 301); // 301 permanent
      break;
    case "found":
      res.redirect("/new-location", 302); // 302 found
      break;
    case "seeother":
      res.redirect("/new-location", 303); // 303 see other
      break;
    default:
      res.redirect("/");
  }
});
```

### File Operations

```typescript
app.get("/download", async (req, res) => {
  // Download a file
  await res.download("./files/document.pdf");
});

app.get("/download-with-name", async (req, res) => {
  // Download with custom filename
  await res.download("./files/report.pdf", "monthly-report.pdf");
});

app.get("/send-file", async (req, res) => {
  // Send file content
  await res.sendFile("./public/index.html");
});

app.get("/attachment", (req, res) => {
  // Set attachment headers
  res.attachment("data.json");
  res.json({ data: "file content" });
});
```

### Response Chaining

```typescript
app.get("/chaining", (req, res) => {
  res
    .status(201)
    .header("X-Custom", "value")
    .cookie("session", "abc123")
    .json({ 
      message: "Chained response",
      success: true 
    });
});
```

## Content Types

### Auto Content-Type Detection

```typescript
app.get("/auto-content-type", (req, res) => {
  // Automatically sets Content-Type: application/json
  res.json({ data: "json" });
  
  // Automatically sets Content-Type: text/plain
  res.text("plain text");
  
  // Automatically sets Content-Type: text/html
  res.html("<h1>HTML</h1>");
});
```

### Manual Content-Type

```typescript
app.get("/manual-content-type", (req, res) => {
  res.type("application/xml");
  res.send("<?xml version=\"1.0\"?><root><data>xml</data></root>");
});

app.get("/image", (req, res) => {
  res.type("image/png");
  // Send image data...
});
```

## Error Responses

### Standard Error Responses

```typescript
app.get("/error-examples", (req, res) => {
  const { type } = req.query;
  
  switch (type) {
    case "bad-request":
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid parameters provided"
      });
      break;
      
    case "unauthorized":
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required"
      });
      break;
      
    case "forbidden":
      res.status(403).json({
        error: "Forbidden",
        message: "Access denied"
      });
      break;
      
    case "not-found":
      res.status(404).json({
        error: "Not Found",
        message: "Resource not found"
      });
      break;
      
    case "validation":
      res.status(422).json({
        error: "Validation Error",
        message: "Invalid input data",
        details: [
          { field: "email", message: "Invalid email format" },
          { field: "age", message: "Must be a positive number" }
        ]
      });
      break;
      
    case "server-error":
      res.status(500).json({
        error: "Internal Server Error",
        message: "Something went wrong"
      });
      break;
      
    default:
      res.status(200).json({ message: "No error" });
  }
});
```

## Streaming Responses

### Text Streaming

```typescript
app.get("/stream", (req, res) => {
  res.type("text/plain");
  res.header("Cache-Control", "no-cache");
  
  let count = 0;
  const interval = setInterval(() => {
    res.write(`Data chunk ${count++}\n`);
    
    if (count >= 10) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
});
```

### JSON Streaming

```typescript
app.get("/json-stream", (req, res) => {
  res.type("application/json");
  res.header("Cache-Control", "no-cache");
  
  res.write('[');
  
  let count = 0;
  const interval = setInterval(() => {
    const data = { id: count, timestamp: new Date().toISOString() };
    
    if (count > 0) res.write(',');
    res.write(JSON.stringify(data));
    
    count++;
    
    if (count >= 5) {
      clearInterval(interval);
      res.write(']');
      res.end();
    }
  }, 1000);
});
```

## Response Helpers

### Custom Response Helpers

```typescript
// Add custom response methods
app.use((req, res, next) => {
  // Success response helper
  res.success = (data, message = "Success") => {
    return res.json({
      success: true,
      message,
      data
    });
  };
  
  // Error response helper
  res.error = (message, status = 400, code = null) => {
    return res.status(status).json({
      success: false,
      error: message,
      code
    });
  };
  
  // Paginated response helper
  res.paginate = (data, page, limit, total) => {
    return res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  };
  
  next();
});

// Usage
app.get("/users", (req, res) => {
  const users = getUsersFromDB();
  res.success(users, "Users retrieved successfully");
});

app.get("/users/:id", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.error("User not found", 404, "USER_NOT_FOUND");
  }
  res.success(user);
});
```

## Content Negotiation

### Accept Header Handling

```typescript
app.get("/api/data", (req, res) => {
  const data = { message: "Hello World", timestamp: new Date().toISOString() };
  
  const accepts = req.accepts(["json", "xml", "html", "text"]);
  
  switch (accepts) {
    case "json":
      res.json(data);
      break;
      
    case "xml":
      res.type("application/xml");
      res.send(`
        <?xml version="1.0"?>
        <root>
          <message>${data.message}</message>
          <timestamp>${data.timestamp}</timestamp>
        </root>
      `);
      break;
      
    case "html":
      res.html(`
        <html>
          <body>
            <h1>${data.message}</h1>
            <p>Time: ${data.timestamp}</p>
          </body>
        </html>
      `);
      break;
      
    case "text":
      res.text(`${data.message} - ${data.timestamp}`);
      break;
      
    default:
      res.status(406).json({ error: "Not Acceptable" });
  }
});
```

## Performance Optimization

### Response Caching

```typescript
app.get("/cached-response", (req, res) => {
  // Set cache headers
  res.header("Cache-Control", "public, max-age=3600"); // 1 hour
  res.header("ETag", "\"123456\"");
  res.header("Last-Modified", new Date().toUTCString());
  
  res.json({ data: "cached response" });
});
```

### Compression

```typescript
app.get("/large-response", (req, res) => {
  // Enable compression for large responses
  res.header("Content-Encoding", "gzip");
  
  const largeData = generateLargeDataset();
  res.json(largeData);
});
```

## Testing

### Testing Request/Response

```typescript
import { test, expect } from "bun:test";
import { createServer } from "verb";

test("request parameters", async () => {
  const app = createServer();
  
  app.get("/users/:id", (req, res) => {
    res.json({ id: req.params.id });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/users/123"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.id).toBe("123");
});

test("response status and headers", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.status(201)
       .header("X-Custom", "value")
       .json({ created: true });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/test"));
  
  expect(response.status).toBe(201);
  expect(response.headers.get("X-Custom")).toBe("value");
  
  const data = await response.json();
  expect(data.created).toBe(true);
});
```

## Best Practices

1. **Always Validate Input**: Check request parameters and body data
2. **Use Appropriate Status Codes**: Return correct HTTP status codes
3. **Set Proper Headers**: Include appropriate response headers
4. **Handle Errors Gracefully**: Provide meaningful error messages
5. **Use Content Negotiation**: Support multiple response formats
6. **Implement Caching**: Use caching headers for performance
7. **Secure Cookies**: Use secure cookie options in production
8. **Validate Content Types**: Check request content types
9. **Rate Limiting**: Implement rate limiting for API endpoints
10. **Log Requests**: Log important request/response information

## Common Patterns

### API Response Format

```typescript
const standardResponse = (res, data, success = true, message = null) => {
  return res.json({
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};
```

### Error Handling

```typescript
const handleError = (res, error, status = 500) => {
  return res.status(status).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
};
```

### Request Validation

```typescript
const validateRequest = (req, requiredFields) => {
  const missing = requiredFields.filter(field => !req.body[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
};
```

## Next Steps

- [Error Handling](/guide/error-handling) - Comprehensive error handling
- [Security](/guide/security) - Request/response security
- [Performance](/guide/performance) - Optimization techniques
- [Testing](/guide/testing) - Testing strategies