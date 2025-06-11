/**
 * HTTP method types supported by the server
 */
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

/**
 * Route handler function that processes requests and returns responses
 * @param req - The incoming request object
 * @param params - Route parameters extracted from the URL path
 * @returns A Response object or a Promise that resolves to a Response
 */
export type Handler = (
  req: Request,
  params: Record<string, string>,
) => Response | Promise<Response>;

/**
 * Middleware function that can intercept and modify requests/responses
 * @param req - The incoming request object
 * @param next - Function to call the next middleware or handler in the chain
 * @returns A Response object or a Promise that resolves to a Response
 */
export type Middleware = (
  req: Request,
  next: () => Response | Promise<Response>,
) => Response | Promise<Response>;

/**
 * Internal route representation with compiled regex pattern
 */
export interface Route {
  method: Method;
  pattern: RegExp;
  params: string[];
  handler: Handler;
}

/**
 * Radix tree node for efficient routing
 */
export interface RadixNode {
  path: string;
  handler?: Handler;
  params: string[];
  children: Map<string, RadixNode>;
  isWildcard: boolean;
  isParam: boolean;
}

/**
 * Router instance containing routes and middleware
 */
export interface Router {
  routes: Map<Method, Route[]>;
  middlewares: Middleware[];
  radixRoots?: Map<string, RadixNode>;
}
