// High-performance JSON middleware with schema validation and optimization
import type { Middleware } from "../types";
import { compileSchema, parseJSON, type JSONSchema } from "../validation";

export interface OptimizedJSONOptions {
  // Schema for request validation
  requestSchema?: JSONSchema;
  // Schema for response validation/optimization
  responseSchema?: JSONSchema;
  // Size limit for JSON bodies (in bytes)
  limit?: number;
  // Strict mode - reject additional properties
  strict?: boolean;
  // Enable response serialization optimization
  optimizeResponse?: boolean;
}

// High-performance JSON body parsing with validation
export const optimizedJSON = (options: OptimizedJSONOptions = {}): Middleware => {
  const {
    requestSchema,
    responseSchema,
    limit = 1024 * 1024, // 1MB default
    strict = false,
    optimizeResponse = true
  } = options;

  // Pre-compile schemas for maximum performance
  const requestValidator = requestSchema ? compileSchema(requestSchema) : null;
  const responseValidator = responseSchema ? compileSchema(responseSchema) : null;

  return async (req, res, next) => {
    // Only process JSON content types
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return next();
    }

    try {
      // Read body with size limit
      const body = await req.text();
      
      // Check size limit
      if (body.length > limit) {
        return res.status(413).json({
          error: "Request entity too large",
          limit: limit,
          size: body.length
        });
      }

      // Parse JSON
      let parsedBody: any;
      try {
        parsedBody = parseJSON(body);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid JSON",
          message: error instanceof Error ? error.message : "JSON parsing failed"
        });
      }

      // Validate request if schema provided
      if (requestValidator) {
        const result = requestValidator.validate(parsedBody);
        
        if (!result.valid) {
          return res.status(400).json({
            error: "Request validation failed",
            details: result.errors
          });
        }
        
        // Use validated/cleaned data
        parsedBody = result.data;
      }

      // Set parsed body
      (req as any).body = parsedBody;

      // Optimize response if schema provided
      if (responseValidator && optimizeResponse) {
        const originalJson = res.json;
        
        res.json = (data: any) => {
          const result = responseValidator.validate(data);
          
          if (!result.valid) {
            console.error('Response validation failed:', result.errors);
            // In production, return generic error
            return originalJson.call(res, { error: 'Internal server error' });
          }
          
          // Use optimized serialization
          const serialized = responseValidator.serialize(result.data);
          res.header('Content-Type', 'application/json');
          return res.send(serialized);
        };
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: "JSON processing error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };
};

// Schema-based route validation decorator
export const withSchema = (requestSchema?: JSONSchema, responseSchema?: JSONSchema) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async (req: any, res: any) => {
      // Validate request
      if (requestSchema) {
        const validator = compileSchema(requestSchema);
        const result = validator.validate(req.body);
        
        if (!result.valid) {
          return res.status(400).json({
            error: "Request validation failed",
            details: result.errors
          });
        }
        
        req.body = result.data;
      }
      
      // Set up response validation
      if (responseSchema) {
        const validator = compileSchema(responseSchema);
        const originalJson = res.json;
        
        res.json = (data: any) => {
          const result = validator.validate(data);
          
          if (!result.valid) {
            console.error('Response validation failed:', result.errors);
            return originalJson.call(res, { error: 'Internal server error' });
          }
          
          const serialized = validator.serialize(result.data);
          res.header('Content-Type', 'application/json');
          return res.send(serialized);
        };
      }
      
      return originalMethod.call(this, req, res);
    };
  };
};

// Route-level schema validation
export const validateSchema = (schema: JSONSchema) => {
  const validator = compileSchema(schema);
  
  return (req: any, res: any, next: any) => {
    const result = validator.validate(req.body);
    
    if (!result.valid) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.errors
      });
    }
    
    req.body = result.data;
    next();
  };
};

// Fast JSON response with schema optimization
export const jsonResponse = (data: any, schema?: JSONSchema): string => {
  if (schema) {
    const validator = compileSchema(schema);
    return validator.serialize(data);
  }
  return JSON.stringify(data);
};

// Batch validation for arrays
export const validateBatch = (items: any[], schema: JSONSchema): { valid: boolean; errors?: string[]; data?: any[] } => {
  const validator = compileSchema(schema);
  const results: any[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const result = validator.validate(items[i]);
    if (!result.valid) {
      errors.push(...(result.errors || []).map(err => `[${i}]: ${err}`));
    } else {
      results.push(result.data);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    data: results
  };
};

// Performance metrics for JSON operations
export interface JSONPerformanceMetrics {
  parseTime: number;
  validateTime: number;
  serializeTime: number;
  totalTime: number;
  bodySize: number;
  validationErrors: number;
}

export const withPerformanceMetrics = (options: OptimizedJSONOptions = {}) => {
  const baseMiddleware = optimizedJSON(options);
  
  return async (req: any, res: any, next: any) => {
    const startTime = performance.now();
    
    // Store original methods
    const originalJson = res.json;
    
    // Wrap response to measure serialization time
    res.json = (data: any) => {
      const serializeStart = performance.now();
      const result = originalJson.call(res, data);
      const serializeEnd = performance.now();
      
      // Store metrics on response
      (res as any).jsonMetrics = {
        ...(res as any).jsonMetrics,
        serializeTime: serializeEnd - serializeStart,
        totalTime: serializeEnd - startTime
      };
      
      return result;
    };
    
    // Run base middleware
    await baseMiddleware(req, res, next);
  };
};

// Common schema patterns for optimization
export const commonSchemas = {
  // User object
  user: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const },
      name: { type: 'string' as const, minLength: 1 },
      email: { type: 'string' as const, format: 'email' },
      age: { type: 'number' as const, minimum: 0 }
    },
    required: ['id', 'name', 'email'],
    additionalProperties: false
  },
  
  // API response
  apiResponse: {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const },
      data: { type: 'object' as const },
      message: { type: 'string' as const },
      timestamp: { type: 'string' as const }
    },
    required: ['success'],
    additionalProperties: false
  },
  
  // Error response
  errorResponse: {
    type: 'object' as const,
    properties: {
      error: { type: 'string' as const },
      message: { type: 'string' as const },
      code: { type: 'number' as const },
      details: { type: 'array' as const, items: { type: 'string' as const } }
    },
    required: ['error'],
    additionalProperties: false
  }
};