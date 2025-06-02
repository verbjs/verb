import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import {
	createServer,
	json,
	schema,
	SchemaValidationError,
	validateSchema,
	type JsonSchema,
	type RouteSchema,
} from "../../src/index.ts";

describe("Schema Validation", () => {
	describe("Basic Schema Validation", () => {
		test("should validate simple string schema", () => {
			const schema: JsonSchema = {
				type: "string",
				minLength: 2,
				maxLength: 10,
			};

			expect(validateSchema("hello", schema)).toHaveLength(0);
			expect(validateSchema("h", schema)).toHaveLength(1);
			expect(validateSchema("verylongstring", schema)).toHaveLength(1);
			expect(validateSchema(123, schema)).toHaveLength(1);
		});

		test("should validate email format", () => {
			const schema: JsonSchema = { type: "string", format: "email" };

			expect(validateSchema("test@example.com", schema)).toHaveLength(0);
			expect(validateSchema("user+tag@domain.co.uk", schema)).toHaveLength(0);
			expect(validateSchema("invalid-email", schema)).toHaveLength(1);
			expect(validateSchema("@domain.com", schema)).toHaveLength(1);
		});

		test("should validate number ranges", () => {
			const schema: JsonSchema = { type: "number", minimum: 0, maximum: 100 };

			expect(validateSchema(50, schema)).toHaveLength(0);
			expect(validateSchema(0, schema)).toHaveLength(0);
			expect(validateSchema(100, schema)).toHaveLength(0);
			expect(validateSchema(-1, schema)).toHaveLength(1);
			expect(validateSchema(101, schema)).toHaveLength(1);
		});

		test("should validate integer type", () => {
			const schema: JsonSchema = { type: "integer", minimum: 1 };

			expect(validateSchema(5, schema)).toHaveLength(0);
			expect(validateSchema(1, schema)).toHaveLength(0);
			expect(validateSchema(5.5, schema)).toHaveLength(1);
			expect(validateSchema(0, schema)).toHaveLength(1);
		});

		test("should validate enum values", () => {
			const schema: JsonSchema = {
				type: "string",
				enum: ["red", "green", "blue"],
			};

			expect(validateSchema("red", schema)).toHaveLength(0);
			expect(validateSchema("blue", schema)).toHaveLength(0);
			expect(validateSchema("yellow", schema)).toHaveLength(1);
			expect(validateSchema("RED", schema)).toHaveLength(1);
		});
	});

	describe("Object Schema Validation", () => {
		test("should validate required fields", () => {
			const schema: JsonSchema = {
				type: "object",
				required: ["name", "email"],
				properties: {
					name: { type: "string" },
					email: { type: "string", format: "email" },
				},
			};

			const validObject = { name: "John", email: "john@example.com" };
			const missingName = { email: "john@example.com" };
			const missingEmail = { name: "John" };

			expect(validateSchema(validObject, schema)).toHaveLength(0);
			expect(validateSchema(missingName, schema)).toHaveLength(1);
			expect(validateSchema(missingEmail, schema)).toHaveLength(1);
		});

		test("should validate nested objects", () => {
			const schema: JsonSchema = {
				type: "object",
				properties: {
					user: {
						type: "object",
						required: ["id"],
						properties: {
							id: { type: "integer" },
							profile: {
								type: "object",
								properties: {
									age: { type: "integer", minimum: 0 },
								},
							},
						},
					},
				},
			};

			const validNested = {
				user: {
					id: 123,
					profile: { age: 25 },
				},
			};

			const invalidNested = {
				user: {
					profile: { age: -1 }, // missing required id, invalid age
				},
			};

			expect(validateSchema(validNested, schema)).toHaveLength(0);
			const errors = validateSchema(invalidNested, schema);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((e) => e.field.includes("id"))).toBe(true);
			expect(errors.some((e) => e.field.includes("age"))).toBe(true);
		});

		test("should handle additionalProperties", () => {
			const strictSchema: JsonSchema = {
				type: "object",
				properties: { name: { type: "string" } },
				additionalProperties: false,
			};

			const allowedSchema: JsonSchema = {
				type: "object",
				properties: { name: { type: "string" } },
				additionalProperties: true,
			};

			const objectWithExtra = { name: "John", age: 25 };

			expect(validateSchema(objectWithExtra, strictSchema)).toHaveLength(1);
			expect(validateSchema(objectWithExtra, allowedSchema)).toHaveLength(0);
		});
	});

	describe("Array Schema Validation", () => {
		test("should validate array length", () => {
			const schema: JsonSchema = {
				type: "array",
				minItems: 2,
				maxItems: 5,
				items: { type: "string" },
			};

			expect(validateSchema(["a", "b"], schema)).toHaveLength(0);
			expect(validateSchema(["a", "b", "c"], schema)).toHaveLength(0);
			expect(validateSchema(["a"], schema)).toHaveLength(1); // too short
			expect(
				validateSchema(["a", "b", "c", "d", "e", "f"], schema),
			).toHaveLength(1); // too long
		});

		test("should validate array items", () => {
			const schema: JsonSchema = {
				type: "array",
				items: {
					type: "object",
					required: ["id", "name"],
					properties: {
						id: { type: "integer" },
						name: { type: "string", minLength: 1 },
					},
				},
			};

			const validArray = [
				{ id: 1, name: "Item 1" },
				{ id: 2, name: "Item 2" },
			];

			const invalidArray = [
				{ id: 1, name: "Item 1" },
				{ id: "not-number", name: "" }, // invalid id type, empty name
			];

			expect(validateSchema(validArray, schema)).toHaveLength(0);
			const errors = validateSchema(invalidArray, schema);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((e) => e.field.includes("[1]"))).toBe(true);
		});
	});

	describe("Format Validation", () => {
		test("should validate date format", () => {
			const schema: JsonSchema = { type: "string", format: "date" };

			expect(validateSchema("2023-12-25", schema)).toHaveLength(0);
			expect(validateSchema("2023-13-25", schema)).toHaveLength(1); // invalid month
			expect(validateSchema("23-12-25", schema)).toHaveLength(1); // wrong format
			expect(validateSchema("2023/12/25", schema)).toHaveLength(1); // wrong format
		});

		test("should validate URI format", () => {
			const schema: JsonSchema = { type: "string", format: "uri" };

			expect(validateSchema("https://example.com", schema)).toHaveLength(0);
			expect(validateSchema("http://localhost:3000/path", schema)).toHaveLength(
				0,
			);
			expect(validateSchema("ftp://files.example.com", schema)).toHaveLength(0);
			expect(validateSchema("not-a-uri", schema)).toHaveLength(1);
			expect(validateSchema("://invalid", schema)).toHaveLength(1);
		});

		test("should validate UUID format", () => {
			const schema: JsonSchema = { type: "string", format: "uuid" };

			expect(
				validateSchema("123e4567-e89b-12d3-a456-426614174000", schema),
			).toHaveLength(0);
			expect(
				validateSchema("550e8400-e29b-41d4-a716-446655440000", schema),
			).toHaveLength(0);
			expect(validateSchema("not-a-uuid", schema)).toHaveLength(1);
			expect(validateSchema("123e4567-e89b-12d3-a456", schema)).toHaveLength(1); // too short
		});
	});
});

describe("Route Schema Validation", () => {
	let server: any;
	let baseURL: string;

	beforeEach(() => {
		const app = createServer({ port: 0 });

		// User creation route with validation
		app.post(
			"/users",
			schema({
				body: {
					type: "object",
					required: ["name", "email"],
					properties: {
						name: { type: "string", minLength: 2, maxLength: 50 },
						email: { type: "string", format: "email" },
						age: { type: "integer", minimum: 18, maximum: 120 },
					},
					additionalProperties: false,
				},
				response: {
					201: {
						type: "object",
						properties: {
							id: { type: "integer" },
							name: { type: "string" },
							email: { type: "string" },
						},
					},
				},
			})((req) => {
				const userData = (req as any).validatedBody;
				return json(
					{
						id: 123,
						name: userData.name,
						email: userData.email,
					},
					201,
				);
			}),
		);

		// Search route with query validation
		app.get(
			"/search",
			schema({
				query: {
					type: "object",
					properties: {
						q: { type: "string", minLength: 1 },
						limit: { type: "integer", minimum: 1, maximum: 100 },
						category: {
							type: "string",
							enum: ["books", "electronics", "clothing"],
						},
					},
				},
			})((req) => {
				const query = (req as any).validatedQuery;
				return json({
					query,
					results: [],
				});
			}),
		);

		// Global error handler
		app.use(async (req, next) => {
			try {
				return await next();
			} catch (error) {
				if (error instanceof SchemaValidationError) {
					return json(
						{
							error: "Validation failed",
							details: error.errors,
						},
						400,
					);
				}
				throw error;
			}
		});

		server = app.server;
		baseURL = `http://localhost:${server.port}`;
	});

	afterEach(() => {
		if (server) {
			server.stop();
		}
	});

	test("should validate request body successfully", async () => {
		const validUser = {
			name: "John Doe",
			email: "john@example.com",
			age: 30,
		};

		const response = await fetch(`${baseURL}/users`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(validUser),
		});

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.name).toBe(validUser.name);
		expect(data.email).toBe(validUser.email);
	});

	test("should reject invalid request body", async () => {
		const invalidUser = {
			name: "J", // too short
			email: "invalid-email", // invalid format
			age: 17, // too young
			extra: "not allowed", // additional property
		};

		const response = await fetch(`${baseURL}/users`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(invalidUser),
		});

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toBe("Validation failed");
		expect(data.details).toBeDefined();
		expect(data.details.length).toBeGreaterThan(0);
	});

	test("should validate query parameters", async () => {
		const response = await fetch(
			`${baseURL}/search?q=test&limit=10&category=books`,
		);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.query.q).toBe("test");
		expect(data.query.limit).toBe(10);
		expect(data.query.category).toBe("books");
	});

	test("should reject invalid query parameters", async () => {
		const response = await fetch(
			`${baseURL}/search?q=&limit=101&category=invalid`,
		);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toBe("Validation failed");
		expect(data.details.some((e: any) => e.field.includes("q"))).toBe(true);
		expect(data.details.some((e: any) => e.field.includes("limit"))).toBe(true);
		expect(data.details.some((e: any) => e.field.includes("category"))).toBe(
			true,
		);
	});

	test("should handle missing required fields", async () => {
		const incompleteUser = {
			name: "John Doe",
			// missing email
		};

		const response = await fetch(`${baseURL}/users`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(incompleteUser),
		});

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.details.some((e: any) => e.field.includes("email"))).toBe(true);
	});

	test("should handle malformed JSON", async () => {
		const response = await fetch(`${baseURL}/users`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: '{"invalid": json}',
		});

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.details.some((e: any) => e.field === "body")).toBe(true);
	});
});

describe("Schema Validation Error", () => {
	test("should create validation error with details", () => {
		const errors = [
			{ field: "name", message: "Required field missing", value: undefined },
			{ field: "email", message: "Invalid email format", value: "invalid" },
		];

		const error = new SchemaValidationError(errors);

		expect(error.message).toBe("Schema validation failed");
		expect(error.statusCode).toBe(400);
		expect(error.errors).toEqual(errors);
		expect(error.name).toBe("SchemaValidationError");
	});
});

console.log("✅ Schema Validation Test Suite Complete");
