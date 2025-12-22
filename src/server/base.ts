import { enhanceRequest } from "../request";
import { createResponse } from "../response";
import { createRouter } from "../router";
import type {
  Handler,
  ListenOptions,
  Method,
  Middleware,
  MiddlewareHandler,
  Request,
  Response,
  RouteConfig,
} from "../types";
import { parseFormData } from "../upload";
import { parseQuery } from "../utils";

export type WebSocketHandlers = {
  open?: (ws: any, req?: any) => void;
  message?: (ws: any, message: string | Buffer) => void;
  close?: (ws: any, code?: number, reason?: string) => void;
  error?: (ws: any, error: Error) => void;
};

export type BaseServerConfig = {
  tls?: {
    cert: string | ArrayBuffer;
    key: string | ArrayBuffer;
    passphrase?: string;
    ca?: string | ArrayBuffer;
  };
  http2?: boolean;
  websocket?: WebSocketHandlers;
};

export type Context<T = Record<string, unknown>> = {
  get: <K extends keyof T>(key: K) => T[K] | undefined;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  has: <K extends keyof T>(key: K) => boolean;
  delete: <K extends keyof T>(key: K) => boolean;
  clear: () => void;
  all: () => T;
};

const createContext = <T = Record<string, unknown>>(): Context<T> => {
  const store = new Map<keyof T, T[keyof T]>();

  return {
    get: <K extends keyof T>(key: K) => store.get(key) as T[K] | undefined,
    set: <K extends keyof T>(key: K, value: T[K]) => {
      store.set(key, value);
    },
    has: <K extends keyof T>(key: K) => store.has(key),
    delete: <K extends keyof T>(key: K) => store.delete(key),
    clear: () => store.clear(),
    all: () => Object.fromEntries(store) as T,
  };
};

export const createBaseServer = <TContext = Record<string, unknown>>(
  config: BaseServerConfig = {},
) => {
  const router = createRouter();
  const globalMiddlewares: Middleware[] = [];
  const pathMiddlewaresList: { path: string; middlewares: Middleware[] }[] = [];
  let htmlRoutes: RouteConfig | null = null;
  let serverOptions: ListenOptions | null = null;

  const settings = new Map<string, any>();
  const context = createContext<TContext>();
  const mountpath = "/";

  const env = process.env.VERB_ENV || process.env.BUN_ENV || process.env.NODE_ENV || "development";
  settings.set("env", env);
  settings.set("trust proxy", env === "production");
  settings.set("view cache", env === "production");

  const path = () => mountpath;

  const use = (
    pathOrMiddleware: string | Middleware | Middleware[],
    ...middlewares: (Middleware | Middleware[])[]
  ) => {
    // flatten all middleware arrays
    const flatMiddlewares = middlewares.flatMap((m) => (Array.isArray(m) ? m : [m]));

    if (typeof pathOrMiddleware === "string") {
      const mwPath = pathOrMiddleware;
      // find existing or create new
      const existing = pathMiddlewaresList.find((p) => p.path === mwPath);
      if (existing) {
        existing.middlewares.push(...flatMiddlewares);
      } else {
        pathMiddlewaresList.push({ path: mwPath, middlewares: flatMiddlewares });
        // sort by path length ascending (parent paths run before children)
        pathMiddlewaresList.sort((a, b) => a.path.length - b.path.length);
      }
    } else if (Array.isArray(pathOrMiddleware)) {
      globalMiddlewares.push(...pathOrMiddleware);
    } else {
      globalMiddlewares.push(pathOrMiddleware, ...flatMiddlewares);
    }
  };

  const withRoutes = (routes: RouteConfig) => {
    htmlRoutes = routes;
  };

  const withOptions = (options: ListenOptions) => {
    serverOptions = options;
  };

  const set = (key: string | Record<string, any>, value?: any) => {
    if (typeof key === "object") {
      for (const [k, v] of Object.entries(key)) {
        settings.set(k, v);
      }
    } else {
      settings.set(key, value);
    }
  };

  const getSetting = (key: string) => settings.get(key);

  const parseHandlers = (
    handlers: MiddlewareHandler[],
  ): { middlewares: Middleware[]; handler: Handler } => {
    const handler = handlers[handlers.length - 1] as Handler;
    const middlewares: Middleware[] = [];
    for (let i = 0; i < handlers.length - 1; i++) {
      middlewares.push(handlers[i] as Middleware);
    }
    return { middlewares, handler };
  };

  const addRoute = (method: Method, path: string | string[], handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(handlers);
    const paths = Array.isArray(path) ? path : [path];
    for (const p of paths) {
      router.add(method, p, middlewares, handler);
    }
  };

  const get = (path: string | string[], ...handlers: MiddlewareHandler[]) =>
    addRoute("GET", path, handlers);
  const post = (path: string | string[], ...handlers: MiddlewareHandler[]) =>
    addRoute("POST", path, handlers);
  const put = (path: string | string[], ...handlers: MiddlewareHandler[]) =>
    addRoute("PUT", path, handlers);
  const del = (path: string | string[], ...handlers: MiddlewareHandler[]) =>
    addRoute("DELETE", path, handlers);
  const patch = (path: string | string[], ...handlers: MiddlewareHandler[]) =>
    addRoute("PATCH", path, handlers);
  const head = (path: string | string[], ...handlers: MiddlewareHandler[]) =>
    addRoute("HEAD", path, handlers);
  const options = (path: string | string[], ...handlers: MiddlewareHandler[]) =>
    addRoute("OPTIONS", path, handlers);

  const route = (path: string) => ({
    get: (...h: MiddlewareHandler[]) => {
      addRoute("GET", path, h);
      return route(path);
    },
    post: (...h: MiddlewareHandler[]) => {
      addRoute("POST", path, h);
      return route(path);
    },
    put: (...h: MiddlewareHandler[]) => {
      addRoute("PUT", path, h);
      return route(path);
    },
    delete: (...h: MiddlewareHandler[]) => {
      addRoute("DELETE", path, h);
      return route(path);
    },
    patch: (...h: MiddlewareHandler[]) => {
      addRoute("PATCH", path, h);
      return route(path);
    },
    head: (...h: MiddlewareHandler[]) => {
      addRoute("HEAD", path, h);
      return route(path);
    },
    options: (...h: MiddlewareHandler[]) => {
      addRoute("OPTIONS", path, h);
      return route(path);
    },
    all: (...h: MiddlewareHandler[]) => {
      const methods: Method[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
      for (const m of methods) {
        addRoute(m, path, h);
      }
      return route(path);
    },
  });

  const runMiddlewares = async (
    middlewares: Middleware[],
    req: Request,
    res: Response,
  ): Promise<boolean> => {
    for (const mw of middlewares) {
      let called = false;
      await mw(req, res, () => {
        called = true;
      });
      if (!called) {
        return false;
      }
    }
    return true;
  };

  const createFetchHandler =
    () =>
    async (req: Request): Promise<Response> => {
      const method = req.method as Method;
      const extendedReq = enhanceRequest(req);
      extendedReq.query = parseQuery(req.url);

      if (req.headers.get("content-type")?.includes("multipart/form-data")) {
        (extendedReq as any).formData = () => parseFormData(req);
      }

      const reqPath = extendedReq.path || "/";

      try {
        const { res, getResponse } = createResponse();

        if (!(await runMiddlewares(globalMiddlewares, extendedReq, res))) {
          return await getResponse();
        }

        // optimized path middleware matching
        for (const pm of pathMiddlewaresList) {
          if (reqPath === pm.path || reqPath.startsWith(`${pm.path}/`)) {
            if (!(await runMiddlewares(pm.middlewares, extendedReq, res))) {
              return await getResponse();
            }
          }
        }

        const match = router.match(method, reqPath);
        if (!match) {
          return new Response("Not Found", { status: 404 });
        }

        extendedReq.params = match.params;

        if (!(await runMiddlewares(match.middlewares, extendedReq, res))) {
          return await getResponse();
        }

        await match.handler(extendedReq, res);
        return await getResponse();
      } catch (error) {
        console.error("Handler error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    };

  const listen = (port?: number, hostname?: string) => {
    const finalPort = port ?? serverOptions?.port ?? 3000;
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost";

    const bunConfig: any = {
      port: finalPort,
      hostname: finalHostname,
    };

    if (config.tls) {
      bunConfig.tls = config.tls;
    }

    if (config.http2) {
      bunConfig.h2 = true;
    }

    if (config.websocket) {
      bunConfig.websocket = {
        open: config.websocket.open || (() => {}),
        message: config.websocket.message || (() => {}),
        close: config.websocket.close || (() => {}),
        error: config.websocket.error || (() => {}),
      };
      const baseFetch = createFetchHandler();
      bunConfig.fetch = (req: Request, server: any) => {
        if (req.headers.get("upgrade") === "websocket") {
          const success = server.upgrade(req, { data: { url: req.url } });
          if (success) {
            return;
          }
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return baseFetch(req);
      };
    } else if (htmlRoutes) {
      bunConfig.routes = htmlRoutes;
    } else {
      bunConfig.fetch = createFetchHandler();
    }

    if (serverOptions?.development) {
      bunConfig.development = serverOptions.development;
    }

    return Bun.serve(bunConfig);
  };

  return {
    get,
    post,
    put,
    delete: del,
    patch,
    head,
    options,
    use,
    route,
    withRoutes,
    withOptions,
    listen,
    createFetchHandler,
    router,
    set,
    getSetting,
    context,
    mountpath,
    path,
    _setTls: (tls: BaseServerConfig["tls"]) => {
      config.tls = tls;
    },
    _setHttp2: (enabled: boolean) => {
      config.http2 = enabled;
    },
    _setWebsocket: (handlers: WebSocketHandlers) => {
      config.websocket = handlers;
    },
  };
};

export type { Context };
