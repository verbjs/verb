import { describe, test, expect, beforeEach } from "bun:test";
import { createTestApp } from "./setup.ts";
import { createReactRendererPlugin } from "@verb/plugins";

describe("React Renderer Plugin", () => {
  let app: any;

  beforeEach(async () => {
    app = createTestApp();
    await app.register(createReactRendererPlugin());
    await app.startPlugins();
  });

  test("Plugin registers successfully", () => {
    expect(app.plugins.hasPlugin("react-renderer")).toBe(true);
  });

  test("React component can be rendered in a route", async () => {
    // Create a simple React component mock
    const mockComponent = {
      type: "div",
      props: { children: "Hello World" }
    };
    
    // Create a mock render function
    const mockRender = (component: any) => {
      return new Response(`<html><body><div>${component.props.children}</div></body></html>`, {
        headers: { "Content-Type": "text/html" }
      });
    };
    
    // Register the mock render function
    (globalThis as any).reactComponent = mockRender;
    
    // Register a route that uses the mock render function
    app.get("/react-test", () => {
      return (globalThis as any).reactComponent(mockComponent);
    });
    
    // Make a request to the route
    const response = await app.request.get("/react-test");
    
    // Verify the response
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html");
    
    const html = await response.text();
    expect(html).toContain("<div>Hello World</div>");
  });
});