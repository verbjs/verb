import type { Method, Handler, Middleware } from "./types";

type RouteMatch = {
  handler: Handler;
  middlewares: Middleware[];
  params: Record<string, string>;
} | null;

type Route = {
  method: Method;
  path: string;
  handler: Handler;
  middlewares: Middleware[];
  params: string[];
};

type DynamicRoute = Route & {
  pattern: RegExp;
  keys: string[];
};

export type Router = {
  add: (method: Method, path: string, middlewares: Middleware[], handler: Handler) => void;
  addRoute: (method: Method, path: string, middlewares: Middleware[], handler: Handler) => void;
  match: (method: Method, path: string) => RouteMatch;
  routes: () => Route[];
  getRoutes: () => Route[];
};

const isDynamic = (path: string): boolean => path.includes(":") || path.includes("*");

const toRegex = (path: string): { pattern: RegExp; keys: string[] } => {
  const keys: string[] = [];

  const pattern = path
    .replace(/\./g, "\\.")
    // :id(\d+) -> capture group with custom regex
    .replace(/:([^(/]+)(\([^)]+\))/g, (_, key, regex) => {
      keys.push(key);
      return regex;
    })
    // :id -> capture any non-slash
    .replace(/:([^/]+)/g, (_, key) => {
      keys.push(key);
      return "([^/]+)";
    })
    // * -> capture everything
    .replace(/\*/g, () => {
      keys.push("*");
      return "(.*)";
    });

  return { pattern: new RegExp(`^${pattern}/?$`), keys };
};

export const createRouter = (): Router => {
  const staticRoutes = new Map<string, { handler: Handler; middlewares: Middleware[] }>();
  const dynamicRoutes: DynamicRoute[] = [];
  const allRoutes: Route[] = [];

  const add = (method: Method, path: string, middlewares: Middleware[], handler: Handler) => {
    const params = extractParams(path);
    allRoutes.push({ method, path, handler, middlewares, params });

    if (isDynamic(path)) {
      const { pattern, keys } = toRegex(path);
      dynamicRoutes.push({ method, path, handler, middlewares, params, pattern, keys });
    } else {
      staticRoutes.set(`${method}:${path}`, { handler, middlewares });
    }
  };

  const match = (method: Method, path: string): RouteMatch => {
    // static first (fastest)
    const staticKey = `${method}:${path}`;
    const staticRoute = staticRoutes.get(staticKey);
    if (staticRoute) {
      return { handler: staticRoute.handler, middlewares: staticRoute.middlewares, params: {} };
    }

    // try without trailing slash
    if (path.endsWith("/") && path.length > 1) {
      const trimmed = staticRoutes.get(`${method}:${path.slice(0, -1)}`);
      if (trimmed) {
        return { handler: trimmed.handler, middlewares: trimmed.middlewares, params: {} };
      }
    }

    // dynamic routes
    for (const route of dynamicRoutes) {
      if (route.method !== method) {
        continue;
      }

      const match = path.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        for (let i = 0; i < route.keys.length; i++) {
          params[route.keys[i]] = decodeURIComponent(match[i + 1] || "");
        }
        return { handler: route.handler, middlewares: route.middlewares, params };
      }
    }

    return null;
  };

  const routes = () => allRoutes;

  return {
    add,
    addRoute: add, // backward compat alias
    match,
    routes,
    getRoutes: routes, // backward compat alias
  };
};

const extractParams = (path: string): string[] => {
  const params: string[] = [];
  const named = path.match(/:([^(/]+)/g);
  if (named) {
    params.push(...named.map((p) => p.slice(1).split("(")[0]));
  }
  if (path.includes("*")) {
    params.push("*");
  }
  return params;
};
