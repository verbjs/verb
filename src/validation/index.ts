// JSON Schema validation and optimization for Verb
// Built for maximum performance with Bun

export interface JSONSchema {
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  properties?: { [key: string]: JSONSchema };
  items?: JSONSchema;
  required?: string[];
  additionalProperties?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  enum?: any[];
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  data?: any;
}

export interface CompiledValidator {
  validate: (data: any) => ValidationResult;
  serialize: (data: any) => string;
}

// Fast property checking without regex when possible
const isValidString = (value: any, schema: JSONSchema): boolean => {
  if (typeof value !== "string") {
    return false;
  }
  if (schema.minLength && value.length < schema.minLength) {
    return false;
  }
  if (schema.maxLength && value.length > schema.maxLength) {
    return false;
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    return false;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return false;
  }
  return true;
};

const isValidNumber = (value: any, schema: JSONSchema): boolean => {
  if (typeof value !== "number") {
    return false;
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    return false;
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    return false;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return false;
  }
  return true;
};

const isValidObject = (value: any, schema: JSONSchema): ValidationResult => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { valid: false, errors: ["Expected object"] };
  }

  const errors: string[] = [];
  const result: any = {};

  // Check required properties
  if (schema.required) {
    for (const prop of schema.required) {
      if (!(prop in value)) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
  }

  // Validate properties
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        const propResult = validateValue(value[key], propSchema);
        if (!propResult.valid) {
          errors.push(...(propResult.errors || []).map((err) => `${key}: ${err}`));
        } else {
          result[key] = propResult.data;
        }
      }
    }
  }

  // Handle additional properties
  if (schema.additionalProperties === false) {
    const allowedKeys = new Set(Object.keys(schema.properties || {}));
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) {
        errors.push(`Additional property not allowed: ${key}`);
      }
    }
  } else if (schema.additionalProperties !== false) {
    // Copy additional properties
    const allowedKeys = new Set(Object.keys(schema.properties || {}));
    for (const [key, val] of Object.entries(value)) {
      if (!allowedKeys.has(key)) {
        result[key] = val;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    data: result,
  };
};

const validateValue = (value: any, schema: JSONSchema): ValidationResult => {
  switch (schema.type) {
    case "string":
      return {
        valid: isValidString(value, schema),
        errors: !isValidString(value, schema) ? ["Invalid string"] : undefined,
        data: value,
      };

    case "number":
      return {
        valid: isValidNumber(value, schema),
        errors: !isValidNumber(value, schema) ? ["Invalid number"] : undefined,
        data: value,
      };

    case "boolean":
      return {
        valid: typeof value === "boolean",
        errors: typeof value !== "boolean" ? ["Expected boolean"] : undefined,
        data: value,
      };

    case "null":
      return {
        valid: value === null,
        errors: value !== null ? ["Expected null"] : undefined,
        data: value,
      };

    case "array": {
      if (!Array.isArray(value)) {
        return { valid: false, errors: ["Expected array"] };
      }

      const arrayResult: any[] = [];
      const arrayErrors: string[] = [];

      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const itemResult = validateValue(value[i], schema.items);
          if (!itemResult.valid) {
            arrayErrors.push(...(itemResult.errors || []).map((err) => `[${i}]: ${err}`));
          } else {
            arrayResult.push(itemResult.data);
          }
        }
      } else {
        arrayResult.push(...value);
      }

      return {
        valid: arrayErrors.length === 0,
        errors: arrayErrors.length > 0 ? arrayErrors : undefined,
        data: arrayResult,
      };
    }

    case "object":
      return isValidObject(value, schema);

    default:
      return { valid: false, errors: ["Unknown type"] };
  }
};

// Optimized serialization based on schema
const createSerializer = (schema: JSONSchema): ((data: any) => string) => {
  // For simple objects, we can create optimized serializers
  if (schema.type === "object" && schema.properties) {
    const keys = Object.keys(schema.properties);
    const requiredKeys = new Set(schema.required || []);

    return (data: any): string => {
      let result = "{";
      let first = true;

      for (const key of keys) {
        const value = data[key];
        if (value !== undefined || requiredKeys.has(key)) {
          if (!first) {
            result += ",";
          }
          result += `"${key}":${JSON.stringify(value)}`;
          first = false;
        }
      }

      // Handle additional properties if allowed
      if (schema.additionalProperties !== false) {
        const knownKeys = new Set(keys);
        for (const [key, value] of Object.entries(data)) {
          if (!knownKeys.has(key) && value !== undefined) {
            if (!first) {
              result += ",";
            }
            result += `"${key}":${JSON.stringify(value)}`;
            first = false;
          }
        }
      }

      result += "}";
      return result;
    };
  }

  // Fallback to standard JSON.stringify for complex schemas
  return (data: any): string => JSON.stringify(data);
};

// Compile schema for maximum performance
// Schema cache for compiled validators
const schemaCache = new Map<string, CompiledValidator>();
let cacheHits = 0;
let cacheMisses = 0;

// Create a cache key from schema
const createCacheKey = (schema: JSONSchema): string => {
  return JSON.stringify(schema);
};

export const compileSchema = (schema: JSONSchema): CompiledValidator => {
  const cacheKey = createCacheKey(schema);

  // Check cache first
  const cached = schemaCache.get(cacheKey);
  if (cached) {
    cacheHits++;
    return cached;
  }

  cacheMisses++;

  // Compile schema
  const serializer = createSerializer(schema);

  const validator: CompiledValidator = {
    validate: (data: any): ValidationResult => {
      return validateValue(data, schema);
    },
    serialize: serializer,
  };

  // Cache the compiled validator
  schemaCache.set(cacheKey, validator);

  return validator;
};

// Route-level validation middleware
export const validateRequest = (schema: JSONSchema) => {
  const validator = compileSchema(schema);

  return async (req: any, res: any, next: any) => {
    try {
      const result = validator.validate(req.body);

      if (!result.valid) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.errors,
        });
      }

      // Replace req.body with validated/cleaned data
      req.body = result.data;
      next();
    } catch (error) {
      return res.status(500).json({
        error: "Validation error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
};

// Response validation and serialization
export const validateResponse = (schema: JSONSchema) => {
  const validator = compileSchema(schema);

  return (_req: any, res: any, next: any) => {
    const originalJson = res.json;

    res.json = (data: any) => {
      const result = validator.validate(data);

      if (!result.valid) {
        console.error("Response validation failed:", result.errors);
        // In production, you might want to return a generic error
        return originalJson.call(res, { error: "Internal server error" });
      }

      // Use optimized serialization
      const serialized = validator.serialize(result.data);
      res.setHeader("Content-Type", "application/json");
      return res.send(serialized);
    };

    next();
  };
};

// Utility functions for common schemas
export const schemas = {
  string: (
    options: { minLength?: number; maxLength?: number; pattern?: string } = {},
  ): JSONSchema => ({
    type: "string",
    ...options,
  }),

  number: (options: { minimum?: number; maximum?: number } = {}): JSONSchema => ({
    type: "number",
    ...options,
  }),

  boolean: (): JSONSchema => ({
    type: "boolean",
  }),

  array: (items: JSONSchema): JSONSchema => ({
    type: "array",
    items,
  }),

  object: (properties: { [key: string]: JSONSchema }, required?: string[]): JSONSchema => ({
    type: "object",
    properties,
    required,
    additionalProperties: false,
  }),
};

// Performance-optimized JSON parsing
export const parseJSON = (text: string): any => {
  try {
    // Bun's JSON parsing is already optimized, but we can add additional checks
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("Invalid JSON");
  }
};

// Fast JSON stringification with schema optimization
export const stringifyJSON = (data: any, schema?: JSONSchema): string => {
  if (schema) {
    const validator = compileSchema(schema);
    return validator.serialize(data);
  }
  return JSON.stringify(data);
};

// Schema cache management
export const clearSchemaCache = (): void => {
  schemaCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
};

export const getSchemaCacheStats = (): {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
} => {
  const total = cacheHits + cacheMisses;
  return {
    size: schemaCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? (cacheHits / total) * 100 : 0,
  };
};

// Pre-compile common schemas for maximum performance
export const precompileCommonSchemas = (): void => {
  // Pre-compile common schema patterns
  const commonSchemas = [
    schemas.string(),
    schemas.number(),
    schemas.boolean(),
    schemas.object({ id: schemas.string() }),
    schemas.array(schemas.string()),
    schemas.object(
      {
        name: schemas.string(),
        email: schemas.string(),
        age: schemas.number(),
      },
      ["name", "email"],
    ),
  ];

  commonSchemas.forEach((schema) => {
    compileSchema(schema);
  });
};
