/**
 * HTTP Mock Server for Testing
 * 
 * Provides a lightweight, in-memory HTTP server for unit testing
 * without needing to start actual network servers.
 */

import type { Handler, Method, Middleware } from "../../types.ts";

import {
  createUniversalRouter,
  defaultRouterConfig,
  RouterType,
  type RouterConfig,
  type UniversalRouter,
} from "../../routers/index.ts";
import { type MountableApp, mountApp } from "../../mount.ts";

/**
 * Mock HTTP request configuration
 */
interface MockRequestConfig {
  method?: Method;
  url?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer | FormData | URLSearchParams;
}

/**
 * Mock HTTP server response
 */
interface MockResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | ArrayBuffer;
  url: string;
  method: string;
}

/**
 * Mock HTTP server configuration
 */
interface MockHttpServerOptions {
  /** Base URL for the mock server (default: "http://localhost:3000") */
  baseURL?: string;
  /** Router configuration */
  router?: RouterConfig;
  /** Enable request/response logging */
  logging?: boolean;
}

/**
 * Mock HTTP server state
 */
interface MockHttpServerState {
  router: UniversalRouter;
  baseURL: string;
  logging: boolean;
  requestHistory: Array<{
    request: MockRequestConfig & { timestamp: number };
    response: MockResponse;
  }>;
}

/**
 * Create a mock HTTP server for testing
 */
export const createMockHttpServer = (options: MockHttpServerOptions = {}): MockHttpServer => {
  const {
    baseURL = "http://localhost:3000",
    router: routerConfig = defaultRouterConfig,
    logging = false,
  } = options;

  if (!routerConfig.type) {
    throw new Error("Router type must be specified in routerConfig.");
  }
  const router = createUniversalRouter(routerConfig.type, routerConfig.options);
  
  const state: MockHttpServerState = {
    router,
    baseURL,
    logging,
    requestHistory: [],
  };

  return new MockHttpServer(state);
};

/**
 * Mock HTTP server class
 */
export class MockHttpServer {
  private state: MockHttpServerState;

  constructor(state: MockHttpServerState) {
    this.state = state;
  }

  /**
   * Make a mock HTTP request
   */
  async request(config: MockRequestConfig): Promise<MockResponse> {
    const {
      method = "GET",
      url = "/",
      headers = {},
      body,
    } = config;

    // Construct full URL
    const fullURL = url.startsWith("http") ? url : `${this.state.baseURL}${url}`;
    
    // Create mock request
    const request = new Request(fullURL, {
      method,
      headers: new Headers(headers),
      body: body ? (typeof body === "string" ? body : body) : undefined,
    });

    const timestamp = Date.now();

    if (this.state.logging) {
      console.log(`🧪 Mock ${method} ${url}`);
    }

    try {
      // Handle request through router
      const response = await this.state.router.handleRequest(request);
      
      // Convert response to mock response format
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.text();
      
      const mockResponse: MockResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        url: fullURL,
        method,
      };

      // Store in history
      this.state.requestHistory.push({
        request: { ...config, timestamp },
        response: mockResponse,
      });

      if (this.state.logging) {
        console.log(`🧪 Mock ${method} ${url} → ${response.status}`);
      }

      return mockResponse;
    } catch (error) {
      // Handle errors
      const errorResponse: MockResponse = {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Mock server error",
          message: error.message,
        }),
        url: fullURL,
        method,
      };

      this.state.requestHistory.push({
        request: { ...config, timestamp },
        response: errorResponse,
      });

      if (this.state.logging) {
        console.error(`🧪 Mock ${method} ${url} → Error:`, error);
      }

      return errorResponse;
    }
  }

  /**
   * GET request shorthand
   */
  async get(url: string, headers?: Record<string, string>): Promise<MockResponse> {
    return this.request({ method: "GET", url, headers });
  }

  /**
   * POST request shorthand
   */
  async post(url: string, body?: any, headers?: Record<string, string>): Promise<MockResponse> {
    const defaultHeaders = { "Content-Type": "application/json", ...headers };
    const requestBody = typeof body === "object" ? JSON.stringify(body) : body;
    return this.request({ method: "POST", url, body: requestBody, headers: defaultHeaders });
  }

  /**
   * PUT request shorthand
   */
  async put(url: string, body?: any, headers?: Record<string, string>): Promise<MockResponse> {
    const defaultHeaders = { "Content-Type": "application/json", ...headers };
    const requestBody = typeof body === "object" ? JSON.stringify(body) : body;
    return this.request({ method: "PUT", url, body: requestBody, headers: defaultHeaders });
  }

  /**
   * DELETE request shorthand
   */
  async delete(url: string, headers?: Record<string, string>): Promise<MockResponse> {
    return this.request({ method: "DELETE", url, headers });
  }

  /**
   * PATCH request shorthand
   */
  async patch(url: string, body?: any, headers?: Record<string, string>): Promise<MockResponse> {
    const defaultHeaders = { "Content-Type": "application/json", ...headers };
    const requestBody = typeof body === "object" ? JSON.stringify(body) : body;
    return this.request({ method: "PATCH", url, body: requestBody, headers: defaultHeaders });
  }

  /**
   * Register GET route (only for manual router)
   */
  get route_get() {
    return (path: string, handler: Handler) => {
      if (this.state.router.type === RouterType.MANUAL) {
        const { addRoute } = require("../../routers/manual.ts");
        return addRoute(this.state.router.state, "GET", path, handler);
      }
      throw new Error(`Route registration not supported for ${this.state.router.type} router.`);
    };
  }

  /**
   * Register POST route (only for manual router)
   */
  get route_post() {
    return (path: string, handler: Handler) => {
      if (this.state.router.type === RouterType.MANUAL) {
        const { addRoute } = require("../../routers/manual.ts");
        return addRoute(this.state.router.state, "POST", path, handler);
      }
      throw new Error(`Route registration not supported for ${this.state.router.type} router.`);
    };
  }

  /**
   * Register PUT route (only for manual router)
   */
  get route_put() {
    return (path: string, handler: Handler) => {
      if (this.state.router.type === RouterType.MANUAL) {
        const { addRoute } = require("../../routers/manual.ts");
        return addRoute(this.state.router.state, "PUT", path, handler);
      }
      throw new Error(`Route registration not supported for ${this.state.router.type} router.`);
    };
  }

  /**
   * Register DELETE route (only for manual router)
   */
  get route_delete() {
    return (path: string, handler: Handler) => {
      if (this.state.router.type === RouterType.MANUAL) {
        const { addRoute } = require("../../routers/manual.ts");
        return addRoute(this.state.router.state, "DELETE", path, handler);
      }
      throw new Error(`Route registration not supported for ${this.state.router.type} router.`);
    };
  }

  /**
   * Register PATCH route (only for manual router)
   */
  get route_patch() {
    return (path: string, handler: Handler) => {
      if (this.state.router.type === RouterType.MANUAL) {
        const { addRoute } = require("../../routers/manual.ts");
        return addRoute(this.state.router.state, "PATCH", path, handler);
      }
      throw new Error(`Route registration not supported for ${this.state.router.type} router.`);
    };
  }

  /**
   * Register HEAD route (only for manual router)
   */
  get route_head() {
    return (path: string, handler: Handler) => {
      if (this.state.router.type === RouterType.MANUAL) {
        const { addRoute } = require("../../routers/manual.ts");
        return addRoute(this.state.router.state, "HEAD", path, handler);
      }
      throw new Error(`Route registration not supported for ${this.state.router.type} router.`);
    };
  }

  /**
   * Register OPTIONS route (only for manual router)
   */
  get route_options() {
    return (path: string, handler: Handler) => {
      if (this.state.router.type === RouterType.MANUAL) {
        const { addRoute } = require("../../routers/manual.ts");
        return addRoute(this.state.router.state, "OPTIONS", path, handler);
      }
      throw new Error(`Route registration not supported for ${this.state.router.type} router.`);
    };
  }

  /**
   * Add middleware
   */
  use(middleware: Middleware): void {
    this.state.router.addMiddleware(middleware);
  }

  /**
   * Mount sub-application (only for manual router)
   */
  mount(basePath: string, app: MountableApp): void {
    if (this.state.router.type === RouterType.MANUAL) {
      mountApp(this.state.router.state, basePath, app);
      return;
    }
    throw new Error(`App mounting not supported for ${this.state.router.type} router.`);
  }

  /**
   * Get request history
   */
  getHistory(): typeof this.state.requestHistory {
    return [...this.state.requestHistory];
  }

  /**
   * Clear request history
   */
  clearHistory(): void {
    this.state.requestHistory = [];
  }

  /**
   * Get the last request/response pair
   */
  getLastRequest(): typeof this.state.requestHistory[0] | undefined {
    return this.state.requestHistory[this.state.requestHistory.length - 1];
  }

  /**
   * Assert response status
   */
  assertStatus(expected: number, response?: MockResponse): void {
    const target = response || this.getLastRequest()?.response;
    if (!target) {
      throw new Error("No response to assert against");
    }
    if (target.status !== expected) {
      throw new Error(`Expected status ${expected}, got ${target.status}`);
    }
  }

  /**
   * Assert response body contains text
   */
  assertBodyContains(text: string, response?: MockResponse): void {
    const target = response || this.getLastRequest()?.response;
    if (!target) {
      throw new Error("No response to assert against");
    }
    const body = typeof target.body === "string" ? target.body : new TextDecoder().decode(target.body);
    if (!body.includes(text)) {
      throw new Error(`Expected body to contain "${text}", got: ${body}`);
    }
  }

  /**
   * Assert response JSON matches
   */
  assertJSON(expected: any, response?: MockResponse): void {
    const target = response || this.getLastRequest()?.response;
    if (!target) {
      throw new Error("No response to assert against");
    }
    const body = typeof target.body === "string" ? target.body : new TextDecoder().decode(target.body);
    const actual = JSON.parse(body);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected JSON ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  /**
   * Get router type
   */
  get routerType(): RouterType {
    return this.state.router.type;
  }

  /**
   * Get router state
   */
  get router(): UniversalRouter {
    return this.state.router;
  }
}

export type { MockHttpServerOptions, MockRequestConfig, MockResponse };