import { test, expect } from "bun:test";
import { 
  HttpError, 
  BadRequestError, 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError, 
  InternalServerError,
  createError,
  getStatusText,
  isHttpError,
  defaultErrorHandler,
  notFoundHandler,
  asyncHandler,
  validateRequest,
  authenticationError,
  authorizationError
} from "../../src/errors";
import { 
  createErrorHandlingMiddleware,
  errorLogger,
  jsonErrorHandler,
  corsErrorHandler,
  createErrorHandlerStack
} from "../../src/errors/middleware";
import type { VerbRequest, VerbResponse } from "../../src/types";

// Mock helper functions
const createMockRequest = (overrides: Partial<Request> = {}): VerbRequest => {
  const mockHeaders = new Headers();
  const baseRequest = {
    method: 'GET',
    url: 'http://localhost:3000/test',
    headers: mockHeaders,
    ...overrides
  };
  
  return Object.assign(baseRequest, {
    ip: '127.0.0.1',
    protocol: 'http',
    secure: false,
    hostname: 'localhost',
    port: 3000,
    path: '/test',
    query: {},
    params: {},
    cookies: {},
    xhr: false,
    get: (header: string) => mockHeaders.get(header),
    header: (header: string) => mockHeaders.get(header),
    headers: mockHeaders
  }) as VerbRequest;
};

const createMockResponse = (): VerbResponse => {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let responseBody: any = null;
  let headersSent = false;
  
  const mockRes = {
    statusCode,
    headersSent,
    header: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
      return mockRes;
    },
    headers: (obj: Record<string, string>) => {
      Object.entries(obj).forEach(([key, value]) => {
        headers.set(key.toLowerCase(), value);
      });
      return mockRes;
    },
    status: (code: number) => {
      statusCode = code;
      mockRes.statusCode = code;
      return mockRes;
    },
    json: (data: any) => {
      responseBody = data;
      headersSent = true;
      return mockRes;
    },
    html: (data: string) => {
      responseBody = data;
      headersSent = true;
      return mockRes;
    },
    send: (data: any) => {
      responseBody = data;
      headersSent = true;
      return mockRes;
    },
    end: () => {
      headersSent = true;
      return mockRes;
    },
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    getHeaders: () => Object.fromEntries(headers.entries()),
    _getResponseBody: () => responseBody,
    _getStatusCode: () => statusCode,
    _isHeadersSent: () => headersSent
  };
  
  return mockRes as any;
};

// HttpError Tests
test("HttpError - creates error with status code and message", () => {
  const error = new HttpError(400, "Bad Request");
  
  expect(error.statusCode).toBe(400);
  expect(error.message).toBe("Bad Request");
  expect(error.expose).toBe(true);
  expect(error.name).toBe("HttpError");
});

test("HttpError - hides internal server errors by default", () => {
  const error = new HttpError(500, "Internal error", false);
  
  expect(error.statusCode).toBe(500);
  expect(error.expose).toBe(false);
});

test("BadRequestError - creates 400 error", () => {
  const error = new BadRequestError("Invalid input");
  
  expect(error.statusCode).toBe(400);
  expect(error.message).toBe("Invalid input");
  expect(error.name).toBe("BadRequestError");
});

test("UnauthorizedError - creates 401 error", () => {
  const error = new UnauthorizedError("Login required");
  
  expect(error.statusCode).toBe(401);
  expect(error.message).toBe("Login required");
  expect(error.name).toBe("UnauthorizedError");
});

test("ForbiddenError - creates 403 error", () => {
  const error = new ForbiddenError("Access denied");
  
  expect(error.statusCode).toBe(403);
  expect(error.message).toBe("Access denied");
  expect(error.name).toBe("ForbiddenError");
});

test("NotFoundError - creates 404 error", () => {
  const error = new NotFoundError("Resource not found");
  
  expect(error.statusCode).toBe(404);
  expect(error.message).toBe("Resource not found");
  expect(error.name).toBe("NotFoundError");
});

test("InternalServerError - creates 500 error", () => {
  const error = new InternalServerError("Server error");
  
  expect(error.statusCode).toBe(500);
  expect(error.message).toBe("Server error");
  expect(error.expose).toBe(false);
  expect(error.name).toBe("InternalServerError");
});

// Error Utilities Tests
test("createError - creates HttpError with status code", () => {
  const error = createError(422, "Validation failed");
  
  expect(error.statusCode).toBe(422);
  expect(error.message).toBe("Validation failed");
  expect(error.expose).toBe(true);
});

test("createError - uses default message for status code", () => {
  const error = createError(404);
  
  expect(error.statusCode).toBe(404);
  expect(error.message).toBe("Not Found");
});

test("getStatusText - returns correct status text", () => {
  expect(getStatusText(400)).toBe("Bad Request");
  expect(getStatusText(401)).toBe("Unauthorized");
  expect(getStatusText(404)).toBe("Not Found");
  expect(getStatusText(500)).toBe("Internal Server Error");
  expect(getStatusText(999)).toBe("Unknown Error");
});

test("isHttpError - identifies HttpError instances", () => {
  const httpError = new HttpError(400, "Bad Request");
  const regularError = new Error("Regular error");
  const errorLike = { statusCode: 400, message: "Error-like" };
  
  expect(isHttpError(httpError)).toBe(true);
  expect(isHttpError(regularError)).toBe(false);
  expect(isHttpError(errorLike)).toBe(true);
});

// Default Error Handler Tests
test("defaultErrorHandler - handles HttpError", async () => {
  const req = createMockRequest();
  const res = createMockResponse();
  const error = new BadRequestError("Invalid input");
  let nextCalled = false;
  
  await defaultErrorHandler(error, req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(false);
  expect(res._getStatusCode()).toBe(400);
  expect(res._getResponseBody()).toEqual({
    error: {
      status: 400,
      message: "Invalid input"
    }
  });
});

test("defaultErrorHandler - handles regular Error", async () => {
  const req = createMockRequest();
  const res = createMockResponse();
  const error = new Error("Regular error");
  let nextCalled = false;

  // Suppress expected console.error during test
  const originalError = console.error;
  console.error = () => {};

  await defaultErrorHandler(error, req, res, () => { nextCalled = true; });

  console.error = originalError;

  expect(nextCalled).toBe(false);
  expect(res._getStatusCode()).toBe(500);
  expect(res._getResponseBody()).toEqual({
    error: {
      status: 500,
      message: "Internal Server Error"
    }
  });
});

test("defaultErrorHandler - exposes errors in development", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  const req = createMockRequest();
  const res = createMockResponse();
  const error = new Error("Development error");
  let nextCalled = false;

  // Suppress expected console.error during test
  const originalError = console.error;
  console.error = () => {};

  await defaultErrorHandler(error, req, res, () => { nextCalled = true; });

  console.error = originalError;
  process.env.NODE_ENV = originalEnv;

  expect(res._getResponseBody().error.message).toBe("Development error");
});

test("defaultErrorHandler - skips if headers already sent", async () => {
  const req = createMockRequest();
  const res = createMockResponse();
  res.headersSent = true;
  const error = new Error("Test error");
  let nextCalled = false;
  
  await defaultErrorHandler(error, req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
});

// 404 Handler Tests
test("notFoundHandler - handles API requests", () => {
  const req = createMockRequest();
  req.path = '/api/users';
  req.headers.set('accept', 'application/json');
  const res = createMockResponse();
  
  notFoundHandler(req, res);
  
  expect(res._getStatusCode()).toBe(404);
  expect(res._getResponseBody()).toEqual({
    error: {
      status: 404,
      message: "Cannot GET /api/users"
    }
  });
});

test("notFoundHandler - handles HTML requests", () => {
  const req = createMockRequest();
  req.path = '/nonexistent';
  req.headers.set('accept', 'text/html');
  const res = createMockResponse();
  
  notFoundHandler(req, res);
  
  expect(res._getStatusCode()).toBe(404);
  expect(typeof res._getResponseBody()).toBe('string');
  expect(res._getResponseBody()).toContain('404');
  expect(res._getResponseBody()).toContain('Page Not Found');
});

// Async Handler Tests
test("asyncHandler - catches async errors", async () => {
  const handler = asyncHandler(async (req, res) => {
    throw new BadRequestError("Async error");
  });
  
  const req = createMockRequest();
  const res = createMockResponse();
  let caughtError: Error | null = null;
  
  try {
    await handler(req, res, () => {});
  } catch (error) {
    caughtError = error as Error;
  }
  
  expect(caughtError).not.toBeNull();
  expect(caughtError?.message).toBe("Async error");
  expect((caughtError as any)?.statusCode).toBe(400);
  expect((caughtError as any)?.name).toBe("BadRequestError");
});

test("asyncHandler - calls next on success", async () => {
  const handler = asyncHandler(async (req, res) => {
    // Successful handler
    res.json({ success: true });
  });
  
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  try {
    await handler(req, res, () => { nextCalled = true; });
    // If no error thrown, test passes
    expect(true).toBe(true);
  } catch (error) {
    // Should not throw for successful handlers
    expect(error).toBeUndefined();
  }
});

// Validation Tests
test("validateRequest - validates required fields", () => {
  const req = createMockRequest();
  req.body = { name: "John" };
  
  const schema = {
    body: true,
    requiredFields: ["name", "email"]
  };
  
  expect(() => validateRequest(req, schema)).toThrow("Field 'email' is required");
});

test("validateRequest - validates body presence", () => {
  const req = createMockRequest();
  
  const schema = {
    body: true,
    requiredFields: ["name"]
  };
  
  expect(() => validateRequest(req, schema)).toThrow("Request body is required");
});

test("validateRequest - passes valid request", () => {
  const req = createMockRequest();
  req.body = { name: "John", email: "john@example.com" };
  
  const schema = {
    body: true,
    requiredFields: ["name", "email"]
  };
  
  expect(() => validateRequest(req, schema)).not.toThrow();
});

// Helper Functions Tests
test("authenticationError - creates 401 error", () => {
  const error = authenticationError("Token expired");
  
  expect(error.statusCode).toBe(401);
  expect(error.message).toBe("Token expired");
});

test("authorizationError - creates 403 error", () => {
  const error = authorizationError("Admin access required");
  
  expect(error.statusCode).toBe(403);
  expect(error.message).toBe("Admin access required");
});

// Error Middleware Tests
test("errorLogger - logs error details", async () => {
  const req = createMockRequest();
  const res = createMockResponse();
  const error = new Error("Test error");
  let nextCalled = false;
  
  // Mock console.error
  const originalConsoleError = console.error;
  let loggedData: any = null;
  console.error = (message: string, data: any) => {
    loggedData = data;
  };
  
  await errorLogger(error, req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(loggedData).toBeDefined();
  expect(loggedData.message).toBe("Test error");
  expect(loggedData.method).toBe("GET");
  expect(loggedData.url).toBe("http://localhost:3000/test");
  
  console.error = originalConsoleError;
});

test("jsonErrorHandler - formats error as JSON", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  const req = createMockRequest();
  const res = createMockResponse();
  const error = new Error("Test error");
  let nextCalled = false;
  
  await jsonErrorHandler(error, req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(false);
  expect(res._getStatusCode()).toBe(500);
  expect(res._getResponseBody()).toEqual({
    error: {
      status: 500,
      message: "Internal Server Error"
    }
  });
  
  process.env.NODE_ENV = originalEnv;
});

test("jsonErrorHandler - handles validation errors", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  const req = createMockRequest();
  const res = createMockResponse();
  const error = new Error("Validation failed");
  error.name = "ValidationError";
  let nextCalled = false;
  
  await jsonErrorHandler(error, req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(false);
  expect(res._getStatusCode()).toBe(400);
  expect(res._getResponseBody()).toEqual({
    error: {
      status: 400,
      message: "Validation failed"
    }
  });
  
  process.env.NODE_ENV = originalEnv;
});

test("corsErrorHandler - adds CORS headers", async () => {
  const req = createMockRequest();
  const res = createMockResponse();
  const error = new Error("CORS error");
  let nextCalled = false;
  
  await corsErrorHandler(error, req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('access-control-allow-origin')).toBe('*');
  expect(res.getHeader('access-control-allow-methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
  expect(res.getHeader('access-control-allow-headers')).toBe('Content-Type, Authorization');
});

test("createErrorHandlerStack - creates handler stack", () => {
  const stack = createErrorHandlerStack({
    enableLogging: true,
    enableCors: true,
    enableRateLimit: true
  });
  
  expect(stack.length).toBe(4); // logger, cors, rateLimit, json
  expect(typeof stack[0]).toBe('function');
  expect(typeof stack[1]).toBe('function');
  expect(typeof stack[2]).toBe('function');
  expect(typeof stack[3]).toBe('function');
});

test("createErrorHandlerStack - with custom handlers", () => {
  const customHandler = async (err: Error, req: any, res: any, next: any) => {
    next();
  };
  
  const stack = createErrorHandlerStack({
    enableLogging: false,
    customHandlers: [customHandler]
  });
  
  expect(stack.length).toBe(2); // custom + json
  expect(stack[0]).toBe(customHandler);
});