import { test, expect } from "bun:test";
import { parsePathParams, parseQuery } from "../../src/utils";

test("parsePathParams - exact match", () => {
  const result = parsePathParams('/', '/');
  expect(result).toEqual({ params: {}, paramKeys: [] });
});

test("parsePathParams - static path match", () => {
  const result = parsePathParams('/users', '/users');
  expect(result).toEqual({ params: {}, paramKeys: [] });
});

test("parsePathParams - static path no match", () => {
  const result = parsePathParams('/users', '/posts');
  expect(result).toBeNull();
});

test("parsePathParams - single parameter", () => {
  const result = parsePathParams('/users/:id', '/users/123');
  expect(result).toEqual({ 
    params: { id: '123' }, 
    paramKeys: ['id'] 
  });
});

test("parsePathParams - multiple parameters", () => {
  const result = parsePathParams('/users/:userId/posts/:postId', '/users/123/posts/456');
  expect(result).toEqual({ 
    params: { userId: '123', postId: '456' }, 
    paramKeys: ['userId', 'postId'] 
  });
});

test("parsePathParams - length mismatch", () => {
  const result = parsePathParams('/users/:id', '/users/123/extra');
  expect(result).toBeNull();
});

test("parsePathParams - mixed static and params", () => {
  const result = parsePathParams('/api/users/:id/profile', '/api/users/123/profile');
  expect(result).toEqual({ 
    params: { id: '123' }, 
    paramKeys: ['id'] 
  });
});

test("parseQuery - no query string", () => {
  const result = parseQuery('http://localhost:3000/');
  expect(result).toEqual({});
});

test("parseQuery - empty query string", () => {
  const result = parseQuery('http://localhost:3000/?');
  expect(result).toEqual({});
});

test("parseQuery - single parameter", () => {
  const result = parseQuery('http://localhost:3000/?name=john');
  expect(result).toEqual({ name: 'john' });
});

test("parseQuery - multiple parameters", () => {
  const result = parseQuery('http://localhost:3000/?name=john&age=25&city=NYC');
  expect(result).toEqual({ 
    name: 'john', 
    age: '25', 
    city: 'NYC' 
  });
});

test("parseQuery - URL encoded values", () => {
  const result = parseQuery('http://localhost:3000/?message=hello%20world&email=test%40example.com');
  expect(result).toEqual({ 
    message: 'hello world', 
    email: 'test@example.com' 
  });
});

test("parseQuery - parameter without value", () => {
  const result = parseQuery('http://localhost:3000/?debug&verbose=true');
  expect(result).toEqual({ 
    debug: '', 
    verbose: 'true' 
  });
});

test("parseQuery - empty parameter", () => {
  const result = parseQuery('http://localhost:3000/?name=&age=25');
  expect(result).toEqual({ 
    name: '', 
    age: '25' 
  });
});