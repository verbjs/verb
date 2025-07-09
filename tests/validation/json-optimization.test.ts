import { test, expect } from "bun:test";
import { compileSchema, validateRequest, validateResponse, schemas } from "../../src/validation";
import { optimizedJSON, validateSchema, commonSchemas } from "../../src/middleware/json-optimized";

test("JSON Schema validation - basic types", () => {
  const stringSchema = schemas.string({ minLength: 2, maxLength: 10 });
  const validator = compileSchema(stringSchema);
  
  // Valid string
  const validResult = validator.validate("hello");
  expect(validResult.valid).toBe(true);
  expect(validResult.data).toBe("hello");
  
  // Invalid string (too short)
  const invalidResult = validator.validate("a");
  expect(invalidResult.valid).toBe(false);
  expect(invalidResult.errors).toContain("Invalid string");
  
  // Invalid type
  const typeResult = validator.validate(123);
  expect(typeResult.valid).toBe(false);
});

test("JSON Schema validation - object schema", () => {
  const userSchema = schemas.object({
    name: schemas.string({ minLength: 1 }),
    age: schemas.number({ minimum: 0 }),
    email: schemas.string()
  }, ['name', 'email']);
  
  const validator = compileSchema(userSchema);
  
  // Valid user
  const validUser = { name: "John", age: 25, email: "john@example.com" };
  const validResult = validator.validate(validUser);
  expect(validResult.valid).toBe(true);
  expect(validResult.data).toEqual(validUser);
  
  // Missing required field
  const invalidUser = { name: "John", age: 25 };
  const invalidResult = validator.validate(invalidUser);
  expect(invalidResult.valid).toBe(false);
  expect(invalidResult.errors?.some(err => err.includes("email"))).toBe(true);
});

test("JSON Schema validation - array schema", () => {
  const arraySchema = schemas.array(schemas.string());
  const validator = compileSchema(arraySchema);
  
  // Valid array
  const validResult = validator.validate(["hello", "world"]);
  expect(validResult.valid).toBe(true);
  expect(validResult.data).toEqual(["hello", "world"]);
  
  // Invalid array (wrong item type)
  const invalidResult = validator.validate(["hello", 123]);
  expect(invalidResult.valid).toBe(false);
  expect(invalidResult.errors?.some(err => err.includes("[1]"))).toBe(true);
});

test("Optimized JSON serialization", () => {
  const userSchema = schemas.object({
    id: schemas.string(),
    name: schemas.string(),
    email: schemas.string()
  }, ['id', 'name']);
  
  const validator = compileSchema(userSchema);
  const user = { id: "123", name: "John", email: "john@example.com" };
  
  // Serialize with schema optimization
  const serialized = validator.serialize(user);
  expect(serialized).toBe('{"id":"123","name":"John","email":"john@example.com"}');
  
  // Should be valid JSON
  const parsed = JSON.parse(serialized);
  expect(parsed).toEqual(user);
});

test("JSON Schema validation - performance", () => {
  const userSchema = schemas.object({
    id: schemas.string(),
    name: schemas.string(),
    email: schemas.string(),
    age: schemas.number()
  }, ['id', 'name', 'email']);
  
  const validator = compileSchema(userSchema);
  const user = { id: "123", name: "John", email: "john@example.com", age: 25 };
  
  // Test validation performance
  const startTime = performance.now();
  for (let i = 0; i < 1000; i++) {
    validator.validate(user);
  }
  const endTime = performance.now();
  
  console.log(`1000 validations took ${endTime - startTime}ms`);
  expect(endTime - startTime).toBeLessThan(100); // Should be very fast
});

test("JSON Schema validation - serialization performance", () => {
  const userSchema = schemas.object({
    id: schemas.string(),
    name: schemas.string(),
    email: schemas.string(),
    age: schemas.number()
  }, ['id', 'name', 'email']);
  
  const validator = compileSchema(userSchema);
  const user = { id: "123", name: "John", email: "john@example.com", age: 25 };
  
  // Test serialization performance
  const startTime = performance.now();
  for (let i = 0; i < 1000; i++) {
    validator.serialize(user);
  }
  const endTime = performance.now();
  
  console.log(`1000 serializations took ${endTime - startTime}ms`);
  expect(endTime - startTime).toBeLessThan(50); // Should be very fast
});

test("Common schemas", () => {
  const userValidator = compileSchema(commonSchemas.user);
  
  // Valid user
  const validUser = {
    id: "123",
    name: "John",
    email: "john@example.com",
    age: 25
  };
  
  const result = userValidator.validate(validUser);
  expect(result.valid).toBe(true);
  expect(result.data).toEqual(validUser);
  
  // Invalid user (missing required field)
  const invalidUser = {
    id: "123",
    name: "John"
    // missing email
  };
  
  const invalidResult = userValidator.validate(invalidUser);
  expect(invalidResult.valid).toBe(false);
});

test("Response validation with optimization", () => {
  const responseValidator = compileSchema(commonSchemas.apiResponse);
  
  const response = {
    success: true,
    data: { id: 123, name: "Test" },
    message: "OK",
    timestamp: "2025-01-09T00:00:00Z"
  };
  
  const result = responseValidator.validate(response);
  expect(result.valid).toBe(true);
  
  // Test optimized serialization
  const serialized = responseValidator.serialize(response);
  expect(serialized).toContain('"success":true');
  expect(serialized).toContain('"data":{"id":123,"name":"Test"}');
});

test("Error response schema", () => {
  const errorValidator = compileSchema(commonSchemas.errorResponse);
  
  const error = {
    error: "Validation failed",
    message: "Invalid input",
    code: 400,
    details: ["Name is required", "Email is invalid"]
  };
  
  const result = errorValidator.validate(error);
  expect(result.valid).toBe(true);
  
  // Test minimal error (only required fields)
  const minimalError = {
    error: "Not found"
  };
  
  const minimalResult = errorValidator.validate(minimalError);
  expect(minimalResult.valid).toBe(true);
});

test("Nested object validation", () => {
  const nestedSchema = schemas.object({
    user: schemas.object({
      name: schemas.string(),
      profile: schemas.object({
        bio: schemas.string(),
        age: schemas.number()
      }, ['bio'])
    }, ['name', 'profile']),
    metadata: schemas.object({
      created: schemas.string(),
      updated: schemas.string()
    }, ['created'])
  }, ['user', 'metadata']);
  
  const validator = compileSchema(nestedSchema);
  
  const validData = {
    user: {
      name: "John",
      profile: {
        bio: "Developer",
        age: 30
      }
    },
    metadata: {
      created: "2025-01-09",
      updated: "2025-01-09"
    }
  };
  
  const result = validator.validate(validData);
  expect(result.valid).toBe(true);
  expect(result.data).toEqual(validData);
});

test("Array of objects validation", () => {
  const usersSchema = schemas.array(commonSchemas.user);
  const validator = compileSchema(usersSchema);
  
  const users = [
    { id: "1", name: "John", email: "john@example.com", age: 25 },
    { id: "2", name: "Jane", email: "jane@example.com", age: 30 }
  ];
  
  const result = validator.validate(users);
  expect(result.valid).toBe(true);
  expect(result.data).toEqual(users);
  
  // Test with invalid item
  const invalidUsers = [
    { id: "1", name: "John", email: "john@example.com", age: 25 },
    { id: "2", name: "Jane" } // missing email
  ];
  
  const invalidResult = validator.validate(invalidUsers);
  expect(invalidResult.valid).toBe(false);
  expect(invalidResult.errors?.some(err => err.includes("[1]"))).toBe(true);
});