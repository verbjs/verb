# Response API

Complete API reference for Verb's enhanced response object with methods for sending various response types.

## Interface

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

## Response Methods

### json(data)

Send a JSON response.

```typescript
res.json(data: any): VerbResponse
```

**Example:**
```typescript
app.get("/api/users", (req, res) => {
  res.json({
    users: [
      { id: 1, name: "John" },
      { id: 2, name: "Jane" }
    ],
    total: 2
  });
});

// With status code
app.post("/api/users", (req, res) => {
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

### text(content)

Send a plain text response.

```typescript
res.text(content: string): VerbResponse
```

**Example:**
```typescript
app.get("/robots.txt", (req, res) => {
  res.text(`User-agent: *
Disallow: /admin/
Allow: /`);
});
```

### html(content)

Send an HTML response.

```typescript
res.html(content: string): VerbResponse
```

**Example:**
```typescript
app.get("/", (req, res) => {
  res.html(`
    <html>
      <head><title>Welcome</title></head>
      <body>
        <h1>Hello World!</h1>
        <p>Welcome to Verb</p>
      </body>
    </html>
  `);
});
```

### send(data)

Send a generic response (auto-detects content type).

```typescript
res.send(data: string | object | number | boolean): VerbResponse
```

**Example:**
```typescript
app.get("/data", (req, res) => {
  res.send({ message: "Auto JSON" });        // JSON
  res.send("Plain text");                    // Text
  res.send("<h1>HTML</h1>");                // HTML
  res.send(42);                              // Number as text
  res.send(true);                            // Boolean as text
});
```

### status(code)

Set the response status code.

```typescript
res.status(code: number): VerbResponse
```

**Example:**
```typescript
app.get("/api/users/:id", (req, res) => {
  const user = findUser(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  res.status(200).json(user);
});

// Common status codes
res.status(200);  // OK
res.status(201);  // Created
res.status(400);  // Bad Request
res.status(401);  // Unauthorized
res.status(403);  // Forbidden
res.status(404);  // Not Found
res.status(500);  // Internal Server Error
```

### redirect(url, code?)

Redirect to another URL.

```typescript
res.redirect(url: string, code?: number): VerbResponse
```

**Example:**
```typescript
app.get("/old-page", (req, res) => {
  res.redirect("/new-page");              // 302 temporary
  res.redirect("/new-page", 301);         // 301 permanent
  res.redirect("/new-page", 303);         // 303 see other
});

app.post("/login", (req, res) => {
  if (validLogin(req.body)) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/login?error=invalid");
  }
});
```

## Headers

### header(name, value)

Set a single response header.

```typescript
res.header(name: string, value: string): VerbResponse
```

**Example:**
```typescript
app.get("/api/data", (req, res) => {
  res.header("X-API-Version", "1.0");
  res.header("X-Rate-Limit", "100");
  res.header("Cache-Control", "no-cache");
  res.json({ data: "example" });
});
```

### headers(headers)

Set multiple response headers.

```typescript
res.headers(headers: Record<string, string>): VerbResponse
```

**Example:**
```typescript
app.get("/api/data", (req, res) => {
  res.headers({
    "X-API-Version": "1.0",
    "X-Rate-Limit": "100",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*"
  });
  res.json({ data: "example" });
});
```

### type(contentType)

Set the Content-Type header.

```typescript
res.type(contentType: string): VerbResponse
```

**Example:**
```typescript
app.get("/api/xml", (req, res) => {
  res.type("application/xml");
  res.send(`<?xml version="1.0"?><root><data>xml</data></root>`);
});

app.get("/api/csv", (req, res) => {
  res.type("text/csv");
  res.send("name,email\nJohn,john@example.com");
});
```

### vary(header)

Add to the Vary header.

```typescript
res.vary(header: string): VerbResponse
```

**Example:**
```typescript
app.get("/api/data", (req, res) => {
  res.vary("Accept-Encoding");
  res.vary("User-Agent");
  res.json({ data: "varies by encoding and user agent" });
});
```

## Cookies

### cookie(name, value, options?)

Set a response cookie.

```typescript
res.cookie(name: string, value: string, options?: CookieOptions): VerbResponse
```

**Options:**
```typescript
interface CookieOptions {
  maxAge?: number;        // Max age in milliseconds
  expires?: Date;         // Expiration date
  httpOnly?: boolean;     // HTTP only (not accessible via JS)
  secure?: boolean;       // HTTPS only
  sameSite?: "strict" | "lax" | "none";
  domain?: string;        // Cookie domain
  path?: string;          // Cookie path
}
```

**Example:**
```typescript
app.post("/login", (req, res) => {
  if (validLogin(req.body)) {
    // Session cookie
    res.cookie("sessionId", generateSessionId(), {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000  // 24 hours
    });
    
    // Preference cookie
    res.cookie("theme", "dark", {
      maxAge: 365 * 24 * 60 * 60 * 1000,  // 1 year
      sameSite: "lax"
    });
    
    res.json({ success: true });
  }
});
```

### clearCookie(name)

Clear a response cookie.

```typescript
res.clearCookie(name: string): VerbResponse
```

**Example:**
```typescript
app.post("/logout", (req, res) => {
  res.clearCookie("sessionId");
  res.clearCookie("preferences");
  res.json({ message: "Logged out successfully" });
});
```

## File Operations

### sendFile(path)

Send a file as response.

```typescript
res.sendFile(path: string): Promise<VerbResponse>
```

**Example:**
```typescript
app.get("/", async (req, res) => {
  await res.sendFile("./public/index.html");
});

app.get("/images/:filename", async (req, res) => {
  const filename = req.params.filename;
  await res.sendFile(`./uploads/${filename}`);
});
```

### download(path, filename?)

Send a file as download with Content-Disposition header.

```typescript
res.download(path: string, filename?: string): Promise<VerbResponse>
```

**Example:**
```typescript
app.get("/download/report", async (req, res) => {
  await res.download("./reports/monthly.pdf");
});

app.get("/download/report/:id", async (req, res) => {
  const reportPath = `./reports/${req.params.id}.pdf`;
  await res.download(reportPath, "custom-report.pdf");
});
```

### attachment(filename?)

Set Content-Disposition header to attachment.

```typescript
res.attachment(filename?: string): VerbResponse
```

**Example:**
```typescript
app.get("/export/users", (req, res) => {
  const csv = generateUserCSV();
  res.attachment("users.csv");
  res.type("text/csv");
  res.send(csv);
});
```

## Response Chaining

All response methods return the response object for chaining:

```typescript
app.get("/api/data", (req, res) => {
  res
    .status(200)
    .header("X-API-Version", "1.0")
    .header("Cache-Control", "public, max-age=3600")
    .cookie("viewed", "true", { maxAge: 86400000 })
    .json({
      data: "example",
      timestamp: new Date().toISOString()
    });
});
```

## Error Responses

### Standard Error Format

```typescript
app.get("/api/users/:id", (req, res) => {
  const user = findUser(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      error: "Not Found",
      message: "User not found",
      code: "USER_NOT_FOUND"
    });
  }
  
  res.json(user);
});
```

### Validation Errors

```typescript
app.post("/api/users", (req, res) => {
  const errors = validateUser(req.body);
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: "Validation Error",
      message: "Invalid input data",
      details: errors
    });
  }
  
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

## Content Negotiation

```typescript
app.get("/api/users", (req, res) => {
  const users = getUsers();
  const accepts = req.accepts(["json", "xml", "csv"]);
  
  switch (accepts) {
    case "json":
      res.json(users);
      break;
    case "xml":
      res.type("application/xml");
      res.send(convertToXML(users));
      break;
    case "csv":
      res.type("text/csv");
      res.attachment("users.csv");
      res.send(convertToCSV(users));
      break;
    default:
      res.status(406).json({ error: "Not Acceptable" });
  }
});
```

## Streaming Responses

```typescript
app.get("/api/stream", (req, res) => {
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

## Response Helpers

Create custom response helpers:

```typescript
// Add to middleware
app.use((req, res, next) => {
  res.success = (data, message = "Success") => {
    return res.json({
      success: true,
      message,
      data
    });
  };
  
  res.error = (message, status = 400, code = null) => {
    return res.status(status).json({
      success: false,
      error: message,
      code
    });
  };
  
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
app.get("/api/users", (req, res) => {
  const users = getUsers();
  res.success(users, "Users retrieved successfully");
});

app.get("/api/users/:id", (req, res) => {
  const user = findUser(req.params.id);
  if (!user) {
    return res.error("User not found", 404, "USER_NOT_FOUND");
  }
  res.success(user);
});
```

## TypeScript Types

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

interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  domain?: string;
  path?: string;
}
```

## See Also

- [Request API](/api/request) - Request object reference
- [Routing API](/api/routing) - Route handling
- [Middleware API](/api/middleware) - Response processing middleware