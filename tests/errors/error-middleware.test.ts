import { test, expect, describe } from "bun:test";
import {
  createErrorHandlingMiddleware,
  create404Handler,
  asyncHandler,
  tryCatch,
  errorLogger,
  jsonErrorHandler,
  corsErrorHandler,
  rateLimitErrorHandler,
  createErrorHandlerStack,
} from "../../src/errors/middleware";

// Mock request helper
const createMockRequest = (
  method = "GET",
  url = "http://localhost:3000/test"
): any => ({
  method,
  url,
  path: new URL(url).pathname,
  headers: new Headers({
    accept: "application/json",
  }),
});

// Mock response helper
const createMockResponse = (): any => {
  let statusCode = 200;
  let responseData: any = null;
  const headers = new Map<string, string>();
  let headersSent = false;

  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      headersSent = true;
      return res;
    },
    header: (name: string, value: string) => {
      headers.set(name, value);
      return res;
    },
    send: (data: any) => {
      responseData = data;
      headersSent = true;
      return res;
    },
    html: (content: string) => {
      responseData = content;
      headersSent = true;
      return res;
    },
    headersSent,
    _getStatus: () => statusCode,
    _getData: () => responseData,
    _getHeaders: () => headers,
  };

  return res;
};

describe("createErrorHandlingMiddleware", () => {
  test("creates middleware function", () => {
    const middleware = createErrorHandlingMiddleware();
    expect(typeof middleware).toBe("function");
  });

  test("calls next on success", async () => {
    const middleware = createErrorHandlingMiddleware();
    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  test("uses default error handler if none provided", () => {
    const middleware = createErrorHandlingMiddleware([]);
    expect(typeof middleware).toBe("function");
  });
});

describe("create404Handler", () => {
  test("creates 404 handler middleware", () => {
    const handler = create404Handler();
    expect(typeof handler).toBe("function");
  });

  test("returns 404 response", () => {
    const handler = create404Handler();
    const req = createMockRequest("GET", "http://localhost:3000/not-found");
    const res = createMockResponse();

    handler(req, res, () => {});

    expect(res._getStatus()).toBe(404);
  });
});

describe("asyncHandler", () => {
  test("wraps async handler", () => {
    const handler = asyncHandler(async (req, res) => {
      res.json({ success: true });
    });

    expect(typeof handler).toBe("function");
  });

  test("calls next after handler completes", async () => {
    const handler = asyncHandler(async (req, res) => {
      res.json({ success: true });
    });

    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    await handler(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  test("throws error from handler", async () => {
    const handler = asyncHandler(async () => {
      throw new Error("Test error");
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await expect(handler(req, res, () => {})).rejects.toThrow("Test error");
  });
});

describe("tryCatch", () => {
  test("wraps handler with try-catch", () => {
    const handler = tryCatch((req, res) => {
      res.json({ success: true });
    });

    expect(typeof handler).toBe("function");
  });

  test("calls next if handler returns undefined", async () => {
    const handler = tryCatch((req, res) => {
      // Does nothing, returns undefined
    });

    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    await handler(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  test("does not call next if handler returns value", async () => {
    const handler = tryCatch((req, res) => {
      return res.json({ data: "value" });
    });

    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    await handler(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
  });

  test("throws error from handler", async () => {
    const handler = tryCatch(() => {
      throw new Error("Handler error");
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await expect(handler(req, res, () => {})).rejects.toThrow("Handler error");
  });
});

describe("errorLogger", () => {
  test("logs error and calls next", () => {
    const error = new Error("Test error");
    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    errorLogger(error, req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});

describe("jsonErrorHandler", () => {
  test("returns 500 for generic error", () => {
    const error = new Error("Something went wrong");
    const req = createMockRequest();
    const res = createMockResponse();

    jsonErrorHandler(error, req, res, () => {});

    expect(res._getStatus()).toBe(500);
    expect(res._getData().error.message).toBe("Internal Server Error");
  });

  test("returns 400 for ValidationError", () => {
    const error = new Error("Invalid input");
    error.name = "ValidationError";
    const req = createMockRequest();
    const res = createMockResponse();

    jsonErrorHandler(error, req, res, () => {});

    expect(res._getStatus()).toBe(400);
  });

  test("returns 401 for UnauthorizedError", () => {
    const error = new Error("Not authorized");
    error.name = "UnauthorizedError";
    const req = createMockRequest();
    const res = createMockResponse();

    jsonErrorHandler(error, req, res, () => {});

    expect(res._getStatus()).toBe(401);
    expect(res._getData().error.message).toBe("Unauthorized");
  });

  test("returns 403 for ForbiddenError", () => {
    const error = new Error("Access denied");
    error.name = "ForbiddenError";
    const req = createMockRequest();
    const res = createMockResponse();

    jsonErrorHandler(error, req, res, () => {});

    expect(res._getStatus()).toBe(403);
    expect(res._getData().error.message).toBe("Forbidden");
  });

  test("returns 404 for NotFoundError", () => {
    const error = new Error("Resource not found");
    error.name = "NotFoundError";
    const req = createMockRequest();
    const res = createMockResponse();

    jsonErrorHandler(error, req, res, () => {});

    expect(res._getStatus()).toBe(404);
    expect(res._getData().error.message).toBe("Not Found");
  });

  test("calls next if headers already sent", () => {
    const error = new Error("Test error");
    const req = createMockRequest();
    const res = createMockResponse();
    res.headersSent = true;
    let nextCalled = false;

    jsonErrorHandler(error, req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});

describe("corsErrorHandler", () => {
  test("adds CORS headers and calls next", () => {
    const error = new Error("Test error");
    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    corsErrorHandler(error, req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(res._getHeaders().get("Access-Control-Allow-Origin")).toBe("*");
    expect(res._getHeaders().get("Access-Control-Allow-Methods")).toBeDefined();
    expect(res._getHeaders().get("Access-Control-Allow-Headers")).toBeDefined();
  });
});

describe("rateLimitErrorHandler", () => {
  test("returns 429 for TooManyRequestsError", () => {
    const error = new Error("Rate limit exceeded");
    error.name = "TooManyRequestsError";
    const req = createMockRequest();
    const res = createMockResponse();

    rateLimitErrorHandler(error, req, res, () => {});

    expect(res._getStatus()).toBe(429);
    expect(res._getData().error.status).toBe(429);
    expect(res._getData().error.retryAfter).toBe("900");
  });

  test("calls next for non-rate-limit errors", () => {
    const error = new Error("Other error");
    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    rateLimitErrorHandler(error, req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});

describe("createErrorHandlerStack", () => {
  test("creates stack with default options", () => {
    const stack = createErrorHandlerStack();

    expect(Array.isArray(stack)).toBe(true);
    expect(stack.length).toBeGreaterThan(0);
  });

  test("includes logging by default", () => {
    const stack = createErrorHandlerStack();

    // Stack should include errorLogger
    expect(stack).toContain(errorLogger);
  });

  test("excludes logging when disabled", () => {
    const stack = createErrorHandlerStack({ enableLogging: false });

    expect(stack).not.toContain(errorLogger);
  });

  test("includes CORS handler when enabled", () => {
    const stack = createErrorHandlerStack({ enableCors: true });

    expect(stack).toContain(corsErrorHandler);
  });

  test("excludes CORS handler by default", () => {
    const stack = createErrorHandlerStack();

    expect(stack).not.toContain(corsErrorHandler);
  });

  test("includes rate limit handler when enabled", () => {
    const stack = createErrorHandlerStack({ enableRateLimit: true });

    expect(stack).toContain(rateLimitErrorHandler);
  });

  test("includes custom handlers", () => {
    const customHandler = (err: Error, req: any, res: any, next: () => void) => {
      next();
    };

    const stack = createErrorHandlerStack({
      customHandlers: [customHandler],
    });

    expect(stack).toContain(customHandler);
  });

  test("always includes jsonErrorHandler at end", () => {
    const stack = createErrorHandlerStack();

    expect(stack[stack.length - 1]).toBe(jsonErrorHandler);
  });

  test("creates comprehensive stack with all options", () => {
    const customHandler = (err: Error, req: any, res: any, next: () => void) => {
      next();
    };

    const stack = createErrorHandlerStack({
      enableLogging: true,
      enableCors: true,
      enableRateLimit: true,
      customHandlers: [customHandler],
    });

    expect(stack).toContain(errorLogger);
    expect(stack).toContain(corsErrorHandler);
    expect(stack).toContain(rateLimitErrorHandler);
    expect(stack).toContain(customHandler);
    expect(stack).toContain(jsonErrorHandler);
  });
});
