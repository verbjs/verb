# Request API

Complete API reference for Verb's enhanced request object with additional properties and methods for easier HTTP handling.

## Interface

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

## Properties

### params

Route parameters from URL patterns.

```typescript
req.params: Record<string, string> | undefined
```

**Example:**
```typescript
// Route: /users/:id/posts/:postId
app.get("/users/:id/posts/:postId", (req, res) => {
  const { id, postId } = req.params;
  // id and postId are strings
});
```

### query

Query string parameters parsed from URL.

```typescript
req.query: Record<string, string> | undefined
```

**Example:**
```typescript
// URL: /search?q=typescript&page=2&limit=10
app.get("/search", (req, res) => {
  const { q, page, limit } = req.query;
  // All values are strings: "typescript", "2", "10"
});
```

### body

Parsed request body (requires middleware).

```typescript
req.body: any
```

**Example:**
```typescript
app.use(middleware.json());

app.post("/users", (req, res) => {
  const { name, email } = req.body;
  // body is parsed JSON object
});
```

### cookies

Parsed cookies from Cookie header.

```typescript
req.cookies: Record<string, string> | undefined
```

**Example:**
```typescript
app.get("/profile", (req, res) => {
  const { sessionId, preferences } = req.cookies;
});
```

### ip

Client IP address.

```typescript
req.ip: string | undefined
```

### path

URL pathname without query string.

```typescript
req.path: string | undefined
```

### hostname

Request hostname.

```typescript
req.hostname: string | undefined
```

### protocol

Request protocol (http or https).

```typescript
req.protocol: string | undefined
```

### secure

Whether the request is HTTPS.

```typescript
req.secure: boolean | undefined
```

### xhr

Whether the request is an XMLHttpRequest.

```typescript
req.xhr: boolean | undefined
```

## Methods

### get(header)

Get request header value.

```typescript
req.get(header: string): string | undefined
```

**Example:**
```typescript
app.get("/api/data", (req, res) => {
  const userAgent = req.get("user-agent");
  const authorization = req.get("authorization");
  const contentType = req.get("content-type");
});
```

### accepts(types?)

Check what content types the client accepts.

```typescript
req.accepts(types?: string | string[]): string | string[] | null
```

**Example:**
```typescript
app.get("/data", (req, res) => {
  const accepts = req.accepts(["json", "html", "xml"]);
  
  switch (accepts) {
    case "json":
      res.json({ data: "json" });
      break;
    case "html":
      res.html("<h1>HTML</h1>");
      break;
    case "xml":
      res.type("application/xml").send("<data>xml</data>");
      break;
    default:
      res.status(406).json({ error: "Not Acceptable" });
  }
});
```

### acceptsCharsets(charsets?)

Check what character sets the client accepts.

```typescript
req.acceptsCharsets(charsets?: string | string[]): string | string[] | null
```

### acceptsEncodings(encodings?)

Check what encodings the client accepts.

```typescript
req.acceptsEncodings(encodings?: string | string[]): string | string[] | null
```

### acceptsLanguages(languages?)

Check what languages the client accepts.

```typescript
req.acceptsLanguages(languages?: string | string[]): string | string[] | null
```

## Standard Request Properties

Verb requests also inherit all standard Request properties:

### method

HTTP method (GET, POST, etc.).

```typescript
req.method: string
```

### url

Full request URL.

```typescript
req.url: string
```

### headers

Request headers.

```typescript
req.headers: Headers
```

**Example:**
```typescript
app.post("/upload", (req, res) => {
  const contentType = req.headers.get("content-type");
  const contentLength = req.headers.get("content-length");
  
  // Iterate over all headers
  for (const [name, value] of req.headers) {
    console.log(`${name}: ${value}`);
  }
});
```

### signal

AbortSignal for request cancellation.

```typescript
req.signal: AbortSignal
```

## Request Body Methods

### json()

Parse request body as JSON.

```typescript
req.json(): Promise<any>
```

### text()

Parse request body as text.

```typescript
req.text(): Promise<string>
```

### formData()

Parse request body as FormData.

```typescript
req.formData(): Promise<FormData>
```

### arrayBuffer()

Parse request body as ArrayBuffer.

```typescript
req.arrayBuffer(): Promise<ArrayBuffer>
```

### blob()

Parse request body as Blob.

```typescript
req.blob(): Promise<Blob>
```

## Examples

### Basic Request Handling

```typescript
app.get("/info", (req, res) => {
  res.json({
    method: req.method,
    url: req.url,
    path: req.path,
    hostname: req.hostname,
    protocol: req.protocol,
    secure: req.secure,
    ip: req.ip,
    userAgent: req.get("user-agent")
  });
});
```

### Route Parameters

```typescript
app.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params;
  
  res.json({
    user: userId,
    post: postId,
    url: `/users/${userId}/posts/${postId}`
  });
});
```

### Query Parameters

```typescript
app.get("/search", (req, res) => {
  const {
    q = "",
    page = "1",
    limit = "10",
    sort = "created"
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
```

### Content Negotiation

```typescript
app.get("/api/users", (req, res) => {
  const users = getUsersFromDatabase();
  const accepts = req.accepts(["json", "xml", "csv"]);
  
  switch (accepts) {
    case "json":
      res.json(users);
      break;
    case "xml":
      res.type("application/xml").send(usersToXML(users));
      break;
    case "csv":
      res.type("text/csv").send(usersToCSV(users));
      break;
    default:
      res.status(406).json({ error: "Not Acceptable" });
  }
});
```

### Request Validation

```typescript
app.post("/api/users", (req, res) => {
  // Validate content type
  const contentType = req.get("content-type");
  if (!contentType?.includes("application/json")) {
    return res.status(400).json({ 
      error: "Content-Type must be application/json" 
    });
  }
  
  // Validate required fields
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ 
      error: "Name and email are required" 
    });
  }
  
  // Process valid request
  const user = createUser({ name, email });
  res.status(201).json(user);
});
```

## TypeScript Types

```typescript
interface VerbRequest extends globalThis.Request {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
  ip?: string;
  path?: string;
  hostname?: string;
  protocol?: string;
  secure?: boolean;
  xhr?: boolean;
  get(header: string): string | undefined;
  accepts(types?: string | string[]): string | string[] | null;
  acceptsCharsets(charsets?: string | string[]): string | string[] | null;
  acceptsEncodings(encodings?: string | string[]): string | string[] | null;
  acceptsLanguages(languages?: string | string[]): string | string[] | null;
}

type RouteHandler = (
  req: VerbRequest,
  res: VerbResponse,
  next?: NextFunction
) => void | Promise<void>;
```

## See Also

- [Response API](/api/response) - Response object reference
- [Routing API](/api/routing) - Route handling
- [Middleware API](/api/middleware) - Request processing middleware