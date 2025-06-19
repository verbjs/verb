/**
 * Advanced Error Handling System
 * Provides error classification, custom error handlers, and error serialization
 * Refactored to use functional programming patterns
 */

/**
 * Error types and status codes
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Verb error structure
 */
export interface VerbErrorData {
  readonly name: string;
  readonly message: string;
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
  readonly stack?: string;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error, req: Request) => Response | Promise<Response>;

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  includeStack?: boolean;
  logErrors?: boolean;
  suppressTestLogs?: boolean; // Explicitly suppress logs during tests
  customHandlers?: Map<string, ErrorHandler>;
  fallbackHandler?: ErrorHandler;
}

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  readonly handlers: Map<string, ErrorHandler>;
  readonly fallbackHandler: ErrorHandler;
}

/**
 * Create a VerbError
 */
export const createVerbError = (
  message: string,
  statusCode = 500,
  code: ErrorCode = "INTERNAL_ERROR",
  details?: Record<string, unknown>,
): VerbErrorData => ({
  name: "VerbError",
  message,
  statusCode,
  code,
  details,
  timestamp: new Date(),
  stack: new Error().stack,
});

/**
 * HTTP error creators
 */
export const createBadRequestError = (
  message = "Bad Request",
  details?: Record<string, unknown>,
): VerbErrorData => createVerbError(message, 400, "BAD_REQUEST", details);

export const createUnauthorizedError = (
  message = "Unauthorized",
  details?: Record<string, unknown>,
): VerbErrorData => createVerbError(message, 401, "UNAUTHORIZED", details);

export const createForbiddenError = (
  message = "Forbidden",
  details?: Record<string, unknown>,
): VerbErrorData => createVerbError(message, 403, "FORBIDDEN", details);

export const createNotFoundError = (
  message = "Not Found",
  details?: Record<string, unknown>,
): VerbErrorData => createVerbError(message, 404, "NOT_FOUND", details);

export const createConflictError = (
  message = "Conflict",
  details?: Record<string, unknown>,
): VerbErrorData => createVerbError(message, 409, "CONFLICT", details);

export const createValidationError = (
  message = "Validation Failed",
  details?: any,
): VerbErrorData => createVerbError(message, 422, "VALIDATION_ERROR", details);

export const createRateLimitError = (
  message = "Rate Limit Exceeded",
  details?: any,
): VerbErrorData => createVerbError(message, 429, "RATE_LIMIT_EXCEEDED", details);

export const createInternalServerError = (
  message = "Internal Server Error",
  details?: any,
): VerbErrorData => createVerbError(message, 500, "INTERNAL_ERROR", details);

/**
 * Check if an error is a VerbError
 */
export const isVerbError = (error: unknown): error is VerbErrorData =>
  error && typeof error === "object" && error.name === "VerbError";

/**
 * Convert Error to VerbError
 */
export const toVerbError = (error: Error): VerbErrorData => {
  if (isVerbError(error)) {
    return error;
  }

  return createVerbError(error.message, 500, "INTERNAL_ERROR");
};

/**
 * Serialize error to JSON
 */
export const serializeError = (error: Error, includeStack = false): any => {
  if (error instanceof VerbError) {
    const serialized = {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        timestamp: error.timestamp.toISOString(),
        ...(includeStack && { stack: error.stack }),
      },
    };
    return serialized;
  }

  return {
    error: {
      name: error.name,
      message: error.message,
      code: "UNKNOWN_ERROR" as ErrorCode,
      statusCode: 500,
      timestamp: new Date().toISOString(),
      ...(includeStack && { stack: error.stack }),
    },
  };
};

/**
 * Default error handler
 */
export const defaultErrorHandler = (error: Error, _req: Request): Response => {
  const includeStack = process.env.NODE_ENV === "development";
  const serialized = serializeError(error, includeStack);

  const statusCode = error instanceof VerbError ? error.statusCode : 500;

  return new Response(JSON.stringify(serialized), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

/**
 * Create error boundary state
 */
export const createErrorBoundary = (
  handlers: Map<string, ErrorHandler> = new Map(),
  fallbackHandler: ErrorHandler = defaultErrorHandler,
): ErrorBoundaryState => ({
  handlers,
  fallbackHandler,
});

/**
 * Register error handler with boundary
 */
export const registerErrorHandler = (
  boundary: ErrorBoundaryState,
  errorType: string,
  handler: ErrorHandler,
): ErrorBoundaryState => ({
  ...boundary,
  handlers: new Map(boundary.handlers).set(errorType, handler),
});

/**
 * Set fallback error handler
 */
export const setFallbackHandler = (
  boundary: ErrorBoundaryState,
  handler: ErrorHandler,
): ErrorBoundaryState => ({
  ...boundary,
  fallbackHandler: handler,
});

/**
 * Handle error using boundary
 */
export const handleError = async (
  boundary: ErrorBoundaryState,
  error: Error,
  req: Request,
): Promise<Response> => {
  const handler = boundary.handlers.get(error.constructor.name) || boundary.fallbackHandler;
  return await handler(error, req);
};

/**
 * Create error handler middleware
 */
export const errorHandler = (options: ErrorHandlerOptions = {}) => {
  const {
    logErrors = true,
    suppressTestLogs = true, // Default to suppressing logs in tests
    customHandlers = new Map(),
    fallbackHandler = defaultErrorHandler,
  } = options;

  const boundary = createErrorBoundary(customHandlers, fallbackHandler);

  // Check if we're in a test environment
  const isTestEnvironment =
    typeof globalThis !== "undefined" &&
    (process?.env?.NODE_ENV === "test" ||
      process?.env?.BUN_ENV === "test" ||
      // Detect Bun test runner specifically
      (typeof Bun !== "undefined" &&
        (typeof expect !== "undefined" ||
          typeof describe !== "undefined" ||
          process.argv.some((arg) => arg.includes("bun:test") || arg.includes("test")))));

  // Determine if we should suppress logs
  const shouldSuppressLogs = suppressTestLogs && isTestEnvironment;

  return async (req: Request, next: () => Response | Promise<Response>): Promise<Response> => {
    try {
      return await next();
    } catch (error) {
      // Only log errors if logging is enabled and not suppressed
      if (logErrors && !shouldSuppressLogs) {
        console.error("Error in request:", {
          url: req.url,
          method: req.method,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }

      const err = error instanceof Error ? error : new Error(String(error));
      return await handleError(boundary, err, req);
    }
  };
};

/**
 * Async error wrapper for handlers
 */
export const asyncHandler = (
  handler: (req: Request, params: Record<string, string>) => Promise<Response>,
) => {
  return (req: Request, params: Record<string, string>): Promise<Response> => {
    return Promise.resolve(handler(req, params)).catch((error) => {
      if (error instanceof VerbError) {
        throw error;
      }
      throw new InternalServerError(error.message);
    });
  };
};

/**
 * Create middleware from error boundary
 */
export const errorBoundaryMiddleware = (boundary: ErrorBoundaryState) => {
  return errorHandler({
    customHandlers: boundary.handlers,
    fallbackHandler: boundary.fallbackHandler,
  });
};

/**
 * Helper function to throw errors with proper typing
 */
export const throwError = (
  message: string,
  statusCode = 500,
  code?: ErrorCode,
  details?: any,
): never => {
  throw new VerbError(message, statusCode, code, details);
};

/**
 * Helper functions for common HTTP errors
 */
export const errors = {
  badRequest: (message?: string, details?: any) => new BadRequestError(message, details),
  unauthorized: (message?: string, details?: any) => new UnauthorizedError(message, details),
  forbidden: (message?: string, details?: any) => new ForbiddenError(message, details),
  notFound: (message?: string, details?: any) => new NotFoundError(message, details),
  conflict: (message?: string, details?: any) => new ConflictError(message, details),
  validation: (message?: string, details?: any) => new ValidationError(message, details),
  rateLimit: (message?: string, details?: any) => new RateLimitError(message, details),
  internal: (message?: string, details?: any) => new InternalServerError(message, details),
} as const;

// Legacy class-based exports for backward compatibility
export class VerbError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public details?: any;
  public timestamp: Date;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = "INTERNAL_ERROR",
    details?: any,
  ) {
    super(message);
    this.name = "VerbError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }

  toJSON() {
    return serializeError(this, false);
  }
}

export class BadRequestError extends VerbError {
  constructor(message = "Bad Request", details?: any) {
    super(message, 400, "BAD_REQUEST", details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends VerbError {
  constructor(message = "Unauthorized", details?: any) {
    super(message, 401, "UNAUTHORIZED", details);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends VerbError {
  constructor(message = "Forbidden", details?: any) {
    super(message, 403, "FORBIDDEN", details);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends VerbError {
  constructor(message = "Not Found", details?: any) {
    super(message, 404, "NOT_FOUND", details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends VerbError {
  constructor(message = "Conflict", details?: any) {
    super(message, 409, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

export class ValidationError extends VerbError {
  constructor(message = "Validation Failed", details?: any) {
    super(message, 422, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends VerbError {
  constructor(message = "Rate Limit Exceeded", details?: any) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", details);
    this.name = "RateLimitError";
  }
}

export class InternalServerError extends VerbError {
  constructor(message = "Internal Server Error", details?: any) {
    super(message, 500, "INTERNAL_ERROR", details);
    this.name = "InternalServerError";
  }
}

export class ErrorBoundary {
  private state: ErrorBoundaryState;

  constructor() {
    this.state = createErrorBoundary();
  }

  register(errorType: string, handler: ErrorHandler): this {
    this.state = registerErrorHandler(this.state, errorType, handler);
    return this;
  }

  setFallback(handler: ErrorHandler): this {
    this.state = setFallbackHandler(this.state, handler);
    return this;
  }

  async handle(error: Error, req: Request): Promise<Response> {
    return handleError(this.state, error, req);
  }

  middleware() {
    return errorBoundaryMiddleware(this.state);
  }
}
