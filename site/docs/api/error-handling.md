# Error Handling

Comprehensive error handling utilities and patterns for Verb applications with proper error responses and debugging.

## Error Classes

### VerbError

Base error class for all Verb-specific errors:

```typescript
import { VerbError } from "verb";

class VerbError extends Error {
  statusCode: number;
  code?: string;
  details?: any;
  
  constructor(
    message: string, 
    statusCode: number = 500, 
    code?: string, 
    details?: any
  ) {
    super(message);
    this.name = "VerbError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Usage
throw new VerbError("User not found", 404, "USER_NOT_FOUND");
```

### ValidationError

Input validation errors:

```typescript
import { ValidationError } from "verb";

class ValidationError extends VerbError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 400, "VALIDATION_ERROR", { field, value });
    this.name = "ValidationError";
  }
}

// Usage
throw new ValidationError("Email is required", "email");
```

### AuthenticationError

Authentication-related errors:

```typescript
import { AuthenticationError } from "verb";

class AuthenticationError extends VerbError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

// Usage
throw new AuthenticationError("Invalid token");
```

### AuthorizationError

Authorization/permission errors:

```typescript
import { AuthorizationError } from "verb";

class AuthorizationError extends VerbError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

// Usage
throw new AuthorizationError("Admin access required");
```

### NotFoundError

Resource not found errors:

```typescript
import { NotFoundError } from "verb";

class NotFoundError extends VerbError {
  constructor(resource?: string) {
    const message = resource ? `${resource} not found` : "Resource not found";
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

// Usage
throw new NotFoundError("User");
```

### ConflictError

Resource conflict errors:

```typescript
import { ConflictError } from "verb";

class ConflictError extends VerbError {
  constructor(message: string = "Resource conflict") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

// Usage
throw new ConflictError("Email already exists");
```

### RateLimitError

Rate limiting errors:

```typescript
import { RateLimitError } from "verb";

class RateLimitError extends VerbError {
  retryAfter?: number;
  
  constructor(message: string = "Rate limit exceeded", retryAfter?: number) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

// Usage
throw new RateLimitError("Too many requests", 60);
```

## Error Handler Middleware

### Global Error Handler

Catch and handle all application errors:

```typescript
import { ErrorHandler } from "verb";

const globalErrorHandler: ErrorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("user-agent")
  });

  // Handle different error types
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: "Validation Error",
      message: err.message,
      code: err.code,
      field: err.details?.field
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(401).json({
      error: "Authentication Error", 
      message: err.message,
      code: err.code
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(403).json({
      error: "Authorization Error",
      message: err.message,
      code: err.code
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      error: "Not Found",
      message: err.message,
      code: err.code
    });
  }

  if (err instanceof ConflictError) {
    return res.status(409).json({
      error: "Conflict",
      message: err.message,
      code: err.code
    });
  }

  if (err instanceof RateLimitError) {
    const response = {
      error: "Rate Limit Exceeded",
      message: err.message,
      code: err.code
    };
    
    if (err.retryAfter) {
      res.header("Retry-After", err.retryAfter.toString());
    }
    
    return res.status(429).json(response);
  }

  // Handle VerbError instances
  if (err instanceof VerbError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      code: err.code,
      details: err.details
    });
  }

  // Handle syntax errors (JSON parsing, etc.)
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid JSON in request body",
      code: "INVALID_JSON"
    });
  }

  // Handle multer errors (file upload)
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "Payload Too Large",
      message: "File size exceeds limit",
      code: "FILE_TOO_LARGE"
    });
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV === "development";
  
  res.status(500).json({
    error: "Internal Server Error",
    message: isDevelopment ? err.message : "Something went wrong",
    code: "INTERNAL_ERROR",
    ...(isDevelopment && { stack: err.stack })
  });
};

// Apply to app (must be last middleware)
app.use(globalErrorHandler);
```

### 404 Handler

Handle routes that don't exist:

```typescript
const notFoundHandler = (req: VerbRequest, res: VerbResponse) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    code: "ROUTE_NOT_FOUND"
  });
};

// Apply after all routes
app.use("*", notFoundHandler);
```

## Async Error Handling

### Async Route Wrapper

Automatically catch async errors in route handlers:

```typescript
const asyncHandler = (fn: RouteHandler): RouteHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    throw new NotFoundError("User");
  }
  
  res.json(user);
}));
```

### Try-Catch Alternative

Using the async handler eliminates repetitive try-catch blocks:

```typescript
// Without async handler (repetitive)
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    
    if (!user) {
      throw new NotFoundError("User");
    }
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// With async handler (clean)
app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    throw new NotFoundError("User");
  }
  
  res.json(user);
}));
```

## Validation Error Handling

### Field Validation

Handle multiple validation errors:

```typescript
interface ValidationIssue {
  field: string;
  message: string;
  value?: any;
}

class ValidationError extends VerbError {
  issues: ValidationIssue[];
  
  constructor(issues: ValidationIssue[]) {
    const message = `Validation failed: ${issues.map(i => i.field).join(", ")}`;
    super(message, 400, "VALIDATION_ERROR", { issues });
    this.name = "ValidationError";
    this.issues = issues;
  }
}

// Usage
const validateUser = (data: any) => {
  const issues: ValidationIssue[] = [];
  
  if (!data.email) {
    issues.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(data.email)) {
    issues.push({ 
      field: "email", 
      message: "Invalid email format",
      value: data.email
    });
  }
  
  if (!data.password) {
    issues.push({ field: "password", message: "Password is required" });
  } else if (data.password.length < 8) {
    issues.push({ 
      field: "password", 
      message: "Password must be at least 8 characters"
    });
  }
  
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
};

app.post("/users", asyncHandler(async (req, res) => {
  validateUser(req.body);
  
  const user = await createUser(req.body);
  res.status(201).json(user);
}));
```

## Database Error Handling

### Common Database Errors

Handle database-specific errors:

```typescript
const handleDatabaseError = (error: any) => {
  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    throw new ConflictError(`${field} already exists`);
  }
  
  // PostgreSQL unique violation
  if (error.code === "23505") {
    throw new ConflictError("Resource already exists");
  }
  
  // PostgreSQL foreign key violation
  if (error.code === "23503") {
    throw new ValidationError("Referenced resource does not exist");
  }
  
  // Connection errors
  if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
    throw new VerbError("Database connection failed", 503, "DATABASE_UNAVAILABLE");
  }
  
  // Default database error
  throw new VerbError("Database operation failed", 500, "DATABASE_ERROR");
};

// Usage in route
app.post("/users", asyncHandler(async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    handleDatabaseError(error);
  }
}));
```

## API Error Responses

### Standardized Error Format

Consistent error response structure:

```typescript
interface ErrorResponse {
  error: string;           // Error type
  message: string;         // Human-readable message
  code?: string;          // Machine-readable code
  details?: any;          // Additional error details
  timestamp: string;      // ISO timestamp
  path: string;          // Request path
  method: string;        // HTTP method
  requestId?: string;    // Request tracking ID
}

const formatErrorResponse = (
  err: Error, 
  req: VerbRequest
): ErrorResponse => {
  return {
    error: err.name || "Error",
    message: err.message,
    code: err instanceof VerbError ? err.code : undefined,
    details: err instanceof VerbError ? err.details : undefined,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    requestId: req.id
  };
};

// Usage in error handler
const globalErrorHandler: ErrorHandler = (err, req, res, next) => {
  const errorResponse = formatErrorResponse(err, req);
  const statusCode = err instanceof VerbError ? err.statusCode : 500;
  
  res.status(statusCode).json(errorResponse);
};
```

## Logging & Monitoring

### Error Logging

Log errors for monitoring and debugging:

```typescript
import { logger } from "./logger";

const logError = (error: Error, req: VerbRequest) => {
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error instanceof VerbError ? error.code : undefined
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      body: req.body
    },
    timestamp: new Date().toISOString()
  };
  
  if (error instanceof VerbError && error.statusCode < 500) {
    logger.warn("Client error", logData);
  } else {
    logger.error("Server error", logData);
  }
};

// Usage in error handler
const globalErrorHandler: ErrorHandler = (err, req, res, next) => {
  logError(err, req);
  
  // ... handle error response
};
```

### Error Metrics

Track error metrics for monitoring:

```typescript
const errorMetrics = {
  total: 0,
  byType: new Map<string, number>(),
  byStatusCode: new Map<number, number>(),
  byRoute: new Map<string, number>()
};

const trackError = (error: Error, req: VerbRequest) => {
  errorMetrics.total++;
  
  // Track by error type
  const type = error.name;
  errorMetrics.byType.set(type, (errorMetrics.byType.get(type) || 0) + 1);
  
  // Track by status code
  const statusCode = error instanceof VerbError ? error.statusCode : 500;
  errorMetrics.byStatusCode.set(statusCode, (errorMetrics.byStatusCode.get(statusCode) || 0) + 1);
  
  // Track by route
  const route = `${req.method} ${req.path}`;
  errorMetrics.byRoute.set(route, (errorMetrics.byRoute.get(route) || 0) + 1);
};

// Expose metrics endpoint
app.get("/metrics/errors", (req, res) => {
  res.json({
    total: errorMetrics.total,
    byType: Object.fromEntries(errorMetrics.byType),
    byStatusCode: Object.fromEntries(errorMetrics.byStatusCode),
    byRoute: Object.fromEntries(errorMetrics.byRoute)
  });
});
```

## Circuit Breaker Pattern

Prevent cascading failures:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  
  constructor(
    private threshold = 5,
    private timeout = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new VerbError("Circuit breaker is OPEN", 503, "SERVICE_UNAVAILABLE");
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }
}

// Usage
const dbCircuitBreaker = new CircuitBreaker(5, 30000);

app.get("/users", asyncHandler(async (req, res) => {
  const users = await dbCircuitBreaker.execute(() => getUsersFromDB());
  res.json(users);
}));
```

## Testing Error Handling

### Error Handler Tests

```typescript
import { test, expect } from "bun:test";
import request from "supertest";

test("handles validation errors", async () => {
  const response = await request(app)
    .post("/users")
    .send({}) // Empty body
    .expect(400);
    
  expect(response.body.error).toBe("Validation Error");
  expect(response.body.code).toBe("VALIDATION_ERROR");
});

test("handles not found errors", async () => {
  const response = await request(app)
    .get("/users/nonexistent")
    .expect(404);
    
  expect(response.body.error).toBe("Not Found");
  expect(response.body.message).toContain("User not found");
});

test("handles authentication errors", async () => {
  const response = await request(app)
    .get("/protected")
    .expect(401);
    
  expect(response.body.error).toBe("Authentication Error");
});
```

## Best Practices

1. **Use Specific Error Types**: Create custom error classes for different scenarios
2. **Consistent Error Format**: Use standardized error response structure
3. **Proper Status Codes**: Use appropriate HTTP status codes
4. **Log Errors**: Log errors for debugging and monitoring
5. **Don't Expose Sensitive Data**: Never expose internal details in production
6. **Handle Async Errors**: Use async wrappers to catch Promise rejections
7. **Graceful Degradation**: Implement fallback mechanisms for critical services

## See Also

- [Middleware API](/api/middleware) - Creating error handling middleware
- [Validation](/api/validation) - Input validation utilities
- [Security](/guide/security) - Security best practices
- [Testing](/guide/testing) - Testing error scenarios