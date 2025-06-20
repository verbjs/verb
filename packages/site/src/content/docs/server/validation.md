---
title: Validation
description: Learn how to validate requests in Verb
---

# Request Validation in Verb

Validating incoming requests is crucial for building robust and secure web applications. Verb provides several approaches for validating requests. This guide covers request validation in detail.

## Basic Validation

The simplest way to validate requests is to check the request data directly in your route handlers:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

app.post("/api/users", async (req) => {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.name) {
      return new Response("Name is required", { status: 400 });
    }
    
    if (!body.email) {
      return new Response("Email is required", { status: 400 });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response("Invalid email format", { status: 400 });
    }
    
    // Process valid request
    return new Response("User created", { status: 201 });
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }
});
```

## Validation Middleware

You can create middleware functions for common validation tasks:

```typescript
import { createServer } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer();

// Middleware for validating JSON body
const validateJsonBody: Middleware = async (req, next) => {
  try {
    // Clone the request to avoid consuming the body
    const clonedReq = req.clone();
    
    // Try to parse the body as JSON
    await clonedReq.json();
    
    // If successful, continue to the next middleware or route handler
    return next();
  } catch (err) {
    // If parsing fails, return an error response
    return new Response("Invalid JSON body", { status: 400 });
  }
};

// Middleware for validating required fields
const validateRequiredFields = (fields: string[]): Middleware => {
  return async (req, next) => {
    try {
      // Clone the request to avoid consuming the body
      const clonedReq = req.clone();
      
      // Parse the body as JSON
      const body = await clonedReq.json();
      
      // Check for required fields
      for (const field of fields) {
        if (!body[field]) {
          return new Response(`${field} is required`, { status: 400 });
        }
      }
      
      // If all required fields are present, continue
      return next();
    } catch (err) {
      // If parsing fails, return an error response
      return new Response("Invalid JSON body", { status: 400 });
    }
  };
};

// Apply validation middleware to routes
app.post("/api/users", [
  validateJsonBody,
  validateRequiredFields(["name", "email"])
], async (req) => {
  const body = await req.json();
  
  // Process valid request
  return new Response("User created", { status: 201 });
});
```

## Schema Validation

For more complex validation, you can use a schema validation library like Zod, Joi, or Yup. Here's an example using Zod:

```typescript
import { createServer } from "@verb/server";
import { z } from "zod";

const app = createServer();

// Define a schema for user creation
const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  age: z.number().int().positive().optional(),
  role: z.enum(["user", "admin"]).default("user")
});

// Middleware for validating against a schema
const validateSchema = (schema) => {
  return async (req, next) => {
    try {
      // Clone the request to avoid consuming the body
      const clonedReq = req.clone();
      
      // Parse the body as JSON
      const body = await clonedReq.json();
      
      // Validate against the schema
      const result = schema.safeParse(body);
      
      if (!result.success) {
        // If validation fails, return an error response
        return new Response(JSON.stringify({
          error: "Validation failed",
          details: result.error.format()
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // If validation succeeds, add the validated data to the request
      (req as any).validatedBody = result.data;
      
      // Continue to the next middleware or route handler
      return next();
    } catch (err) {
      // If parsing fails, return an error response
      return new Response("Invalid JSON body", { status: 400 });
    }
  };
};

// Apply schema validation to routes
app.post("/api/users", validateSchema(createUserSchema), (req) => {
  // Access the validated body
  const body = (req as any).validatedBody;
  
  // Process valid request
  return new Response(JSON.stringify({
    message: "User created",
    user: body
  }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
});
```

## URL Parameter Validation

You can validate URL parameters using similar techniques:

```typescript
import { createServer } from "@verb/server";
import { z } from "zod";

const app = createServer();

// Define a schema for user ID
const userIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(val => parseInt(val))
});

// Middleware for validating URL parameters
const validateParams = (schema) => {
  return (req, params, next) => {
    try {
      // Validate against the schema
      const result = schema.safeParse(params);
      
      if (!result.success) {
        // If validation fails, return an error response
        return new Response(JSON.stringify({
          error: "Invalid parameters",
          details: result.error.format()
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // If validation succeeds, add the validated params to the request
      (req as any).validatedParams = result.data;
      
      // Continue to the next middleware or route handler
      return next();
    } catch (err) {
      // If validation fails, return an error response
      return new Response("Invalid parameters", { status: 400 });
    }
  };
};

// Apply parameter validation to routes
app.get("/api/users/:id", validateParams(userIdSchema), (req) => {
  // Access the validated parameters
  const params = (req as any).validatedParams;
  
  // Process valid request
  return new Response(JSON.stringify({
    message: `User ${params.id} details`,
    user: { id: params.id, name: `User ${params.id}` }
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Query Parameter Validation

You can validate query parameters in a similar way:

```typescript
import { createServer, getQuery } from "@verb/server";
import { z } from "zod";

const app = createServer();

// Define a schema for search query
const searchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(val => parseInt(val)).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(val => parseInt(val)).optional().default("10")
});

// Middleware for validating query parameters
const validateQuery = (schema) => {
  return (req, next) => {
    try {
      // Get query parameters
      const query = getQuery(req);
      
      // Validate against the schema
      const result = schema.safeParse(query);
      
      if (!result.success) {
        // If validation fails, return an error response
        return new Response(JSON.stringify({
          error: "Invalid query parameters",
          details: result.error.format()
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // If validation succeeds, add the validated query to the request
      (req as any).validatedQuery = result.data;
      
      // Continue to the next middleware or route handler
      return next();
    } catch (err) {
      // If validation fails, return an error response
      return new Response("Invalid query parameters", { status: 400 });
    }
  };
};

// Apply query validation to routes
app.get("/api/search", validateQuery(searchQuerySchema), (req) => {
  // Access the validated query
  const query = (req as any).validatedQuery;
  
  // Process valid request
  return new Response(JSON.stringify({
    message: "Search results",
    query: query.q || "",
    page: query.page,
    limit: query.limit,
    results: []
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## File Upload Validation

You can validate file uploads by checking file types, sizes, and other properties:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

// Middleware for validating file uploads
const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
}) => {
  return async (req, next) => {
    try {
      // Clone the request to avoid consuming the body
      const clonedReq = req.clone();
      
      // Parse the form data
      const formData = await clonedReq.formData();
      
      // Get the file
      const file = formData.get("file") as File;
      
      if (!file) {
        return new Response("No file uploaded", { status: 400 });
      }
      
      // Check file size
      if (options.maxSize && file.size > options.maxSize) {
        return new Response(`File too large. Maximum size is ${options.maxSize} bytes`, {
          status: 400
        });
      }
      
      // Check file type
      if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
        return new Response(`Invalid file type. Allowed types: ${options.allowedTypes.join(", ")}`, {
          status: 400
        });
      }
      
      // If validation succeeds, continue
      return next();
    } catch (err) {
      // If parsing fails, return an error response
      return new Response("Invalid form data", { status: 400 });
    }
  };
};

// Apply file upload validation to routes
app.post("/api/upload", validateFileUpload({
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ["image/jpeg", "image/png", "image/gif"]
}), async (req) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  
  // Process valid file upload
  return new Response(JSON.stringify({
    message: "File uploaded successfully",
    filename: file.name,
    size: file.size,
    type: file.type
  }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
});
```

## Validation Plugin

You can create a validation plugin to simplify validation across your application:

```typescript
import { createServer } from "@verb/server";
import { z } from "zod";

// Validation plugin
const validation = {
  body: (schema) => {
    return async (req, next) => {
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        
        const result = schema.safeParse(body);
        
        if (!result.success) {
          return new Response(JSON.stringify({
            error: "Validation failed",
            details: result.error.format()
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        (req as any).validatedBody = result.data;
        
        return next();
      } catch (err) {
        return new Response("Invalid JSON body", { status: 400 });
      }
    };
  },
  
  params: (schema) => {
    return (req, params, next) => {
      const result = schema.safeParse(params);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          error: "Invalid parameters",
          details: result.error.format()
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      (req as any).validatedParams = result.data;
      
      return next();
    };
  },
  
  query: (schema) => {
    return (req, next) => {
      const query = Object.fromEntries(new URL(req.url).searchParams);
      
      const result = schema.safeParse(query);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          error: "Invalid query parameters",
          details: result.error.format()
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      (req as any).validatedQuery = result.data;
      
      return next();
    };
  }
};

const app = createServer();

// Define schemas
const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format")
});

const userIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(val => parseInt(val))
});

const searchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(val => parseInt(val)).optional().default("1")
});

// Apply validation to routes
app.post("/api/users", validation.body(createUserSchema), (req) => {
  const body = (req as any).validatedBody;
  
  return new Response(JSON.stringify({
    message: "User created",
    user: body
  }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
});

app.get("/api/users/:id", validation.params(userIdSchema), (req) => {
  const params = (req as any).validatedParams;
  
  return new Response(JSON.stringify({
    message: `User ${params.id} details`,
    user: { id: params.id, name: `User ${params.id}` }
  }), {
    headers: { "Content-Type": "application/json" }
  });
});

app.get("/api/search", validation.query(searchQuerySchema), (req) => {
  const query = (req as any).validatedQuery;
  
  return new Response(JSON.stringify({
    message: "Search results",
    query: query.q || "",
    page: query.page,
    results: []
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Best Practices

- **Validate Early**: Validate input as early as possible in the request lifecycle
- **Be Specific**: Provide specific error messages that help identify the issue
- **Use Schemas**: Use schema validation for complex validation requirements
- **Sanitize Input**: Sanitize input to prevent security issues
- **Consistent Format**: Use a consistent format for validation errors
- **Performance**: Be mindful of performance implications, especially for large requests

## Next Steps

Now that you understand request validation in Verb, you can explore related topics:

- [Request Handling](/server/request-handling) - Learn more about handling different types of requests
- [Middleware](/server/middleware) - Learn how to use middleware for request processing
- [Error Handling](/server/error-handling) - Learn about error handling in Verb
- [Security](/server/security) - Learn about securing your application