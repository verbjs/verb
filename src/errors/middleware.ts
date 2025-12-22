import type { ErrorHandler, Middleware, VerbRequest, VerbResponse } from "../types";
import { defaultErrorHandler, notFoundHandler } from "./index";

// Enhanced middleware system with error handling
export const createErrorHandlingMiddleware = (errorHandlers: ErrorHandler[] = []): Middleware => {
  // If no error handlers provided, use default
  if (errorHandlers.length === 0) {
    errorHandlers.push(defaultErrorHandler);
  }

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    try {
      next();
    } catch (error) {
      // Handle errors through error handlers
      await handleError(error as Error, req, res, errorHandlers);
    }
  };
};

// Helper function to handle errors
const handleError = async (
  error: Error,
  req: VerbRequest,
  res: VerbResponse,
  errorHandlers: ErrorHandler[],
) => {
  let errorHandled = false;
  let nextCalled = false;

  const next = () => {
    nextCalled = true;
  };

  for (const errorHandler of errorHandlers) {
    nextCalled = false;
    try {
      await errorHandler(error, req, res, next);
      if (!nextCalled) {
        // Error handler didn't call next(), error is handled
        errorHandled = true;
        break;
      }
    } catch (handlerError) {
      console.error("Error in error handler:", handlerError);
      // Continue to next error handler or use default
    }
  }

  // If no error handler handled the error, use default
  if (!errorHandled) {
    await defaultErrorHandler(error, req, res, () => {});
  }
};

// Create a 404 handler middleware
export const create404Handler = (): Middleware => {
  return (req: VerbRequest, res: VerbResponse, _next: () => void) => {
    // This will be called when no route matches
    notFoundHandler(req, res);
  };
};

// Async handler wrapper to catch errors
export const asyncHandler = (
  handler: (req: VerbRequest, res: VerbResponse) => Promise<any>,
): Middleware => {
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    await handler(req, res);
    next();
  };
};

// Try-catch wrapper for handlers
export const tryCatch = (handler: (req: VerbRequest, res: VerbResponse) => any): Middleware => {
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const result = await handler(req, res);
    if (result !== undefined) {
      // If handler returns something, we're done
      return;
    }
    next();
  };
};

// Error logging middleware
export const errorLogger: ErrorHandler = (
  err: Error,
  req: VerbRequest,
  _res: VerbResponse,
  next: () => void,
) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(Array.from(req.headers.entries())),
    timestamp: new Date().toISOString(),
  });
  next();
};

// Custom error handler that formats errors nicely
export const jsonErrorHandler: ErrorHandler = (
  err: Error,
  _req: VerbRequest,
  res: VerbResponse,
  next: () => void,
) => {
  // Check if response already sent
  if ((res as any).headersSent) {
    return next();
  }

  let statusCode = 500;
  let message = "Internal Server Error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
  } else if (err.name === "ForbiddenError") {
    statusCode = 403;
    message = "Forbidden";
  } else if (err.name === "NotFoundError") {
    statusCode = 404;
    message = "Not Found";
  }

  const errorResponse: any = {
    error: {
      status: statusCode,
      message: message,
    },
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === "development" && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// CORS error handler
export const corsErrorHandler: ErrorHandler = (
  _err: Error,
  _req: VerbRequest,
  res: VerbResponse,
  next: () => void,
) => {
  // Add CORS headers even for errors
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  next();
};

// Rate limit error handler
export const rateLimitErrorHandler: ErrorHandler = (
  err: Error,
  _req: VerbRequest,
  res: VerbResponse,
  next: () => void,
) => {
  if (err.name === "TooManyRequestsError") {
    res.status(429).json({
      error: {
        status: 429,
        message: "Too many requests",
        retryAfter: "900", // 15 minutes
      },
    });
    return;
  }
  next();
};

// Comprehensive error handler stack
export const createErrorHandlerStack = (
  options: {
    enableLogging?: boolean;
    enableCors?: boolean;
    enableRateLimit?: boolean;
    customHandlers?: ErrorHandler[];
  } = {},
): ErrorHandler[] => {
  const stack: ErrorHandler[] = [];

  // Add logging if enabled
  if (options.enableLogging !== false) {
    stack.push(errorLogger);
  }

  // Add CORS if enabled
  if (options.enableCors) {
    stack.push(corsErrorHandler);
  }

  // Add rate limit handler if enabled
  if (options.enableRateLimit) {
    stack.push(rateLimitErrorHandler);
  }

  // Add custom handlers
  if (options.customHandlers) {
    stack.push(...options.customHandlers);
  }

  // Add JSON error handler
  stack.push(jsonErrorHandler);

  return stack;
};
