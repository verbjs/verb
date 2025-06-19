/**
 * Router types and exports for Verb
 */

// Import functions for internal use
import { createRouter, addMiddleware, findRoute, handleRequest } from "./manual.ts";

import {
  createFilesystemRouter,
  addFilesystemMiddleware,
  findFilesystemRoute,
  handleFilesystemRequest,
} from "./filesystem.ts";

// Re-export manual router (original router)
export {
  createRouter,
  addRoute,
  addMiddleware,
  findRoute,
  handleRequest,
} from "./manual.ts";

// Re-export types from types.ts
export type {
  Router,
  Route,
  RouteMatch,
  RadixNode,
  Handler,
  Method,
  Middleware,
} from "../types.ts";

// Re-export filesystem router
export {
  createFilesystemRouter,
  scanRoutes,
  addFilesystemMiddleware,
  findFilesystemRoute,
  handleFilesystemRequest,
  getFilesystemRoutes,
  reloadRoute,
  clearFilesystemRoutes,
  type FilesystemRouterState,
  type FilesystemRouterOptions,
  type FileRoute,
} from "./filesystem.ts";

// Router type enum
export const RouterType = {
  MANUAL: "manual",
  FILESYSTEM: "filesystem",
} as const;

export type RouterType = (typeof RouterType)[keyof typeof RouterType];

// Universal router interface
export interface UniversalRouter {
  type: RouterType;
  state: Router | FilesystemRouterState;
  addMiddleware: (middleware: Middleware) => void;
  handleRequest: (req: Request) => Promise<Response>;
  findRoute?: (method: Method, pathname: string) => RouteMatch | null;
}

/**
 * Create a universal router wrapper
 */
export const createUniversalRouter = (
  type: RouterType,
  options?: FilesystemRouterOptions,
): UniversalRouter => {
  if (type === RouterType.MANUAL) {
    const manualRouter = createRouter();

    return {
      type: RouterType.MANUAL,
      state: manualRouter,
      addMiddleware: (middleware) => addMiddleware(manualRouter, middleware),
      handleRequest: (req) => handleRequest(manualRouter, req),
      findRoute: (method, pathname) => findRoute(manualRouter, method, pathname),
    };
  }

  if (type === RouterType.FILESYSTEM) {
    const filesystemRouter = createFilesystemRouter(options);

    return {
      type: RouterType.FILESYSTEM,
      state: filesystemRouter,
      addMiddleware: (middleware) => addFilesystemMiddleware(filesystemRouter, middleware),
      handleRequest: (req) => handleFilesystemRequest(filesystemRouter, req),
      findRoute: (method, pathname) => findFilesystemRoute(filesystemRouter, method, pathname),
    };
  }

  throw new Error(`Unknown router type: ${type}`);
};

/**
 * Router configuration for servers
 */
export interface RouterConfig {
  /** Type of router to use */
  type?: RouterType;
  /** Router-specific options */
  options?: FilesystemRouterOptions;
}

/**
 * Default router configuration
 */
export const defaultRouterConfig: RouterConfig = {
  type: RouterType.MANUAL,
  options: {},
};
