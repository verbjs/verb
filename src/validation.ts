import type { Handler } from "./types.ts";

/**
 * JSON Schema types for validation
 */
export interface JsonSchema {
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  format?: "email" | "date" | "date-time" | "uri" | "uuid";
  enum?: any[];
  additionalProperties?: boolean | JsonSchema;
}

/**
 * Route schema configuration
 */
export interface RouteSchema {
  body?: JsonSchema;
  query?: JsonSchema;
  params?: JsonSchema;
  headers?: JsonSchema;
  response?: {
    [statusCode: number]: JsonSchema;
  };
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Schema validation error structure
 */
export interface SchemaValidationErrorData {
  readonly name: string;
  readonly message: string;
  readonly statusCode: number;
  readonly errors: ValidationError[];
}

/**
 * Creates a schema validation error
 */
export const createSchemaValidationError = (
  errors: ValidationError[],
): SchemaValidationErrorData => ({
  name: "SchemaValidationError",
  message: "Schema validation failed",
  statusCode: 400,
  errors,
});

/**
 * Check if an error is a schema validation error
 */
export const isSchemaValidationError = (error: any): error is SchemaValidationErrorData =>
  error && typeof error === "object" && error.name === "SchemaValidationError";

/**
 * Schema validation error class
 */
export class SchemaValidationError extends Error {
  public statusCode = 400;
  public errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super("Schema validation failed");
    this.errors = errors;
    this.name = "SchemaValidationError";
  }
}

/**
 * Validates a value against a JSON schema
 */
export function validateSchema(value: any, schema: JsonSchema, fieldPath = ""): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.type) {
    const actualType = getValueType(value);
    if (
      actualType !== schema.type &&
      !(schema.type === "integer" && actualType === "number" && Number.isInteger(value))
    ) {
      errors.push({
        field: fieldPath || "root",
        message: `Expected ${schema.type}, got ${actualType}`,
        value,
      });
      return errors; // Don't continue validation if type is wrong
    }
  }

  // String validations
  if (schema.type === "string" && typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        field: fieldPath,
        message: `String too short. Expected minimum ${schema.minLength}, got ${value.length}`,
        value,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field: fieldPath,
        message: `String too long. Expected maximum ${schema.maxLength}, got ${value.length}`,
        value,
      });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({
        field: fieldPath,
        message: `String does not match pattern: ${schema.pattern}`,
        value,
      });
    }
    if (schema.format) {
      const formatError = validateFormat(value, schema.format);
      if (formatError) {
        errors.push({
          field: fieldPath,
          message: formatError,
          value,
        });
      }
    }
  }

  // Number validations
  if ((schema.type === "number" || schema.type === "integer") && typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        field: fieldPath,
        message: `Number too small. Expected minimum ${schema.minimum}, got ${value}`,
        value,
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        field: fieldPath,
        message: `Number too large. Expected maximum ${schema.maximum}, got ${value}`,
        value,
      });
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({
      field: fieldPath,
      message: `Value not in allowed enum: ${schema.enum.join(", ")}`,
      value,
    });
  }

  // Object validations
  if (schema.type === "object" && typeof value === "object" && value !== null) {
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in value)) {
          errors.push({
            field: `${fieldPath}.${requiredField}`,
            message: "Required field missing",
            value: undefined,
          });
        }
      }
    }

    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in value) {
          const propPath = fieldPath ? `${fieldPath}.${prop}` : prop;
          errors.push(...validateSchema(value[prop], propSchema, propPath));
        }
      }
    }

    if (schema.additionalProperties === false) {
      const allowedProps = new Set(Object.keys(schema.properties || {}));
      for (const prop of Object.keys(value)) {
        if (!allowedProps.has(prop)) {
          errors.push({
            field: `${fieldPath}.${prop}`,
            message: "Additional property not allowed",
            value: value[prop],
          });
        }
      }
    }
  }

  // Array validations
  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        field: fieldPath,
        message: `Array too short. Expected minimum ${schema.minItems} items, got ${value.length}`,
        value,
      });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        field: fieldPath,
        message: `Array too long. Expected maximum ${schema.maxItems} items, got ${value.length}`,
        value,
      });
    }
    if (schema.items) {
      value.forEach((item, index) => {
        const itemPath = `${fieldPath}[${index}]`;
        errors.push(...validateSchema(item, schema.items, itemPath));
      });
    }
  }

  return errors;
}

/**
 * Gets the JSON schema type of a value
 */
function getValueType(value: any): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

/**
 * Validates string formats
 */
function validateFormat(value: string, format: string): string | null {
  switch (format) {
    case "email": {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) ? null : "Invalid email format";
    }

    case "date": {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      return dateRegex.test(value) && !Number.isNaN(Date.parse(value))
        ? null
        : "Invalid date format (YYYY-MM-DD)";
    }

    case "date-time":
      return !Number.isNaN(Date.parse(value)) ? null : "Invalid date-time format";

    case "uri":
      try {
        new URL(value);
        return null;
      } catch {
        return "Invalid URI format";
      }

    case "uuid": {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(value) ? null : "Invalid UUID format";
    }

    default:
      return null;
  }
}

/**
 * Serializes response data optimally based on schema
 */
export function serializeResponse(data: any, schema?: JsonSchema): string {
  if (!schema) {
    return JSON.stringify(data);
  }

  // For now, use standard JSON serialization
  // Future optimization: custom serializer based on schema
  return JSON.stringify(data);
}

/**
 * Creates a schema-validated handler wrapper
 */
export function withSchema(schema: RouteSchema, handler: Handler): Handler {
  return async (req: Request, params: Record<string, string>) => {
    const errors: ValidationError[] = [];

    // Validate body
    if (schema.body && req.method !== "GET" && req.method !== "HEAD") {
      try {
        const body = await req.json();
        errors.push(...validateSchema(body, schema.body, "body"));

        // Attach validated body to request for easier access
        (req as any).validatedBody = body;
      } catch {
        errors.push({
          field: "body",
          message: "Invalid JSON body",
          value: undefined,
        });
      }
    }

    // Validate query parameters
    if (schema.query) {
      const url = new URL(req.url);
      const query: Record<string, any> = {};

      for (const [key, value] of url.searchParams.entries()) {
        // Try to parse as number if it looks like one
        if (/^\d+(\.\d+)?$/.test(value)) {
          query[key] = Number.parseFloat(value);
        } else if (value === "true" || value === "false") {
          query[key] = value === "true";
        } else {
          query[key] = value;
        }
      }

      errors.push(...validateSchema(query, schema.query, "query"));
      (req as any).validatedQuery = query;
    }

    // Validate route parameters
    if (schema.params) {
      errors.push(...validateSchema(params, schema.params, "params"));
      (req as any).validatedParams = params;
    }

    // Validate headers
    if (schema.headers) {
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      errors.push(...validateSchema(headers, schema.headers, "headers"));
    }

    // Throw validation error if any issues found
    if (errors.length > 0) {
      throw new SchemaValidationError(errors);
    }

    // Execute handler
    const response = await handler(req, params);

    // Validate response if schema provided
    if (schema.response && response.status) {
      const responseSchema = schema.response[response.status];
      if (responseSchema) {
        try {
          const responseText = await response.text();
          const responseData = JSON.parse(responseText);
          const responseErrors = validateSchema(responseData, responseSchema, "response");

          if (responseErrors.length > 0) {
            console.warn("Response validation failed:", responseErrors);
          }

          // Return new response with potentially optimized serialization
          return new Response(serializeResponse(responseData, responseSchema), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch {
          // Response is not JSON, skip validation
        }
      }
    }

    return response;
  };
}

/**
 * Convenience function to create a validated route handler
 */
export function schema(routeSchema: RouteSchema) {
  return (handler: Handler) => withSchema(routeSchema, handler);
}
