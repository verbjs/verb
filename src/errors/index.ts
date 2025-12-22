import type { ErrorHandler, VerbRequest, VerbResponse } from "../types";

// Custom error classes
export class HttpError extends Error {
  public statusCode: number;
  public expose: boolean;
  public headers?: Record<string, string>;

  constructor(statusCode: number, message: string, expose: boolean = true) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.expose = expose;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string = "Bad Request") {
    super(400, message);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Not Found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message: string = "Method Not Allowed") {
    super(405, message);
    this.name = "MethodNotAllowedError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string = "Conflict") {
    super(409, message);
    this.name = "ConflictError";
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string = "Unprocessable Entity") {
    super(422, message);
    this.name = "UnprocessableEntityError";
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message: string = "Too Many Requests") {
    super(429, message);
    this.name = "TooManyRequestsError";
  }
}

export class InternalServerError extends HttpError {
  constructor(message: string = "Internal Server Error") {
    super(500, message, false); // Don't expose internal errors
    this.name = "InternalServerError";
  }
}

export class NotImplementedError extends HttpError {
  constructor(message: string = "Not Implemented") {
    super(501, message);
    this.name = "NotImplementedError";
  }
}

export class BadGatewayError extends HttpError {
  constructor(message: string = "Bad Gateway") {
    super(502, message);
    this.name = "BadGatewayError";
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message: string = "Service Unavailable") {
    super(503, message);
    this.name = "ServiceUnavailableError";
  }
}

// Error handling utilities
export const createError = (statusCode: number, message?: string): HttpError => {
  const errorMessage = message || getStatusText(statusCode);
  const expose = statusCode < 500;
  return new HttpError(statusCode, errorMessage, expose);
};

export const getStatusText = (statusCode: number): string => {
  const statusTexts: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return statusTexts[statusCode] || "Unknown Error";
};

export const isHttpError = (error: any): error is HttpError => {
  return error instanceof HttpError || (error && typeof error.statusCode === "number");
};

// Default error handler
export const defaultErrorHandler: ErrorHandler = (
  err: Error,
  _req: VerbRequest,
  res: VerbResponse,
  next: () => void,
) => {
  // If headers are already sent, delegate to default Express error handler
  if ((res as any).headersSent) {
    return next();
  }

  let statusCode = 500;
  let message = "Internal Server Error";
  let expose = false;

  if (isHttpError(err)) {
    statusCode = err.statusCode;
    message = err.message;
    expose = err.expose;
  } else {
    // Log unexpected errors
    console.error("Unexpected error:", err);
  }

  // In development, expose all errors
  if (process.env.NODE_ENV === "development") {
    expose = true;
    message = err.message;
  }

  const errorResponse: any = {
    error: {
      status: statusCode,
      message: expose ? message : getStatusText(statusCode),
    },
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === "development" && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler
export const notFoundHandler = (req: VerbRequest, res: VerbResponse) => {
  const error = new NotFoundError(`Cannot ${req.method} ${req.path || req.url}`);

  // Try to determine if this is an API request
  const isApiRequest =
    req.path?.startsWith("/api") ||
    req.headers.get("accept")?.includes("application/json") ||
    req.headers.get("content-type")?.includes("application/json");

  if (isApiRequest) {
    res.status(404).json({
      error: {
        status: 404,
        message: error.message,
      },
    });
  } else {
    // For non-API requests, return HTML 404 page
    const html404 = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>404 - Not Found</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          .error-code { font-size: 72px; font-weight: bold; color: #e74c3c; text-align: center; margin-bottom: 20px; }
          .back-link { display: inline-block; margin-top: 20px; color: #3498db; text-decoration: none; }
          .back-link:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-code">404</div>
          <h1>Page Not Found</h1>
          <p>The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
          <p><strong>Requested URL:</strong> ${req.path || req.url}</p>
          <a href="/" class="back-link">← Back to Home</a>
        </div>
      </body>
    </html>
    `;
    res.status(404).html(html404);
  }
};

// 500 handler
export const serverErrorHandler = (err: Error, req: VerbRequest, res: VerbResponse) => {
  console.error("Server error:", err);

  const isApiRequest =
    req.path?.startsWith("/api") ||
    req.headers.get("accept")?.includes("application/json") ||
    req.headers.get("content-type")?.includes("application/json");

  if (isApiRequest) {
    res.status(500).json({
      error: {
        status: 500,
        message: process.env.NODE_ENV === "development" ? err.message : "Internal Server Error",
      },
    });
  } else {
    // For non-API requests, return HTML 500 page
    const html500 = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>500 - Internal Server Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          .error-code { font-size: 72px; font-weight: bold; color: #e74c3c; text-align: center; margin-bottom: 20px; }
          .back-link { display: inline-block; margin-top: 20px; color: #3498db; text-decoration: none; }
          .back-link:hover { text-decoration: underline; }
          .error-details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px; font-family: monospace; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-code">500</div>
          <h1>Internal Server Error</h1>
          <p>Something went wrong on our end. We're working to fix this issue.</p>
          ${process.env.NODE_ENV === "development" ? `<div class="error-details">${err.message}\n\n${err.stack}</div>` : ""}
          <a href="/" class="back-link">← Back to Home</a>
        </div>
      </body>
    </html>
    `;
    res.status(500).html(html500);
  }
};

// Express-style error handling wrapper
export const asyncHandler = (
  fn: (req: VerbRequest, res: VerbResponse, next?: () => void) => Promise<any>,
) => {
  return async (req: VerbRequest, res: VerbResponse, _next: () => void) => {
    await fn(req, res);
  };
};

// Error boundary for React-like error handling
export const errorBoundary = (fn: (req: VerbRequest, res: VerbResponse) => any) => {
  return async (req: VerbRequest, res: VerbResponse) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error("Error in handler:", error);

      if (error instanceof HttpError) {
        return res.status(error.statusCode).json({
          error: {
            status: error.statusCode,
            message: error.expose ? error.message : getStatusText(error.statusCode),
          },
        });
      }

      return res.status(500).json({
        error: {
          status: 500,
          message:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : "Internal Server Error",
        },
      });
    }
  };
};

// Validation helper
export const validateRequest = (req: VerbRequest, schema: any) => {
  // Basic validation helper - can be extended with libraries like Joi, Yup, etc.
  const errors: string[] = [];

  if (schema.body && !req.body) {
    errors.push("Request body is required");
  }

  if (schema.requiredFields) {
    for (const field of schema.requiredFields) {
      if (!req.body || !req.body[field]) {
        errors.push(`Field '${field}' is required`);
      }
    }
  }

  if (errors.length > 0) {
    throw new BadRequestError(`Validation failed: ${errors.join(", ")}`);
  }
};

// Rate limiting error helper
export const rateLimitError = (message?: string) => {
  return new TooManyRequestsError(message || "Too many requests");
};

// Authentication error helpers
export const authenticationError = (message?: string) => {
  return new UnauthorizedError(message || "Authentication required");
};

export const authorizationError = (message?: string) => {
  return new ForbiddenError(message || "Insufficient permissions");
};

// Request timeout helper
export const timeoutError = (message?: string) => {
  return new HttpError(408, message || "Request Timeout");
};

// File upload error helpers
export const fileTooLargeError = (message?: string) => {
  return new HttpError(413, message || "File too large");
};

export const unsupportedMediaTypeError = (message?: string) => {
  return new HttpError(415, message || "Unsupported media type");
};

// Database error helpers
export const databaseError = (message?: string) => {
  return new InternalServerError(message || "Database error");
};

export const validationError = (message: string) => {
  return new UnprocessableEntityError(message);
};

// Export all error classes for convenience
export {
  HttpError as Error,
  BadRequestError as BadRequest,
  UnauthorizedError as Unauthorized,
  ForbiddenError as Forbidden,
  NotFoundError as NotFound,
  MethodNotAllowedError as MethodNotAllowed,
  ConflictError as Conflict,
  UnprocessableEntityError as UnprocessableEntity,
  TooManyRequestsError as TooManyRequests,
  InternalServerError as InternalServer,
  NotImplementedError as NotImplemented,
  BadGatewayError as BadGateway,
  ServiceUnavailableError as ServiceUnavailable,
};
