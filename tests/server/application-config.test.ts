import { test, expect } from "bun:test"
import { createHttpServer } from "../../src/server/http"

test("Application config - app.set() and app.get()", () => {
  const app = createHttpServer()

  app.set("title", "My App")
  app.set("port", 3000)
  app.set("debug", true)

  expect(app.getSetting("title")).toBe("My App")
  expect(app.getSetting("port")).toBe(3000)
  expect(app.getSetting("debug")).toBe(true)
  expect(app.getSetting("nonexistent")).toBeUndefined()
})

test("Application config - default environment settings", () => {
  const app = createHttpServer()

  expect(app.getSetting("env")).toBeDefined()
  expect(app.getSetting("trust proxy")).toBeDefined()
  expect(app.getSetting("view cache")).toBeDefined()
})

test("Application config - app.mountpath", () => {
  const app = createHttpServer()
  expect(app.mountpath).toBe("/")
})

test("Application config - app.path()", () => {
  const app = createHttpServer()
  expect(app.path()).toBe("/")
})

test("Application config - environment detection", () => {
  const app = createHttpServer()

  const env = app.getSetting("env")
  expect(env).toBeDefined()
  expect(typeof env).toBe("string")

  const trustProxy = app.getSetting("trust proxy")
  const viewCache = app.getSetting("view cache")

  if (env === "production") {
    expect(trustProxy).toBe(true)
    expect(viewCache).toBe(true)
  } else {
    expect(trustProxy).toBe(false)
    expect(viewCache).toBe(false)
  }
})

test("Application config - overriding settings", () => {
  const app = createHttpServer()

  app.set("trust proxy", true)
  app.set("custom", "value")

  expect(app.getSetting("trust proxy")).toBe(true)
  expect(app.getSetting("custom")).toBe("value")
})

test("Application config - mixed data types", () => {
  const app = createHttpServer()

  app.set("string", "hello")
  app.set("number", 42)
  app.set("boolean", true)
  app.set("object", { key: "value" })
  app.set("array", [1, 2, 3])
  app.set("null", null)
  app.set("undefined", undefined)

  expect(app.getSetting("string")).toBe("hello")
  expect(app.getSetting("number")).toBe(42)
  expect(app.getSetting("boolean")).toBe(true)
  expect(app.getSetting("object")).toEqual({ key: "value" })
  expect(app.getSetting("array")).toEqual([1, 2, 3])
  expect(app.getSetting("null")).toBeNull()
  expect(app.getSetting("undefined")).toBeUndefined()
})

test("Application config - independent server instances", () => {
  const app1 = createHttpServer()
  const app2 = createHttpServer()

  app1.set("name", "App 1")
  app2.set("name", "App 2")

  expect(app1.getSetting("name")).toBe("App 1")
  expect(app2.getSetting("name")).toBe("App 2")
})
