import { test, expect } from "bun:test";
import { createRouter } from "../../src/router";

test("Router - static routes", () => {
  const router = createRouter();
  
  const handler = (req: any, res: any) => res.send("Hello");
  router.addRoute('GET', '/', [], handler);
  
  const result = router.match('GET', '/');
  expect(result?.handler).toBe(handler);
  expect(result?.params).toBeUndefined();
});

test("Router - static routes not found", () => {
  const router = createRouter();
  
  router.addRoute('GET', '/', [], (req, res) => res.send("Hello"));
  
  const result = router.match('GET', '/not-found');
  expect(result).toBeNull();
});

test("Router - method mismatch", () => {
  const router = createRouter();
  
  router.addRoute('GET', '/', [], (req, res) => res.send("Hello"));
  
  const result = router.match('POST', '/');
  expect(result).toBeNull();
});

test("Router - dynamic routes with single parameter", () => {
  const router = createRouter();
  
  const handler = (req: any, res: any) => res.send("User");
  router.addRoute('GET', '/users/:id', [], handler);
  
  const result = router.match('GET', '/users/123');
  expect(result?.handler).toBe(handler);
  expect(result?.params).toEqual({ id: '123' });
});

test("Router - dynamic routes with multiple parameters", () => {
  const router = createRouter();
  
  const handler = (req: any, res: any) => res.send("Post");
  router.addRoute('GET', '/users/:userId/posts/:postId', [], handler);
  
  const result = router.match('GET', '/users/123/posts/456');
  expect(result?.handler).toBe(handler);
  expect(result?.params).toEqual({ userId: '123', postId: '456' });
});

test("Router - dynamic routes not matching", () => {
  const router = createRouter();
  
  router.addRoute('GET', '/users/:id', [], (req, res) => res.send("User"));
  
  const result = router.match('GET', '/users/123/extra');
  expect(result).toBeNull();
});

test("Router - mixed static and dynamic routes", () => {
  const router = createRouter();
  
  const staticHandler = (req: any, res: any) => res.send("Static");
  const dynamicHandler = (req: any, res: any) => res.send("Dynamic");
  
  router.addRoute('GET', '/about', [], staticHandler);
  router.addRoute('GET', '/users/:id', [], dynamicHandler);
  
  const staticResult = router.match('GET', '/about');
  expect(staticResult?.handler).toBe(staticHandler);
  expect(staticResult?.params).toBeUndefined();
  
  const dynamicResult = router.match('GET', '/users/123');
  expect(dynamicResult?.handler).toBe(dynamicHandler);
  expect(dynamicResult?.params).toEqual({ id: '123' });
});

test("Router - route priority (static over dynamic)", () => {
  const router = createRouter();
  
  const staticHandler = (req: any, res: any) => res.send("Static");
  const dynamicHandler = (req: any, res: any) => res.send("Dynamic");
  
  router.addRoute('GET', '/users/:id', [], dynamicHandler);
  router.addRoute('GET', '/users/profile', [], staticHandler);
  
  // Static route should be found even though dynamic was added first
  const result = router.match('GET', '/users/profile');
  expect(result?.handler).toBe(staticHandler);
});