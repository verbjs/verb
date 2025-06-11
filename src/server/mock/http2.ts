/**
 * HTTP/2 Mock Server for Testing
 * 
 * Provides a lightweight, in-memory HTTP/2 server for unit testing
 * with HTTP/2 specific features like server push simulation.
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
 * Mock HTTP/2 push resource
 */
interface MockPushResource {
  path: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Mock HTTP/2 request configuration
 */
interface MockHttp2RequestConfig {
  method?: Method;
  url?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer | FormData | URLSearchParams;
  /** Simulate HTTP/2 stream priority */
  priority?: number;
  /** Simulate HTTP/2 stream weight */
  weight?: number;
}

/**
 * Mock HTTP/2 server response
 */
interface MockHttp2Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | ArrayBuffer;
  url: string;
  method: string;
  /** HTTP/2 pushed resources */
  pushedResources: MockPushResource[];
  /** HTTP/2 stream info */
  streamInfo: {
    id: number;
    priority: number;
    weight: number;
  };
}

/**
 * Mock HTTP/2 server configuration
 */
interface MockHttp2ServerOptions {
  /** Base URL for the mock server (default: "https://localhost:3443") */
  baseURL?: string;
  /** Router configuration */
  router?: RouterConfig;
  /** Enable request/response logging */
  logging?: boolean;
  /** Enable server push simulation */
  enablePush?: boolean;
}

/**
 * Mock HTTP/2 server state
 */
interface MockHttp2ServerState {
  router: UniversalRouter;
  baseURL: string;
  logging: boolean;
  enablePush: boolean;
  streamCounter: number;
  requestHistory: Array<{
    request: MockHttp2RequestConfig & { timestamp: number };
    response: MockHttp2Response;
  }>;
  pushResources: Map<string, MockPushResource[]>;
}

/**
 * Create a mock HTTP/2 server for testing
 */
export const createMockHttp2Server = (options: MockHttp2ServerOptions = {}): MockHttp2Server => {
  const {
    baseURL = "https://localhost:3443",
    router: routerConfig = defaultRouterConfig,
    logging = false,
    enablePush = true,
  } = options;

  const router = createUniversalRouter(routerConfig.type!, routerConfig.options);
  
  const state: MockHttp2ServerState = {
    router,
    baseURL,
    logging,
    enablePush,
    streamCounter: 1,
    requestHistory: [],
    pushResources: new Map(),
  };

  return new MockHttp2Server(state);
};

/**
 * Mock HTTP/2 server class
 */
export class MockHttp2Server {
  private state: MockHttp2ServerState;

  constructor(state: MockHttp2ServerState) {
    this.state = state;
  }

  /**
   * Make a mock HTTP/2 request
   */
  async request(config: MockHttp2RequestConfig): Promise<MockHttp2Response> {
    const {
      method = "GET",
      url = "/",
      headers = {},
      body,
      priority = 16, // Default HTTP/2 priority
      weight = 16,   // Default HTTP/2 weight
    } = config;

    // Construct full URL
    const fullURL = url.startsWith("http") ? url : `${this.state.baseURL}${url}`;
    
    // Add HTTP/2 specific headers
    const http2Headers = {
      ":method": method,
      ":path": new URL(fullURL).pathname + new URL(fullURL).search,
      ":scheme": "https",
      ":authority": new URL(fullURL).host,
      ...headers,
    };

    // Create mock request
    const request = new Request(fullURL, {
      method,
      headers: new Headers(http2Headers),
      body: body ? (typeof body === "string" ? body : body) : undefined,
    });

    const timestamp = Date.now();
    const streamId = this.state.streamCounter++;

    if (this.state.logging) {
      console.log(`🧪 Mock HTTP/2 ${method} ${url} [stream:${streamId}]`);
    }

    try {
      // Handle request through router
      const response = await this.state.router.handleRequest(request);
      
      // Convert response to mock HTTP/2 response format
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Add HTTP/2 pseudo-headers
      responseHeaders[":status"] = response.status.toString();

      const responseBody = await response.text();
      
      // Get push resources for this URL
      const pushedResources = this.state.enablePush 
        ? this.state.pushResources.get(new URL(fullURL).pathname) || []
        : [];

      const mockResponse: MockHttp2Response = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        url: fullURL,
        method,
        pushedResources: [...pushedResources],
        streamInfo: {
          id: streamId,
          priority,
          weight,
        },
      };

      // Store in history
      this.state.requestHistory.push({
        request: { ...config, timestamp },
        response: mockResponse,
      });

      if (this.state.logging) {
        console.log(`🧪 Mock HTTP/2 ${method} ${url} → ${response.status} [stream:${streamId}]`);
        if (pushedResources.length > 0) {
          console.log(`🧪 Pushed ${pushedResources.length} resources`);
        }
      }

      return mockResponse;
    } catch (error) {
      // Handle errors
      const errorResponse: MockHttp2Response = {
        status: 500,
        statusText: "Internal Server Error",
        headers: { 
          "content-type": "application/json",
          ":status": "500",
        },
        body: JSON.stringify({
          error: "Mock HTTP/2 server error",
          message: error.message,
        }),
        url: fullURL,
        method,
        pushedResources: [],
        streamInfo: {
          id: streamId,
          priority,
          weight,
        },
      };

      this.state.requestHistory.push({
        request: { ...config, timestamp },
        response: errorResponse,
      });

      if (this.state.logging) {
        console.error(`🧪 Mock HTTP/2 ${method} ${url} → Error [stream:${streamId}]:`, error);
      }

      return errorResponse;
    }
  }

  /**
   * GET request shorthand
   */
  async get(url: string, headers?: Record<string, string>): Promise<MockHttp2Response> {
    return this.request({ method: "GET", url, headers });
  }

  /**
   * POST request shorthand
   */
  async post(url: string, body?: any, headers?: Record<string, string>): Promise<MockHttp2Response> {
    const defaultHeaders = { "content-type": "application/json", ...headers };
    const requestBody = typeof body === "object" ? JSON.stringify(body) : body;
    return this.request({ method: "POST", url, body: requestBody, headers: defaultHeaders });
  }

  /**
   * PUT request shorthand
   */
  async put(url: string, body?: any, headers?: Record<string, string>): Promise<MockHttp2Response> {
    const defaultHeaders = { "content-type": "application/json", ...headers };
    const requestBody = typeof body === "object" ? JSON.stringify(body) : body;
    return this.request({ method: "PUT", url, body: requestBody, headers: defaultHeaders });
  }

  /**
   * DELETE request shorthand
   */
  async delete(url: string, headers?: Record<string, string>): Promise<MockHttp2Response> {
    return this.request({ method: "DELETE", url, headers });
  }

  /**
   * PATCH request shorthand
   */
  async patch(url: string, body?: any, headers?: Record<string, string>): Promise<MockHttp2Response> {
    const defaultHeaders = { "content-type": "application/json", ...headers };
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
      return mountApp(this.state.router.state, basePath, app);
    }
    throw new Error(`App mounting not supported for ${this.state.router.type} router.`);
  }

  /**
   * Configure server push resources for a path
   */
  setPushResources(path: string, resources: MockPushResource[]): void {
    this.state.pushResources.set(path, resources);
    if (this.state.logging) {
      console.log(`🧪 Configured ${resources.length} push resources for ${path}`);
    }
  }

  /**
   * Add a single push resource for a path
   */
  addPushResource(path: string, resource: MockPushResource): void {
    const existing = this.state.pushResources.get(path) || [];
    existing.push(resource);
    this.state.pushResources.set(path, existing);
  }

  /**
   * Clear push resources for a path
   */
  clearPushResources(path?: string): void {
    if (path) {
      this.state.pushResources.delete(path);
    } else {
      this.state.pushResources.clear();
    }
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
  assertStatus(expected: number, response?: MockHttp2Response): void {
    const target = response || this.getLastRequest()?.response;
    if (!target) {
      throw new Error("No response to assert against");
    }
    if (target.status !== expected) {
      throw new Error(`Expected status ${expected}, got ${target.status}`);
    }
  }

  /**
   * Assert HTTP/2 push resources
   */
  assertPushedResources(expectedCount: number, response?: MockHttp2Response): void {
    const target = response || this.getLastRequest()?.response;
    if (!target) {
      throw new Error("No response to assert against");
    }
    if (target.pushedResources.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} pushed resources, got ${target.pushedResources.length}`);
    }
  }

  /**
   * Assert HTTP/2 stream priority
   */
  assertStreamPriority(expected: number, response?: MockHttp2Response): void {
    const target = response || this.getLastRequest()?.response;
    if (!target) {
      throw new Error("No response to assert against");
    }
    if (target.streamInfo.priority !== expected) {
      throw new Error(`Expected stream priority ${expected}, got ${target.streamInfo.priority}`);
    }
  }

  /**
   * Assert response body contains text
   */
  assertBodyContains(text: string, response?: MockHttp2Response): void {
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
  assertJSON(expected: any, response?: MockHttp2Response): void {
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

  /**
   * Get current stream counter
   */
  get streamCounter(): number {
    return this.state.streamCounter;
  }
}

export type { MockHttp2ServerOptions, MockHttp2RequestConfig, MockHttp2Response, MockPushResource };