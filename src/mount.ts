import { addRoute } from "./routers/manual.ts";
import type { Handler, Method, Router } from "./types.ts";

export interface MountableApp {
  routes: Array<{
    method: Method;
    path: string;
    handler: Handler;
  }>;
  middlewares?: Array<(req: Request, next: () => Promise<Response>) => Promise<Response>>;
}

/**
 * Mounts a sub-application at a specific base path
 * @param router - The router instance
 * @param basePath - Base path to mount the app at
 * @param app - Mountable application with routes and optionally middlewares
 */
export function mountApp(router: Router, basePath: string, app: MountableApp) {
  // Normalize base path
  const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

  // Mount all routes with the base path prefix
  for (const route of app.routes) {
    const fullPath = route.path === "/" ? normalizedBase : `${normalizedBase}${route.path}`;

    addRoute(router, route.method, fullPath, route.handler);
  }

  // TODO: In the future, we could add scoped middleware support
  // if (app.middlewares) {
  //   for (const middleware of app.middlewares) {
  //     addScopedMiddleware(router, normalizedBase, middleware);
  //   }
  // }
}
