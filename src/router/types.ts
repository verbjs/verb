import type { 
  Method,
  Handler, 
  Middleware, 
  MiddlewareHandler, 
  VerbRequest, 
  VerbResponse 
} from "../types";

export type RouterOptions = {
  caseSensitive?: boolean;
  mergeParams?: boolean;
  strict?: boolean;
};

export type VerbRouterInstance = {
  get: (path: string | string[], ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  post: (path: string | string[], ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  put: (path: string | string[], ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  delete: (path: string | string[], ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  patch: (path: string | string[], ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  head: (path: string | string[], ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  options: (path: string | string[], ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  use: (pathOrMiddleware: string | MiddlewareHandler, ...handlers: MiddlewareHandler[]) => VerbRouterInstance;
  route: (path: string) => RouteInstance;
  param: (name: string, handler: ParamHandler) => VerbRouterInstance;
  stack: RouteLayer[];
  mergeParams: boolean;
  caseSensitive: boolean;
  strict: boolean;
};

export type RouteInstance = {
  get: (...handlers: MiddlewareHandler[]) => RouteInstance;
  post: (...handlers: MiddlewareHandler[]) => RouteInstance;
  put: (...handlers: MiddlewareHandler[]) => RouteInstance;
  delete: (...handlers: MiddlewareHandler[]) => RouteInstance;
  patch: (...handlers: MiddlewareHandler[]) => RouteInstance;
  head: (...handlers: MiddlewareHandler[]) => RouteInstance;
  options: (...handlers: MiddlewareHandler[]) => RouteInstance;
  all: (...handlers: MiddlewareHandler[]) => RouteInstance;
};

export type ParamHandler = (req: VerbRequest, res: VerbResponse, next: () => void, value: string, name: string) => void | Promise<void>;

export type RouteLayer = {
  path?: string;
  method?: Method | 'USE' | 'PARAM';
  regexp: RegExp;
  keys: string[];
  handlers: MiddlewareHandler[];
  paramHandlers?: Record<string, ParamHandler>;
  route?: RouteInstance;
  isRouter?: boolean;
};

export type CoreRouterInstance = {
  addRoute: (method: Method, path: string, middlewares: Middleware[], handler: Handler) => void;
  match: (method: Method, path: string) => { handler: Handler; middlewares: Middleware[]; params?: Record<string, string> } | null;
  getRoutes: () => { method: Method; path: string; handler: Handler; middlewares: Middleware[]; params?: string[] }[];
};