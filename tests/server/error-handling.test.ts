import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createMockServer } from "../../src/mock.ts";
import { clearCache } from "../../src/cache.ts";
import {
	VerbError,
	BadRequestError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError,
	ConflictError,
	ValidationError,
	RateLimitError,
	InternalServerError,
	errorHandler,
	defaultErrorHandler,
	serializeError,
	asyncHandler,
	ErrorBoundary,
	throwError,
	errors,
} from "../../src/error.ts";
import { json } from "../../src/response.ts";

describe("Error Handling System", () => {
	let server: any;

	beforeEach(() => {
		clearCache();
		server = createMockServer();
	});

	describe("VerbError Base Class", () => {
		it("should create error with default values", () => {
			const error = new VerbError("Test error");
			expect(error.message).toBe("Test error");
			expect(error.statusCode).toBe(500);
			expect(error.code).toBe("INTERNAL_ERROR");
			expect(error.timestamp).toBeInstanceOf(Date);
		});

		it("should create error with custom values", () => {
			const details = { field: "username" };
			const error = new VerbError("Custom error", 400, "CUSTOM_ERROR", details);
			expect(error.message).toBe("Custom error");
			expect(error.statusCode).toBe(400);
			expect(error.code).toBe("CUSTOM_ERROR");
			expect(error.details).toEqual(details);
		});

		it("should serialize error to JSON", () => {
			const error = new VerbError("Test error", 400, "TEST_ERROR", {
				field: "test",
			});
			const serialized = error.toJSON();

			expect(serialized.error.name).toBe("VerbError");
			expect(serialized.error.message).toBe("Test error");
			expect(serialized.error.code).toBe("TEST_ERROR");
			expect(serialized.error.statusCode).toBe(400);
			expect(serialized.error.details).toEqual({ field: "test" });
			expect(serialized.error.timestamp).toBeDefined();
		});
	});

	describe("HTTP Error Classes", () => {
		it("should create BadRequestError", () => {
			const error = new BadRequestError("Invalid input");
			expect(error.statusCode).toBe(400);
			expect(error.code).toBe("BAD_REQUEST");
			expect(error.message).toBe("Invalid input");
		});

		it("should create UnauthorizedError", () => {
			const error = new UnauthorizedError();
			expect(error.statusCode).toBe(401);
			expect(error.code).toBe("UNAUTHORIZED");
			expect(error.message).toBe("Unauthorized");
		});

		it("should create ForbiddenError", () => {
			const error = new ForbiddenError();
			expect(error.statusCode).toBe(403);
			expect(error.code).toBe("FORBIDDEN");
		});

		it("should create NotFoundError", () => {
			const error = new NotFoundError();
			expect(error.statusCode).toBe(404);
			expect(error.code).toBe("NOT_FOUND");
		});

		it("should create ConflictError", () => {
			const error = new ConflictError();
			expect(error.statusCode).toBe(409);
			expect(error.code).toBe("CONFLICT");
		});

		it("should create ValidationError", () => {
			const error = new ValidationError();
			expect(error.statusCode).toBe(422);
			expect(error.code).toBe("VALIDATION_ERROR");
		});

		it("should create RateLimitError", () => {
			const error = new RateLimitError();
			expect(error.statusCode).toBe(429);
			expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
		});

		it("should create InternalServerError", () => {
			const error = new InternalServerError();
			expect(error.statusCode).toBe(500);
			expect(error.code).toBe("INTERNAL_ERROR");
		});
	});

	describe("Error Serialization", () => {
		it("should serialize VerbError", () => {
			const error = new BadRequestError("Invalid data", { field: "email" });
			const serialized = serializeError(error, false);

			expect(serialized.error.statusCode).toBe(400);
			expect(serialized.error.code).toBe("BAD_REQUEST");
			expect(serialized.error.details).toEqual({ field: "email" });
			expect(serialized.error.stack).toBeUndefined();
		});

		it("should serialize VerbError with stack", () => {
			const error = new BadRequestError("Invalid data");
			const serialized = serializeError(error, true);

			expect(serialized.error.stack).toBeDefined();
		});

		it("should serialize regular Error", () => {
			const error = new Error("Regular error");
			const serialized = serializeError(error, false);

			expect(serialized.error.name).toBe("Error");
			expect(serialized.error.message).toBe("Regular error");
			expect(serialized.error.code).toBe("UNKNOWN_ERROR");
			expect(serialized.error.statusCode).toBe(500);
		});
	});

	describe("Error Handler Middleware", () => {
		it("should catch and handle VerbError", async () => {
			server.use(errorHandler());
			server.get("/test", () => {
				throw new BadRequestError("Invalid request");
			});

			const response = await server.request.get("/test");
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error.code).toBe("BAD_REQUEST");
			expect(data.error.message).toBe("Invalid request");
		});

		it("should catch and handle regular Error", async () => {
			server.use(errorHandler());
			server.get("/test", () => {
				throw new Error("Regular error");
			});

			const response = await server.request.get("/test");
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error.code).toBe("UNKNOWN_ERROR");
			expect(data.error.message).toBe("Regular error");
		});

		it("should use custom error handler", async () => {
			const customHandlers = new Map();
			customHandlers.set("BadRequestError", (error: Error) => {
				return new Response(
					JSON.stringify({ custom: "handled", message: error.message }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			});

			server.use(errorHandler({ customHandlers }));
			server.get("/test", () => {
				throw new BadRequestError("Custom handling");
			});

			const response = await server.request.get("/test");
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.custom).toBe("handled");
			expect(data.message).toBe("Custom handling");
		});

		it("should handle async errors", async () => {
			server.use(errorHandler());
			server.get("/test", async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				throw new UnauthorizedError("Async error");
			});

			const response = await server.request.get("/test");
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error.code).toBe("UNAUTHORIZED");
		});
	});

	describe("Async Handler", () => {
		it("should wrap async handler and catch errors", async () => {
			const handler = asyncHandler(async () => {
				throw new Error("Async error");
			});

			try {
				await handler(new Request("http://test.com"), {});
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(InternalServerError);
				expect((error as InternalServerError).message).toBe("Async error");
			}
		});

		it("should pass through VerbError unchanged", async () => {
			const handler = asyncHandler(async () => {
				throw new BadRequestError("Original error");
			});

			try {
				await handler(new Request("http://test.com"), {});
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestError);
				expect((error as BadRequestError).message).toBe("Original error");
			}
		});
	});

	describe("Error Boundary", () => {
		it("should register and use custom handlers", async () => {
			const boundary = new ErrorBoundary();
			boundary.register("BadRequestError", (error) => {
				return new Response(
					JSON.stringify({ boundary: "handled", error: error.message }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			});

			const error = new BadRequestError("Boundary test");
			const req = new Request("http://test.com");
			const response = await boundary.handle(error, req);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.boundary).toBe("handled");
			expect(data.error).toBe("Boundary test");
		});

		it("should use fallback handler for unregistered errors", async () => {
			const boundary = new ErrorBoundary();

			const error = new Error("Unhandled error");
			const req = new Request("http://test.com");
			const response = await boundary.handle(error, req);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error.code).toBe("UNKNOWN_ERROR");
		});

		it("should create middleware", async () => {
			const boundary = new ErrorBoundary();
			boundary.register("NotFoundError", () => {
				return new Response(JSON.stringify({ custom: "not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			});

			server.use(boundary.middleware());
			server.get("/test", () => {
				throw new NotFoundError("Custom not found");
			});

			const response = await server.request.get("/test");
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.custom).toBe("not found");
		});
	});

	describe("Helper Functions", () => {
		it("should throw error with throwError helper", () => {
			expect(() => {
				throwError("Test error", 400, "TEST_CODE");
			}).toThrow(VerbError);
		});

		it("should create errors with helper functions", () => {
			expect(errors.badRequest("Bad")).toBeInstanceOf(BadRequestError);
			expect(errors.unauthorized("Unauth")).toBeInstanceOf(UnauthorizedError);
			expect(errors.forbidden("Forbidden")).toBeInstanceOf(ForbiddenError);
			expect(errors.notFound("Not found")).toBeInstanceOf(NotFoundError);
			expect(errors.conflict("Conflict")).toBeInstanceOf(ConflictError);
			expect(errors.validation("Invalid")).toBeInstanceOf(ValidationError);
			expect(errors.rateLimit("Limited")).toBeInstanceOf(RateLimitError);
			expect(errors.internal("Internal")).toBeInstanceOf(InternalServerError);
		});
	});

	describe("Integration Tests", () => {
		it("should handle errors in complex middleware chain", async () => {
			server.use(errorHandler());

			// Middleware that might throw
			server.use(
				async (req: Request, next: () => Response | Promise<Response>) => {
					if (req.url.includes("forbidden")) {
						throw new ForbiddenError("Access denied");
					}
					return next();
				},
			);

			server.get("/test/forbidden", () =>
				json({ message: "Should not reach here" }),
			);
			server.get("/test/ok", () => json({ message: "Success" }));

			// Test forbidden path
			const forbiddenResponse = await server.request.get("/test/forbidden");
			const forbiddenData = await forbiddenResponse.json();

			expect(forbiddenResponse.status).toBe(403);
			expect(forbiddenData.error.code).toBe("FORBIDDEN");

			// Test successful path
			const okResponse = await server.request.get("/test/ok");
			const okData = await okResponse.json();

			expect(okResponse.status).toBe(200);
			expect(okData.message).toBe("Success");
		});

		it("should maintain error context through middleware", async () => {
			const customHandler = (error: Error, req: Request) => {
				return new Response(
					JSON.stringify({
						error: error.message,
						url: req.url,
						method: req.method,
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			};

			server.use(errorHandler({ fallbackHandler: customHandler }));
			server.post("/test", () => {
				throw new Error("Context test");
			});

			const response = await server.request.post("/test");
			const data = await response.json();

			expect(data.error).toBe("Context test");
			expect(data.url).toBe("http://localhost:3000/test");
			expect(data.method).toBe("POST");
		});
	});
});
