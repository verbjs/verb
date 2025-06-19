---
title: Security API Reference
description: Complete reference for Verb security features
---

# Security API Reference

This document provides a comprehensive reference for the security features in Verb, including CSRF protection, input sanitization, rate limiting, and error handling.

## Security Headers

### securityHeaders

Adds security headers to responses to protect against common web vulnerabilities.

```typescript
const securityHeaders = (options?: SecurityOptions) => Middleware;
```

**Options:**
- `xssProtection`: Enable X-XSS-Protection header (default: true)
- `contentTypeOptions`: Enable X-Content-Type-Options header (default: true)
- `frameOptions`: X-Frame-Options value (default: "SAMEORIGIN")
- `contentSecurityPolicy`: Content-Security-Policy value
- `strictTransportSecurity`: Strict-Transport-Security value
- `referrerPolicy`: Referrer-Policy value (default: "no-referrer-when-downgrade")
- `permissionsPolicy`: Permissions-Policy value
- `cacheControl`: Cache-Control value for sensitive routes

**Example:**
```typescript
app.use(securityHeaders({
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: "camera=(), microphone=(), geolocation=()"
}));
```

### defaultSecurity

Applies a set of recommended security headers for most applications.

```typescript
const defaultSecurity = () => Middleware;
```

**Example:**
```typescript
app.use(defaultSecurity());
```

## CSRF Protection

### csrfProtection

Adds Cross-Site Request Forgery (CSRF) protection to forms and API endpoints.

```typescript
const csrfProtection = (options?: CSRFOptions) => Middleware;
```

**Options:**
- `cookieName`: Name of the CSRF cookie (default: "csrf")
- `headerName`: Name of the CSRF header (default: "X-CSRF-Token")
- `formFieldName`: Name of the CSRF form field (default: "_csrf")
- `secret`: Secret for signing tokens (default: random)
- `ignoreMethods`: HTTP methods to ignore (default: ["GET", "HEAD", "OPTIONS"])
- `cookieOptions`: Options for the CSRF cookie
- `size`: Size of the token in bytes (default: 32)
- `ignorePaths`: Paths to ignore CSRF protection for

**Example:**
```typescript
app.use(csrfProtection({
  cookieName: "xsrf-token",
  headerName: "X-XSRF-TOKEN",
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
  ignorePaths: ["/webhook", "/api/external"]
}));
```

### generateCSRFToken

Generates a CSRF token for use in forms and API requests.

```typescript
const generateCSRFToken = (secret?: string, size?: number) => string;
```

**Parameters:**
- `secret`: Secret for signing the token (default: random)
- `size`: Size of the token in bytes (default: 32)

**Returns:** CSRF token

**Example:**
```typescript
app.get("/form", (req) => {
  const token = generateCSRFToken("my-secret");
  return html(`
    <form method="post" action="/submit">
      <input type="hidden" name="_csrf" value="${token}">
      <input type="text" name="username">
      <button type="submit">Submit</button>
    </form>
  `);
});
```

## Input Sanitization

### inputSanitization

Sanitizes input to prevent Cross-Site Scripting (XSS) attacks.

```typescript
const inputSanitization = (options?: SanitizationOptions) => Middleware;
```

**Options:**
- `sanitizeBody`: Sanitize request body (default: true)
- `sanitizeQuery`: Sanitize query parameters (default: true)
- `sanitizeParams`: Sanitize route parameters (default: true)
- `sanitizeHeaders`: Sanitize headers (default: false)
- `sanitizers`: Custom sanitizer functions
- `allowedTags`: HTML tags to allow (for HTML sanitization)
- `allowedAttributes`: HTML attributes to allow
- `mode`: Sanitization mode ("strict" or "relaxed")

**Example:**
```typescript
app.use(inputSanitization({
  sanitizeHeaders: true,
  mode: "strict",
  sanitizers: [
    (input) => input.replace(/script/gi, "")
  ]
}));
```

### Sanitization Functions

#### stripHtml

Removes all HTML tags from a string.

```typescript
const stripHtml = (input: string) => string;
```

**Example:**
```typescript
const safeText = stripHtml("<script>alert('XSS')</script>Hello");
// safeText = "Hello"
```

#### stripScripts

Removes script tags and event handlers from a string.

```typescript
const stripScripts = (input: string) => string;
```

**Example:**
```typescript
const safeText = stripScripts("<div onclick=\"alert('XSS')\">Hello</div>");
// safeText = "<div>Hello</div>"
```

#### removeNullBytes

Removes null bytes from a string to prevent null byte injection attacks.

```typescript
const removeNullBytes = (input: string) => string;
```

**Example:**
```typescript
const safeText = removeNullBytes("Hello\0World");
// safeText = "HelloWorld"
```

#### sanitizeString

Sanitizes a string using all available sanitizers.

```typescript
const sanitizeString = (input: string, options?: SanitizationOptions) => string;
```

**Example:**
```typescript
const safeText = sanitizeString("<script>alert('XSS')</script>Hello");
// safeText = "Hello"
```

#### sanitizeObject

Recursively sanitizes an object.

```typescript
const sanitizeObject = (obj: any, options?: SanitizationOptions) => any;
```

**Example:**
```typescript
const safeObject = sanitizeObject({
  name: "<script>alert('XSS')</script>John",
  description: "<img src='x' onerror='alert(1)'>Bio"
});
// safeObject = { name: "John", description: "<img src='x'>Bio" }
```

## Rate Limiting

### rateLimit

Generic rate limiting middleware to prevent abuse.

```typescript
const rateLimit = (options?: RateLimitOptions) => Middleware;
```

**Options:**
- `windowMs`: Time window in milliseconds (default: 60000)
- `max`: Maximum requests per window (default: 100)
- `message`: Error message (default: "Too many requests")
- `statusCode`: Error status code (default: 429)
- `headers`: Include rate limit headers (default: true)
- `keyGenerator`: Function to generate keys (default: IP-based)
- `skip`: Function to skip rate limiting for certain requests
- `store`: Custom store for tracking requests
- `handler`: Custom handler for rate limit exceeded

**Example:**
```typescript
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests, please try again later",
  headers: true
}));
```

### Specialized Rate Limiters

#### rateLimitByIP

Rate limits requests based on client IP address.

```typescript
const rateLimitByIP = (options?: RateLimitOptions) => Middleware;
```

**Example:**
```typescript
app.use(rateLimitByIP({
  windowMs: 60 * 1000, // 1 minute
  max: 30 // 30 requests per minute per IP
}));
```

#### rateLimitByEndpoint

Rate limits requests based on the endpoint being accessed.

```typescript
const rateLimitByEndpoint = (options?: RateLimitOptions) => Middleware;
```

**Example:**
```typescript
app.use(rateLimitByEndpoint({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per endpoint
  keyGenerator: (req) => `${req.method}:${new URL(req.url).pathname}`
}));
```

#### rateLimitByUser

Rate limits requests based on user ID (requires authentication).

```typescript
const rateLimitByUser = (options?: RateLimitOptions) => Middleware;
```

**Example:**
```typescript
app.use(rateLimitByUser({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per user
  keyGenerator: (req) => (req as any).user?.id || req.headers.get("X-API-Key") || req.ip
}));
```

#### strictRateLimit

Implements a strict rate limiting algorithm using token bucket.

```typescript
const strictRateLimit = (options?: RateLimitOptions) => Middleware;
```

**Example:**
```typescript
app.use(strictRateLimit({
  windowMs: 1000, // 1 second
  max: 10, // 10 requests per second
  message: "Rate limit exceeded"
}));
```

### Rate Limit Stores

#### createMemoryStore

Creates an in-memory store for rate limiting.

```typescript
const createMemoryStore = (options?: MemoryStoreOptions) => RateLimitStore;
```

**Options:**
- `cleanupInterval`: Interval to clean expired entries in ms (default: 60000)
- `maxEntries`: Maximum number of entries to store (default: 10000)

**Example:**
```typescript
const store = createMemoryStore({
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  maxEntries: 5000
});

app.use(rateLimit({
  store,
  windowMs: 60 * 1000,
  max: 100
}));
```

#### createSlidingWindowStore

Creates a sliding window store for more accurate rate limiting.

```typescript
const createSlidingWindowStore = (options?: SlidingWindowOptions) => RateLimitStore;
```

**Example:**
```typescript
const store = createSlidingWindowStore({
  windowSize: 60, // 60 second window
  precision: 5 // 5 second precision
});

app.use(rateLimit({
  store,
  windowMs: 60 * 1000,
  max: 100
}));
```

#### createTokenBucketStore

Creates a token bucket store for burst-tolerant rate limiting.

```typescript
const createTokenBucketStore = (options?: TokenBucketOptions) => RateLimitStore;
```

**Options:**
- `refillRate`: Tokens added per second (default: 1)
- `capacity`: Maximum tokens per bucket (default: 60)

**Example:**
```typescript
const store = createTokenBucketStore({
  refillRate: 10, // 10 tokens per second
  capacity: 100 // Maximum 100 tokens
});

app.use(rateLimit({
  store,
  max: 1, // Each request consumes 1 token
  windowMs: 1000 // Not used with token bucket
}));
```

## Error Handling

### Error Types

Verb provides a set of error classes for different HTTP status codes:

#### VerbError

Base error class for all Verb errors.

```typescript
class VerbError extends Error {
  statusCode: number;
  details?: any;
}
```

#### Specific Error Classes

- `BadRequestError`: 400 Bad Request
- `UnauthorizedError`: 401 Unauthorized
- `ForbiddenError`: 403 Forbidden
- `NotFoundError`: 404 Not Found
- `ConflictError`: 409 Conflict
- `ValidationError`: 422 Unprocessable Entity
- `RateLimitError`: 429 Too Many Requests
- `InternalServerError`: 500 Internal Server Error

### Error Creation Functions

#### createVerbError

Creates a Verb error with status code and details.

```typescript
const createVerbError = (
  message: string, 
  statusCode: number, 
  details?: any
) => VerbError;
```

**Example:**
```typescript
throw createVerbError("Invalid input", 400, { field: "email" });
```

#### Specific Error Creation Functions

- `createBadRequestError(message, details)`: 400 Bad Request
- `createUnauthorizedError(message, details)`: 401 Unauthorized
- `createForbiddenError(message, details)`: 403 Forbidden
- `createNotFoundError(message, details)`: 404 Not Found
- `createConflictError(message, details)`: 409 Conflict
- `createValidationError(message, details)`: 422 Unprocessable Entity
- `createRateLimitError(message, details)`: 429 Too Many Requests
- `createInternalServerError(message, details)`: 500 Internal Server Error

**Example:**
```typescript
throw createNotFoundError("User not found", { userId: 123 });
```

### Error Handling Utilities

#### errorHandler

Creates an error handling middleware.

```typescript
const errorHandler = (options?: ErrorHandlerOptions) => Middleware;
```

**Options:**
- `log`: Whether to log errors (default: true)
- `includeErrorMessage`: Include error message in response (default: true)
- `includeStackTrace`: Include stack trace in development (default: true)
- `fallbackMessage`: Message for non-Verb errors (default: "Internal Server Error")
- `formatError`: Function to format error responses

**Example:**
```typescript
app.use(errorHandler({
  includeStackTrace: process.env.NODE_ENV !== "production",
  formatError: (err) => ({
    error: err.message,
    code: err.statusCode || 500,
    timestamp: new Date().toISOString()
  })
}));
```

#### defaultErrorHandler

Default error handler middleware.

```typescript
const defaultErrorHandler: Middleware;
```

**Example:**
```typescript
app.use(defaultErrorHandler);
```

#### asyncHandler

Wraps an async handler to catch errors.

```typescript
const asyncHandler = (handler: Handler) => Handler;
```

**Example:**
```typescript
app.get("/users/:id", asyncHandler(async (req, params) => {
  const user = await findUser(params.id);
  if (!user) {
    throw createNotFoundError("User not found");
  }
  return json(user);
}));
```

#### createErrorBoundary

Creates an error boundary for isolating errors.

```typescript
const createErrorBoundary = () => ErrorBoundary;
```

**Example:**
```typescript
const errorBoundary = createErrorBoundary();

app.get("/risky", async (req) => {
  return errorBoundary.run(async () => {
    // Risky code that might throw
    const result = await riskyOperation();
    return json(result);
  }, (error) => {
    // Fallback response
    return json({ error: "Operation failed" }, 500);
  });
});
```

#### errorBoundaryMiddleware

Middleware that creates an error boundary for isolating errors.

```typescript
const errorBoundaryMiddleware = (options?: ErrorBoundaryOptions) => Middleware;
```

**Example:**
```typescript
app.use(errorBoundaryMiddleware({
  onError: (err, req) => {
    console.error(`Error in ${req.method} ${req.url}:`, err);
  }
}));
```

## Schema Validation

### validateSchema

Validates a value against a JSON schema.

```typescript
function validateSchema(
  value: any, 
  schema: JsonSchema, 
  fieldPath = ""
): ValidationError[];
```

**Parameters:**
- `value`: The value to validate
- `schema`: JSON schema to validate against
- `fieldPath`: Path to the field being validated

**Returns:** Array of validation errors

**Example:**
```typescript
const schema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2 },
    email: { type: "string", format: "email" },
    age: { type: "integer", minimum: 18 }
  },
  required: ["name", "email"]
};

const errors = validateSchema(userData, schema);
if (errors.length > 0) {
  throw new SchemaValidationError(errors);
}
```

### withSchema

Creates a schema-validated handler wrapper.

```typescript
function withSchema(schema: RouteSchema, handler: Handler): Handler;
```

**Parameters:**
- `schema`: Route schema configuration
- `handler`: Handler function

**Returns:** Wrapped handler with validation

**Example:**
```typescript
const userSchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 2 },
      email: { type: "string", format: "email" }
    },
    required: ["name", "email"]
  }
};

app.post("/users", withSchema(userSchema, async (req) => {
  const body = await parseBody(req);
  // Body is already validated
  return json({ id: 1, ...body }, 201);
}));
```

### schema

Convenience function to create a validated route handler.

```typescript
function schema(routeSchema: RouteSchema) => (handler: Handler) => Handler;
```

**Example:**
```typescript
const userSchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 2 },
      email: { type: "string", format: "email" }
    },
    required: ["name", "email"]
  }
};

app.post("/users", schema(userSchema)(async (req) => {
  const body = await parseBody(req);
  // Body is already validated
  return json({ id: 1, ...body }, 201);
}));
```

## Best Practices

### Security Headers

1. **Always Use Security Headers**: Apply security headers to all responses
2. **Content Security Policy**: Use a strict Content Security Policy
3. **HTTPS Only**: Use HTTPS in production and set Strict-Transport-Security
4. **Frame Protection**: Prevent clickjacking with X-Frame-Options
5. **XSS Protection**: Enable XSS protection headers

### CSRF Protection

1. **Protect State-Changing Operations**: Apply CSRF protection to POST, PUT, DELETE requests
2. **Use Both Cookie and Header**: Implement the double-submit cookie pattern
3. **Regenerate Tokens**: Generate new CSRF tokens for each session
4. **Validate Token Strength**: Use cryptographically strong tokens

### Input Sanitization

1. **Sanitize All Input**: Sanitize all user input before processing
2. **Validate Before Sanitizing**: Validate input structure before sanitizing
3. **Context-Aware Sanitization**: Use different sanitization for different contexts
4. **Defense in Depth**: Combine sanitization with other security measures

### Rate Limiting

1. **Tiered Rate Limiting**: Apply different limits to different endpoints
2. **Gradual Response**: Use increasing delays for repeated violations
3. **Clear Headers**: Include rate limit information in response headers
4. **Whitelist Trusted IPs**: Skip rate limiting for trusted sources
5. **Monitor and Adjust**: Regularly review and adjust rate limits

### Error Handling

1. **Hide Implementation Details**: Don't expose stack traces in production
2. **Consistent Error Format**: Use a consistent error response format
3. **Log All Errors**: Log errors for monitoring and debugging
4. **Graceful Degradation**: Provide fallback behavior when errors occur
5. **Validate Error Messages**: Ensure error messages don't leak sensitive information