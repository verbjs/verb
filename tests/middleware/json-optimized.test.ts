import { test, expect, describe } from "bun:test";
import {
  optimizedJSON,
  validateSchema,
  jsonResponse,
  validateBatch,
  withPerformanceMetrics,
  commonSchemas,
} from "../../src/middleware/json-optimized";

// Mock request helper
const createMockRequest = (
  body: any,
  contentType = "application/json"
): any => ({
  headers: new Headers({
    "content-type": contentType,
  }),
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

// Mock response helper
const createMockResponse = (): any => {
  let statusCode = 200;
  let responseData: any = null;
  const headers = new Map<string, string>();

  const res: any = {};

  res.status = (code: number) => {
    statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    responseData = data;
    return { statusCode, data: responseData };
  };
  res.header = (name: string, value: string) => {
    headers.set(name, value);
    return res;
  };
  res.send = (data: any) => {
    responseData = data;
    return { statusCode, data: responseData };
  };
  res._getStatus = () => statusCode;
  res._getData = () => responseData;
  res._getHeaders = () => headers;

  return res;
};

describe("optimizedJSON middleware", () => {
  test("passes through non-JSON requests", async () => {
    const middleware = optimizedJSON();
    const req = createMockRequest({}, "text/plain");
    const res = createMockResponse();
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  test("parses valid JSON body", async () => {
    const middleware = optimizedJSON();
    const req = createMockRequest({ name: "test", value: 42 });
    const res = createMockResponse();
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.body).toEqual({ name: "test", value: 42 });
  });

  test("returns 400 for invalid JSON", async () => {
    const middleware = optimizedJSON();
    const req = createMockRequest("{ invalid json }");
    const res = createMockResponse();

    const result = await middleware(req, res, () => {});

    expect(result.statusCode).toBe(400);
    expect(result.data.error).toBe("Invalid JSON");
  });

  test("returns 413 for body exceeding limit", async () => {
    const middleware = optimizedJSON({ limit: 10 });
    const req = createMockRequest({ data: "this is a long string" });
    const res = createMockResponse();

    const result = await middleware(req, res, () => {});

    expect(result.statusCode).toBe(413);
    expect(result.data.error).toBe("Request entity too large");
  });

  test("validates request with schema", async () => {
    const middleware = optimizedJSON({
      requestSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      },
    });

    const req = createMockRequest({ name: "John", age: 30 });
    const res = createMockResponse();
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.body.name).toBe("John");
  });

  test("returns 400 for schema validation failure", async () => {
    const middleware = optimizedJSON({
      requestSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    });

    const req = createMockRequest({ age: 30 }); // missing required 'name'
    const res = createMockResponse();

    const result = await middleware(req, res, () => {});

    expect(result.statusCode).toBe(400);
    expect(result.data.error).toBe("Request validation failed");
  });
});

describe("validateSchema middleware", () => {
  test("passes valid data through", async () => {
    const middleware = validateSchema({
      type: "object",
      properties: {
        id: { type: "number" },
      },
      required: ["id"],
    });

    const req = { body: { id: 123 } } as any;
    const res = createMockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.body.id).toBe(123);
  });

  test("returns 400 for invalid data", () => {
    const middleware = validateSchema({
      type: "object",
      properties: {
        id: { type: "number" },
      },
      required: ["id"],
    });

    const req = { body: {} } as any;
    const res = createMockResponse();

    const result = middleware(req, res, () => {});

    expect(result.statusCode).toBe(400);
    expect(result.data.error).toBe("Validation failed");
  });
});

describe("jsonResponse", () => {
  test("serializes data without schema", () => {
    const result = jsonResponse({ name: "test", value: 42 });

    expect(result).toBe('{"name":"test","value":42}');
  });

  test("serializes data with schema", () => {
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
      },
    };

    const result = jsonResponse({ name: "test" }, schema);

    expect(result).toContain("test");
  });
});

describe("validateBatch", () => {
  test("validates array of valid items", () => {
    const schema = {
      type: "object" as const,
      properties: {
        id: { type: "number" as const },
      },
      required: ["id"] as string[],
    };

    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = validateBatch(items, schema);

    expect(result.valid).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(result.errors).toBeUndefined();
  });

  test("returns errors for invalid items", () => {
    const schema = {
      type: "object" as const,
      properties: {
        id: { type: "number" as const },
      },
      required: ["id"] as string[],
    };

    const items = [{ id: 1 }, { name: "no id" }, { id: 3 }];
    const result = validateBatch(items, schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("[1]"))).toBe(true);
  });

  test("handles empty array", () => {
    const schema = {
      type: "object" as const,
      properties: {},
    };

    const result = validateBatch([], schema);

    expect(result.valid).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});

describe("withPerformanceMetrics", () => {
  test("wraps middleware and tracks metrics", async () => {
    const middleware = withPerformanceMetrics();

    const req = createMockRequest({ test: "data" });
    const res = createMockResponse();

    await middleware(req, res, () => {});

    // Body should be parsed
    expect(req.body).toEqual({ test: "data" });
  });
});

describe("commonSchemas", () => {
  test("user schema is defined correctly", () => {
    expect(commonSchemas.user.type).toBe("object");
    expect(commonSchemas.user.properties.id).toBeDefined();
    expect(commonSchemas.user.properties.name).toBeDefined();
    expect(commonSchemas.user.properties.email).toBeDefined();
    expect(commonSchemas.user.required).toContain("name");
    expect(commonSchemas.user.required).toContain("email");
  });

  test("apiResponse schema is defined correctly", () => {
    expect(commonSchemas.apiResponse.type).toBe("object");
    expect(commonSchemas.apiResponse.properties.success).toBeDefined();
    expect(commonSchemas.apiResponse.required).toContain("success");
  });

  test("errorResponse schema is defined correctly", () => {
    expect(commonSchemas.errorResponse.type).toBe("object");
    expect(commonSchemas.errorResponse.properties.error).toBeDefined();
    expect(commonSchemas.errorResponse.required).toContain("error");
  });
});
