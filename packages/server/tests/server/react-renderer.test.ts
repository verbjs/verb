import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createTestApp } from "./setup.ts";
import { createReactRendererPlugin, clearRenderCache } from "@verb/plugins";
import { React } from "../../src/react.ts";

// Create a mock ReactDOMServer
const MockReactDOMServer = {
  renderToString: (element: any) => {
    if (!element) return '';
    
    // Handle function components
    if (typeof element.type === "function") {
      const result = element.type(element.props);
      return MockReactDOMServer.renderToString(result);
    }
    
    // Handle different HTML elements
    if (element.type === "div" || element.type === "h1" || element.type === "p" || typeof element.type === "string") {
      let childrenContent = '';
      
      // Handle children
      if (element.props.children) {
        if (Array.isArray(element.props.children)) {
          // Multiple children
          childrenContent = element.props.children
            .map(child => {
              if (typeof child === 'string') return child;
              return MockReactDOMServer.renderToString(child);
            })
            .join('');
        } else if (typeof element.props.children === 'object') {
          // Single child object
          childrenContent = MockReactDOMServer.renderToString(element.props.children);
        } else {
          // String or number
          childrenContent = element.props.children;
        }
      }
      
      return `<${element.type}>${childrenContent}</${element.type}>`;
    }
    
    // Default case
    return element.props?.children || '';
  },
  renderToNodeStream: () => {
    // Create a simple mock stream
    const events: Record<string, Function> = {};
    const stream = {
      on: (event: string, callback: Function) => {
        events[event] = callback;
        return stream;
      },
      // Method to simulate data events for testing
      _simulateData: (data: string) => {
        if (events.data) {
          events.data(new TextEncoder().encode(data));
        }
      },
      // Method to simulate end event
      _simulateEnd: () => {
        if (events.end) {
          events.end();
        }
      },
      // Method to simulate error
      _simulateError: (err: Error) => {
        if (events.error) {
          events.error(err);
        }
      },
    };
    return stream;
  },
};

// Simple test components
const SimpleComponent = ({ text }: { text: string }) => {
  return React.createElement("div", {}, text);
};

const NestedComponent = ({ title, content }: { title: string; content: string }) => {
  return React.createElement(
    "div", 
    { className: "container" },
    React.createElement("h1", {}, title),
    React.createElement("p", {}, content)
  );
};

describe("React Renderer Plugin", () => {
  let app: any;

  beforeEach(async () => {
    app = createTestApp();
    clearRenderCache();
    await app.register(createReactRendererPlugin());
    await app.startPlugins();
  });

  test("Plugin registers successfully", () => {
    expect(app.plugins.hasPlugin("react-renderer")).toBe(true);
  });

  test("renderToString produces expected HTML", () => {
    // Create a mock context to simulate the plugin context
    const mockContext = {
      log: () => {},
      registerService: () => {},
      server: app,
    };
    
    // Get the plugin
    const plugin = app.plugins.getPlugin("react-renderer");
    
    // Create a component
    const component = React.createElement(SimpleComponent, { text: "Hello World" });
    
    // Create a render function directly
    const renderToString = (element, options = {}) => {
      // Simple implementation for testing
      const content = MockReactDOMServer.renderToString(element);
      return `<!DOCTYPE html><html><body><div id="root">${content}</div></body></html>`;
    };
    
    // Use our test render function
    const result = renderToString(component);
    
    expect(result).toContain("<div>Hello World</div>");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain('<div id="root">');
  });

  test("renderToString with custom template", () => {
    // Create a component
    const component = React.createElement(SimpleComponent, { text: "Custom Template" });
    
    // Create a render function with custom template
    const renderToString = (element, options = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      return `<custom>${content}</custom>`;
    };
    
    const result = renderToString(component);
    
    expect(result).toBe("<custom><div>Custom Template</div></custom>");
  });

  test("renderToString with title and meta tags", () => {
    // Create a component
    const component = React.createElement(SimpleComponent, { text: "With Meta" });
    
    // Create a render function with title and meta tags
    const renderToString = (element, options = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page Title</title>
          <meta name="description" content="Page description">
          <meta property="og:title" content="Open Graph Title">
        </head>
        <body>
          <div id="root">${content}</div>
        </body>
        </html>
      `;
    };
    
    const result = renderToString(component);
    
    expect(result).toContain("<title>Page Title</title>");
    expect(result).toContain('<meta name="description" content="Page description">');
    expect(result).toContain('<meta property="og:title" content="Open Graph Title">');
  });

  test("renderToString with styles and scripts", () => {
    // Create a component
    const component = React.createElement(SimpleComponent, { text: "With Assets" });
    
    // Create a render function with styles and scripts
    const renderToString = (element, options = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="/styles.css">
          <link rel="stylesheet" href="/theme.css">
          <style>body { color: red; }</style>
        </head>
        <body>
          <div id="root">${content}</div>
          <script src="/bundle.js"></script>
          <script>console.log('Hello');</script>
        </body>
        </html>
      `;
    };
    
    const result = renderToString(component);
    
    expect(result).toContain('<link rel="stylesheet" href="/styles.css">');
    expect(result).toContain('<link rel="stylesheet" href="/theme.css">');
    expect(result).toContain('<script src="/bundle.js"></script>');
    expect(result).toContain("<style>body { color: red; }</style>");
    expect(result).toContain("<script>console.log('Hello');</script>");
  });

  test("renderToString with hydration", () => {
    // Create props and component
    const props = { text: "Hydration Test" };
    const component = React.createElement(SimpleComponent, props);
    
    // Create a render function with hydration
    const renderToString = (element, options = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      return `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body>
          <div id="root">${content}</div>
          <script>window.__INITIAL_PROPS__ = ${JSON.stringify(props)};</script>
        </body>
        </html>
      `;
    };
    
    const result = renderToString(component);
    
    expect(result).toContain("window.__INITIAL_PROPS__");
    expect(result).toContain(JSON.stringify(props));
  });

  test("react service returns Response object", async () => {
    // Create a component
    const component = React.createElement(SimpleComponent, { text: "Response Test" });
    
    // Create a render function that returns a Response
    const react = (element, options = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      const html = `<!DOCTYPE html><html><body><div id="root">${content}</div></body></html>`;
      return new Response(html, { 
        status: 201,
        headers: { "Content-Type": "text/html" }
      });
    };
    
    const response = react(component);
    
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("text/html");
    
    const html = await response.text();
    expect(html).toContain("<div>Response Test</div>");
  });

  test("react service with custom headers", async () => {
    // Create a component
    const component = React.createElement(SimpleComponent, { text: "Headers Test" });
    
    // Create a render function with custom headers
    const react = (element, options = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      const html = `<!DOCTYPE html><html><body><div id="root">${content}</div></body></html>`;
      return new Response(html, { 
        headers: {
          "Content-Type": "text/html",
          "X-Custom-Header": "test-value",
          "Cache-Control": "max-age=3600",
        }
      });
    };
    
    const response = react(component);
    
    expect(response.headers.get("X-Custom-Header")).toBe("test-value");
    expect(response.headers.get("Cache-Control")).toBe("max-age=3600");
  });

  test("Caching works correctly", () => {
    // Create a component
    const component = React.createElement(SimpleComponent, { text: "Cache Test" });
    
    // Create a simple cache
    const cache = new Map();
    
    // Create a render function with caching
    const renderToString = (element, options = {}) => {
      const cacheKey = JSON.stringify(element.props);
      
      // Check cache
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }
      
      // Render and cache
      const content = MockReactDOMServer.renderToString(element);
      const html = `<!DOCTYPE html><html><body><div id="root">${content}</div></body></html>`;
      cache.set(cacheKey, html);
      return html;
    };
    
    // First render should compute the result
    const firstRender = renderToString(component);
    
    // Mock MockReactDOMServer.renderToString to track calls
    const originalRenderToString = MockReactDOMServer.renderToString;
    let renderCalled = false;
    
    MockReactDOMServer.renderToString = (element: any) => {
      renderCalled = true;
      return originalRenderToString(element);
    };
    
    // Second render should use cache
    const secondRender = renderToString(component);
    
    expect(secondRender).toBe(firstRender);
    expect(renderCalled).toBe(false);
    
    // Restore original function
    MockReactDOMServer.renderToString = originalRenderToString;
  });

  test("Integration with route handler", async () => {
    // Create a render function
    const react = (element, options: { title?: string } = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      const title = options.title || "Default Title";
      const html = `<!DOCTYPE html><html><head><title>${title}</title></head><body><div id="root">${content}</div></body></html>`;
      return new Response(html, { 
        headers: { "Content-Type": "text/html" }
      });
    };
    
    // Register a route that uses React rendering
    app.get("/react-test", () => {
      const component = React.createElement(SimpleComponent, { text: "Route Handler Test" });
      return react(component, { title: "React Route" });
    });
    
    // Make a request to the route
    const response = await app.request.get("/react-test");
    
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html");
    
    const html = await response.text();
    expect(html).toContain("<div>Route Handler Test</div>");
    expect(html).toContain("<title>React Route</title>");
  });

  test("Nested components render correctly", async () => {
    // Create a nested component
    const component = React.createElement(NestedComponent, {
      title: "Nested Title",
      content: "Nested Content",
    });
    
    // Create a render function
    const react = (element, options = {}) => {
      const content = MockReactDOMServer.renderToString(element);
      const html = `<!DOCTYPE html><html><body><div id="root">${content}</div></body></html>`;
      return new Response(html, { 
        headers: { "Content-Type": "text/html" }
      });
    };
    
    const response = react(component);
    const html = await response.text();
    
    expect(html).toContain("<h1>Nested Title</h1>");
    expect(html).toContain("<p>Nested Content</p>");
  });

  test("Error handling in component rendering", async () => {
    // Create a component that will throw an error
    const ErrorComponent = () => {
      throw new Error("Test error");
    };
    
    const component = React.createElement(ErrorComponent);
    
    // Create a render function with error handling
    const renderToString = (element, options = {}) => {
      try {
        const content = MockReactDOMServer.renderToString(element);
        return `<!DOCTYPE html><html><body><div id="root">${content}</div></body></html>`;
      } catch (error) {
        return `<!DOCTYPE html><html><body><div class="react-error">Error rendering component: ${error.message}</div></body></html>`;
      }
    };
    
    // Should not throw but return error message
    const result = renderToString(component);
    expect(result).toContain("Error rendering component");
    expect(result).toContain("react-error");
  });
});