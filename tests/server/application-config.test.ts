import { test, expect } from "bun:test";
import { createHttpServer } from "../../src/server/http";

test("Application config - app.set() and app.get()", () => {
  const app = createHttpServer();
  
  // Test setting and getting values
  app.set("title", "My App");
  app.set("port", 3000);
  app.set("debug", true);
  
  expect(app.getSetting("title")).toBe("My App");
  expect(app.getSetting("port")).toBe(3000);
  expect(app.getSetting("debug")).toBe(true);
  expect(app.getSetting("nonexistent")).toBeUndefined();
});

test("Application config - default environment settings", () => {
  const app = createHttpServer();
  
  // Test default environment settings
  expect(app.getSetting("env")).toBeDefined();
  expect(app.getSetting("trust proxy")).toBeDefined();
  expect(app.getSetting("case sensitive routing")).toBe(false);
  expect(app.getSetting("strict routing")).toBe(false);
  expect(app.getSetting("view cache")).toBeDefined();
  expect(app.getSetting("views")).toBeDefined();
  expect(app.getSetting("jsonp callback name")).toBe("callback");
});

test("Application config - app.locals", () => {
  const app = createHttpServer();
  
  // Test locals object
  expect(app.locals).toBeDefined();
  expect(typeof app.locals).toBe("object");
  
  // Test setting and getting locals
  app.locals.title = "My Application";
  app.locals.version = "1.0.0";
  app.locals.config = { theme: "dark" };
  
  expect(app.locals.title).toBe("My Application");
  expect(app.locals.version).toBe("1.0.0");
  expect(app.locals.config).toEqual({ theme: "dark" });
});

test("Application config - app.mountpath", () => {
  const app = createHttpServer();
  const mountedApp = createHttpServer("/api");
  
  // Test default mountpath
  expect(app.mountpath).toBe("/");
  
  // Test custom mountpath
  expect(mountedApp.mountpath).toBe("/api");
});

test("Application config - app.path()", () => {
  const app = createHttpServer();
  const mountedApp = createHttpServer("/api/v1");
  
  // Test path method
  expect(app.path()).toBe("/");
  expect(mountedApp.path()).toBe("/api/v1");
});

test("Application config - environment detection", () => {
  const app = createHttpServer();
  
  // Test environment detection
  const env = app.getSetting("env");
  expect(env).toBeDefined();
  expect(typeof env).toBe("string");
  
  // Test environment-based defaults
  const trustProxy = app.getSetting("trust proxy");
  const viewCache = app.getSetting("view cache");
  
  if (env === "production") {
    expect(trustProxy).toBe(true);
    expect(viewCache).toBe(true);
  } else {
    expect(trustProxy).toBe(false);
    expect(viewCache).toBe(false);
  }
});

test("Application config - overriding settings", () => {
  const app = createHttpServer();
  
  // Test overriding default settings
  app.set("trust proxy", true);
  app.set("case sensitive routing", true);
  app.set("strict routing", true);
  
  expect(app.getSetting("trust proxy")).toBe(true);
  expect(app.getSetting("case sensitive routing")).toBe(true);
  expect(app.getSetting("strict routing")).toBe(true);
});

test("Application config - mixed data types", () => {
  const app = createHttpServer();
  
  // Test various data types
  app.set("string", "hello");
  app.set("number", 42);
  app.set("boolean", true);
  app.set("object", { key: "value" });
  app.set("array", [1, 2, 3]);
  app.set("null", null);
  app.set("undefined", undefined);
  
  expect(app.getSetting("string")).toBe("hello");
  expect(app.getSetting("number")).toBe(42);
  expect(app.getSetting("boolean")).toBe(true);
  expect(app.getSetting("object")).toEqual({ key: "value" });
  expect(app.getSetting("array")).toEqual([1, 2, 3]);
  expect(app.getSetting("null")).toBeNull();
  expect(app.getSetting("undefined")).toBeUndefined();
});

test("Application config - app.locals integration", () => {
  const app = createHttpServer();
  
  // Set up locals
  app.locals.appName = "Test App";
  app.locals.version = "1.0.0";
  
  // Test that locals are accessible and can be used in application logic
  const mockHandler = (req: any, res: any) => {
    return {
      app: app.locals.appName,
      version: app.locals.version,
      settings: {
        env: app.getSetting("env"),
        port: app.getSetting("port") || 3000
      }
    };
  };
  
  const result = mockHandler({}, {});
  expect(result.app).toBe("Test App");
  expect(result.version).toBe("1.0.0");
  expect(result.settings.env).toBeDefined();
});

test("Application config - nested app structure", () => {
  const mainApp = createHttpServer();
  const apiApp = createHttpServer("/api");
  const v1App = createHttpServer("/api/v1");
  
  // Set different settings for each app
  mainApp.set("name", "Main App");
  apiApp.set("name", "API App");
  v1App.set("name", "V1 App");
  
  // Test that settings are isolated
  expect(mainApp.getSetting("name")).toBe("Main App");
  expect(apiApp.getSetting("name")).toBe("API App");
  expect(v1App.getSetting("name")).toBe("V1 App");
  
  // Test paths
  expect(mainApp.path()).toBe("/");
  expect(apiApp.path()).toBe("/api");
  expect(v1App.path()).toBe("/api/v1");
});